import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const mockQueueAdminAuditLog: any = jest.fn();
const mockLogBusinessEvent: any = jest.fn();
const mockLogWarn: any = jest.fn();

jest.mock("@/lib/data/admin-audit-store", () => ({
  queueAdminAuditLog: (...args: unknown[]) => mockQueueAdminAuditLog(...args),
}));

jest.mock("@/lib/utils/logger", () => ({
  logBusinessEvent: (...args: unknown[]) => mockLogBusinessEvent(...args),
  logWarn: (...args: unknown[]) => mockLogWarn(...args),
}));

import {
  observeOperationalMetric,
  resetOperationalObservabilityStateForTests,
} from "@/lib/monitoring/operational-observability";

describe("operational observability", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetOperationalObservabilityStateForTests();
  });

  test("triggers failure threshold alerts with per-window deduplication", () => {
    for (let i = 0; i < 5; i += 1) {
      observeOperationalMetric({
        chain: "payment_confirm",
        outcome: "failure",
        statusCode: 500,
        operationId: `op-1-${i}`,
        timestampMs: i * 1000,
      });
    }

    expect(mockQueueAdminAuditLog).toHaveBeenCalledTimes(1);
    expect(mockQueueAdminAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "operational_alert_failure_threshold_payment_confirm",
      }),
    );

    observeOperationalMetric({
      chain: "payment_confirm",
      outcome: "failure",
      statusCode: 500,
      operationId: "op-1-extra",
      timestampMs: 8_000,
    });
    expect(mockQueueAdminAuditLog).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 5; i += 1) {
      observeOperationalMetric({
        chain: "payment_confirm",
        outcome: "failure",
        statusCode: 500,
        operationId: `op-2-${i}`,
        timestampMs: 700_000 + i * 1000,
      });
    }
    expect(mockQueueAdminAuditLog).toHaveBeenCalledTimes(2);
  });

  test("tracks thresholds independently by scope", () => {
    for (let i = 0; i < 5; i += 1) {
      observeOperationalMetric({
        chain: "payment_webhook",
        scope: "stripe",
        outcome: "failure",
        statusCode: 500,
        operationId: `stripe-${i}`,
        timestampMs: i * 1000,
      });
    }

    for (let i = 0; i < 4; i += 1) {
      observeOperationalMetric({
        chain: "payment_webhook",
        scope: "alipay",
        outcome: "failure",
        statusCode: 500,
        operationId: `alipay-${i}`,
        timestampMs: i * 1000,
      });
    }

    expect(mockQueueAdminAuditLog).toHaveBeenCalledTimes(1);
    expect(mockQueueAdminAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({
          scope: "stripe",
        }),
      }),
    );
  });

  test("triggers slow-threshold alerts on sustained latency", () => {
    for (let i = 0; i < 8; i += 1) {
      observeOperationalMetric({
        chain: "payment_webhook",
        scope: "alipay",
        outcome: "success",
        statusCode: 200,
        durationMs: 4_200,
        operationId: `slow-${i}`,
        timestampMs: i * 1000,
      });
    }

    expect(mockQueueAdminAuditLog).toHaveBeenCalledTimes(1);
    expect(mockQueueAdminAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "operational_alert_slow_threshold_payment_webhook",
      }),
    );
    expect(mockLogBusinessEvent).toHaveBeenCalled();
    expect(mockLogWarn).toHaveBeenCalled();
  });
});
