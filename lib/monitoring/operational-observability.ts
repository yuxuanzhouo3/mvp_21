import { queueAdminAuditLog } from "@/lib/data/admin-audit-store";
import { logBusinessEvent, logWarn } from "@/lib/utils/logger";

export type OperationalChain =
  | "payment_confirm"
  | "payment_webhook"
  | "team_invite_accept"
  | "contract_export";

export type OperationalOutcome = "success" | "failure" | "rejected";
export type OperationalAlertType = "failure_threshold" | "rejected_threshold" | "slow_threshold";

export interface OperationalThresholdConfig {
  windowMs: number;
  failureThreshold: number;
  rejectedThreshold: number;
  slowThreshold: number;
  slowDurationMs: number;
}

export interface ObserveOperationalMetricInput {
  chain: OperationalChain;
  outcome: OperationalOutcome;
  statusCode: number;
  operationId?: string;
  scope?: string;
  userId?: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
  timestampMs?: number;
}

interface RollingMetricEntry {
  ts: number;
  outcome: OperationalOutcome;
  durationMs?: number;
}

interface RollingWindowState {
  events: RollingMetricEntry[];
  lastAlertAt: Partial<Record<OperationalAlertType, number>>;
}

interface ObservationSummary {
  total: number;
  success: number;
  failure: number;
  rejected: number;
  slow: number;
}

const DEFAULT_THRESHOLDS: Record<OperationalChain, OperationalThresholdConfig> = {
  payment_confirm: {
    windowMs: 10 * 60 * 1000,
    failureThreshold: 5,
    rejectedThreshold: 10,
    slowThreshold: 8,
    slowDurationMs: 2500,
  },
  payment_webhook: {
    windowMs: 10 * 60 * 1000,
    failureThreshold: 5,
    rejectedThreshold: 20,
    slowThreshold: 8,
    slowDurationMs: 4000,
  },
  team_invite_accept: {
    windowMs: 10 * 60 * 1000,
    failureThreshold: 5,
    rejectedThreshold: 8,
    slowThreshold: 8,
    slowDurationMs: 1500,
  },
  contract_export: {
    windowMs: 10 * 60 * 1000,
    failureThreshold: 5,
    rejectedThreshold: 8,
    slowThreshold: 8,
    slowDurationMs: 2000,
  },
};

const rollingState = new Map<string, RollingWindowState>();

function normalizeScope(scope?: string) {
  if (!scope) {
    return "default";
  }
  return scope.trim().toLowerCase() || "default";
}

function buildMetricKey(chain: OperationalChain, scope?: string) {
  return `${chain}:${normalizeScope(scope)}`;
}

function getOrCreateWindowState(key: string) {
  const existing = rollingState.get(key);
  if (existing) {
    return existing;
  }
  const created: RollingWindowState = {
    events: [],
    lastAlertAt: {},
  };
  rollingState.set(key, created);
  return created;
}

function summarize(events: RollingMetricEntry[], slowDurationMs: number): ObservationSummary {
  let success = 0;
  let failure = 0;
  let rejected = 0;
  let slow = 0;

  for (const event of events) {
    if (event.outcome === "success") {
      success += 1;
    } else if (event.outcome === "failure") {
      failure += 1;
    } else {
      rejected += 1;
    }

    if (typeof event.durationMs === "number" && event.durationMs >= slowDurationMs) {
      slow += 1;
    }
  }

  return {
    total: events.length,
    success,
    failure,
    rejected,
    slow,
  };
}

function toAlertSeverity(type: OperationalAlertType) {
  return type === "failure_threshold" ? "error" : "warn";
}

function toAlertStatus(type: OperationalAlertType) {
  return type === "failure_threshold" ? "error" : "denied";
}

function buildAlertMessage(args: {
  type: OperationalAlertType;
  chain: OperationalChain;
  scope: string;
  count: number;
  threshold: number;
  windowMs: number;
}) {
  const windowMinutes = Math.round(args.windowMs / 60000);
  if (args.type === "failure_threshold") {
    return `Operational failures reached ${args.count}/${args.threshold} within ${windowMinutes} minutes.`;
  }
  if (args.type === "rejected_threshold") {
    return `Operational rejections reached ${args.count}/${args.threshold} within ${windowMinutes} minutes.`;
  }
  return `Operational slow requests reached ${args.count}/${args.threshold} within ${windowMinutes} minutes.`;
}

function emitAlert(input: {
  type: OperationalAlertType;
  chain: OperationalChain;
  scope: string;
  count: number;
  threshold: number;
  windowMs: number;
  slowDurationMs: number;
  operationId?: string;
  userId?: string;
  statusCode: number;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}) {
  const message = buildAlertMessage({
    type: input.type,
    chain: input.chain,
    scope: input.scope,
    count: input.count,
    threshold: input.threshold,
    windowMs: input.windowMs,
  });

  logWarn("operational_alert_threshold_breached", {
    alertType: input.type,
    chain: input.chain,
    scope: input.scope,
    count: input.count,
    threshold: input.threshold,
    windowMs: input.windowMs,
    slowDurationMs: input.slowDurationMs,
    operationId: input.operationId,
    userId: input.userId,
    statusCode: input.statusCode,
    durationMs: input.durationMs,
    ...input.metadata,
  });

  queueAdminAuditLog({
    actorUserId: input.userId,
    action: `operational_alert_${input.type}_${input.chain}`,
    message,
    path: `/monitoring/${input.chain}`,
    method: "MONITOR",
    status: toAlertStatus(input.type),
    severity: toAlertSeverity(input.type),
    meta: {
      alertType: input.type,
      chain: input.chain,
      scope: input.scope,
      count: input.count,
      threshold: input.threshold,
      windowMs: input.windowMs,
      slowDurationMs: input.slowDurationMs,
      operationId: input.operationId,
      statusCode: input.statusCode,
      durationMs: input.durationMs,
      ...input.metadata,
    },
  });
}

export function observeOperationalMetric(input: ObserveOperationalMetricInput) {
  const now = typeof input.timestampMs === "number" ? input.timestampMs : Date.now();
  const config = DEFAULT_THRESHOLDS[input.chain];
  const scope = normalizeScope(input.scope);
  const key = buildMetricKey(input.chain, scope);
  const state = getOrCreateWindowState(key);
  const windowStart = now - config.windowMs;

  state.events.push({
    ts: now,
    outcome: input.outcome,
    durationMs: input.durationMs,
  });
  state.events = state.events.filter((event) => event.ts >= windowStart);

  const summary = summarize(state.events, config.slowDurationMs);

  logBusinessEvent("operational_chain_metric", input.userId, {
    chain: input.chain,
    scope,
    outcome: input.outcome,
    statusCode: input.statusCode,
    operationId: input.operationId,
    durationMs: input.durationMs,
    counts: summary,
    threshold: config,
    ...input.metadata,
  });

  const checks: Array<{
    type: OperationalAlertType;
    count: number;
    threshold: number;
  }> = [
    {
      type: "failure_threshold",
      count: summary.failure,
      threshold: config.failureThreshold,
    },
    {
      type: "rejected_threshold",
      count: summary.rejected,
      threshold: config.rejectedThreshold,
    },
    {
      type: "slow_threshold",
      count: summary.slow,
      threshold: config.slowThreshold,
    },
  ];

  for (const check of checks) {
    if (check.count < check.threshold) {
      continue;
    }

    const lastAlertAt = state.lastAlertAt[check.type];
    if (typeof lastAlertAt === "number" && now - lastAlertAt < config.windowMs) {
      continue;
    }

    state.lastAlertAt[check.type] = now;
    emitAlert({
      type: check.type,
      chain: input.chain,
      scope,
      count: check.count,
      threshold: check.threshold,
      windowMs: config.windowMs,
      slowDurationMs: config.slowDurationMs,
      operationId: input.operationId,
      userId: input.userId,
      statusCode: input.statusCode,
      durationMs: input.durationMs,
      metadata: input.metadata,
    });
  }

  return {
    key,
    counts: summary,
    threshold: config,
  };
}

export function resetOperationalObservabilityStateForTests() {
  rollingState.clear();
}
