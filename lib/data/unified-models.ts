export type SubscriptionPlan = "free" | "pro" | "enterprise";
export type SubscriptionStatus =
  | "active"
  | "inactive"
  | "paused"
  | "cancelled"
  | "canceled"
  | "expired";
export type ContractStatus =
  | "draft"
  | "pending"
  | "active"
  | "signed"
  | "completed"
  | "expired"
  | "cancelled";
export type PaymentStatus = "pending" | "completed" | "failed" | "refunded";

export interface UnifiedUserRecord {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  phone?: string;
  subscriptionPlan: SubscriptionPlan;
  subscriptionStatus: SubscriptionStatus;
  membershipExpiresAt?: string;
  region?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UnifiedCompanyProfile {
  id: string;
  userId: string;
  profileName?: string;
  companyName: string;
  creditCode: string;
  legalPerson: string;
  address: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  status?: "active" | "archived";
  isDefault?: boolean;
  source?: string;
  ocrStatus?: "pending" | "completed" | "failed";
  licenseFileUrl?: string;
  metadata?: Record<string, unknown>;
  lastVerifiedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UnifiedContractRecord {
  id: string;
  userId: string;
  title: string;
  type: string;
  status: ContractStatus;
  content: Record<string, unknown>;
  sourceType?: string;
  sourceContent?: string;
  analysisResult?: Record<string, unknown> | null;
  parties: Array<Record<string, unknown>>;
  signatures: Array<Record<string, unknown>>;
  metadata: Record<string, unknown>;
  region?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UnifiedSubscriptionRecord {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  price?: number;
  currency?: string;
  billingCycle?: string;
  paymentMethod?: string;
  currentPeriodEnd?: string;
  metadata: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface UnifiedPaymentRecord {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod: string;
  transactionId?: string;
  subscriptionId?: string;
  metadata: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export function normalizeSubscriptionPlan(value?: unknown): SubscriptionPlan {
  if (value === "pro" || value === "enterprise") {
    return value;
  }
  return "free";
}

export function normalizeSubscriptionStatus(
  value?: unknown,
): SubscriptionStatus {
  if (
    value === "active" ||
    value === "inactive" ||
    value === "paused" ||
    value === "cancelled" ||
    value === "canceled" ||
    value === "expired"
  ) {
    return value;
  }
  return "inactive";
}

export function normalizeContractStatus(value?: unknown): ContractStatus {
  if (
    value === "draft" ||
    value === "pending" ||
    value === "active" ||
    value === "signed" ||
    value === "completed" ||
    value === "expired" ||
    value === "cancelled"
  ) {
    return value;
  }
  return "draft";
}

export function normalizePaymentStatus(value?: unknown): PaymentStatus {
  if (
    value === "pending" ||
    value === "completed" ||
    value === "failed" ||
    value === "refunded"
  ) {
    return value;
  }
  return "pending";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function ensureObject(
  value: unknown,
  fallback: Record<string, unknown> = {},
): Record<string, unknown> {
  if (!value) {
    return fallback;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return isRecord(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  if (isRecord(value)) {
    return value;
  }

  return fallback;
}

export function ensureArray(value: unknown): Array<Record<string, unknown>> {
  if (!value) {
    return [];
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.filter(isRecord)
        : [];
    } catch {
      return [];
    }
  }

  return Array.isArray(value)
    ? value.filter(isRecord)
    : [];
}

function pickFirstObject(
  ...values: unknown[]
): Record<string, unknown> | null {
  for (const value of values) {
    if (isRecord(value) && Object.keys(value).length > 0) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = ensureObject(value);
      if (Object.keys(parsed).length > 0) {
        return parsed;
      }
    }
  }

  return null;
}

export function normalizeUserRecord(
  record: Record<string, any>,
): UnifiedUserRecord {
  return {
    id: record.id || record._id || "",
    email: record.email || "",
    name:
      record.name ||
      record.full_name ||
      record.displayName ||
      "",
    avatar: record.avatar || record.avatar_url,
    phone: record.phone,
    subscriptionPlan: normalizeSubscriptionPlan(
      record.subscription_plan || record.plan,
    ),
    subscriptionStatus: normalizeSubscriptionStatus(
      record.subscription_status || record.status,
    ),
    membershipExpiresAt:
      record.membership_expires_at || record.subscription_expires_at,
    region: record.region,
    createdAt: record.created_at || record.createdAt,
    updatedAt: record.updated_at || record.updatedAt,
  };
}

export function normalizeCompanyProfileRecord(
  record: Record<string, any>,
): UnifiedCompanyProfile {
  return {
    id: record.id || record._id || "",
    userId: record.user_id || record.userId || "",
    profileName: record.profile_name || record.profileName,
    companyName: record.company_name || record.companyName || "",
    creditCode: record.credit_code || record.creditCode || "",
    legalPerson: record.legal_person || record.legalPerson || "",
    address: record.address || "",
    contactPerson: record.contact_person || record.contactPerson || "",
    contactPhone: record.contact_phone || record.contactPhone || "",
    contactEmail: record.contact_email || record.contactEmail || "",
    status: record.status || "active",
    isDefault:
      typeof record.is_default === "boolean"
        ? record.is_default
        : typeof record.isDefault === "boolean"
          ? record.isDefault
          : false,
    source: record.source,
    ocrStatus: record.ocr_status || record.ocrStatus,
    licenseFileUrl: record.license_file_url || record.licenseFileUrl,
    metadata: ensureObject(record.metadata),
    lastVerifiedAt: record.last_verified_at || record.lastVerifiedAt,
    createdAt: record.created_at || record.createdAt,
    updatedAt: record.updated_at || record.updatedAt,
  };
}

export function normalizeContractRecord(
  record: Record<string, any>,
): UnifiedContractRecord {
  const payload = ensureObject(record.content);
  const looksLikeEnvelope =
    Object.prototype.hasOwnProperty.call(payload, "document") ||
    Object.prototype.hasOwnProperty.call(payload, "analysisResult") ||
    Object.prototype.hasOwnProperty.call(payload, "analysis_result") ||
    Object.prototype.hasOwnProperty.call(payload, "sourceType") ||
    Object.prototype.hasOwnProperty.call(payload, "source_type") ||
    Object.prototype.hasOwnProperty.call(payload, "parties") ||
    Object.prototype.hasOwnProperty.call(payload, "signatures") ||
    Object.prototype.hasOwnProperty.call(payload, "metadata") ||
    Object.prototype.hasOwnProperty.call(payload, "region");
  const document = isRecord(payload.document)
    ? payload.document
    : isRecord(record.document)
      ? ensureObject(record.document)
      : looksLikeEnvelope
        ? {}
        : payload;

  return {
    id: record.id || record._id || "",
    userId: record.user_id || record.userId || "",
    title: record.title || "",
    type:
      record.type ||
      (typeof payload.type === "string" ? payload.type : "custom"),
    status: normalizeContractStatus(record.status),
    content: document,
    sourceType:
      record.sourceType ||
      record.source_type ||
      (typeof payload.sourceType === "string" ? payload.sourceType : undefined),
    sourceContent:
      record.sourceContent ||
      record.source_content ||
      record.source_text ||
      (typeof payload.sourceContent === "string"
        ? payload.sourceContent
        : undefined),
    analysisResult: pickFirstObject(
      record.analysisResult,
      record.analysis_result,
      payload.analysisResult,
      payload.analysis_result,
    ),
    parties: ensureArray(record.parties).length
      ? ensureArray(record.parties)
      : ensureArray(payload.parties),
    signatures: ensureArray(record.signatures).length
      ? ensureArray(record.signatures)
      : ensureArray(payload.signatures),
    metadata: pickFirstObject(record.metadata, payload.metadata) || {},
    region:
      record.region ||
      (typeof payload.region === "string" ? payload.region : undefined),
    createdAt: record.created_at || record.createdAt,
    updatedAt: record.updated_at || record.updatedAt,
  };
}

export function normalizeSubscriptionRecord(
  record: Record<string, any>,
): UnifiedSubscriptionRecord {
  return {
    id: record.id || record._id || "",
    userId: record.user_id || record.userId || "",
    plan: normalizeSubscriptionPlan(
      record.plan ||
        record.plan_id ||
        record.subscription_plan,
    ),
    status: normalizeSubscriptionStatus(record.status || record.subscription_status),
    price:
      typeof record.price === "number"
        ? record.price
        : Number(record.price || 0) || undefined,
    currency: record.currency || "USD",
    billingCycle: record.billing_cycle || record.billingCycle,
    paymentMethod: record.payment_method || record.paymentMethod,
    currentPeriodEnd:
      record.current_period_end ||
      record.currentPeriodEnd ||
      record.end_date ||
      record.endDate,
    metadata: ensureObject(record.metadata),
    createdAt: record.created_at || record.createdAt || record.start_date,
    updatedAt: record.updated_at || record.updatedAt,
  };
}

export function normalizePaymentRecord(
  record: Record<string, any>,
): UnifiedPaymentRecord {
  return {
    id: record.id || record._id || "",
    userId: record.user_id || record.userId || "",
    amount:
      typeof record.amount === "number"
        ? record.amount
        : Number(record.amount || 0),
    currency: record.currency || "USD",
    status: normalizePaymentStatus(record.status),
    paymentMethod:
      record.payment_method ||
      record.method ||
      record.paymentMethod ||
      "",
    transactionId:
      record.transaction_id ||
      record.transactionId ||
      record.external_payment_id,
    subscriptionId: record.subscription_id || record.subscriptionId,
    metadata: ensureObject(record.metadata),
    createdAt: record.created_at || record.createdAt,
    updatedAt: record.updated_at || record.updatedAt,
  };
}

export function buildSupabaseContractPayload(
  contract: Partial<UnifiedContractRecord>,
): string {
  return JSON.stringify({
    document: contract.content || {},
    type: contract.type || "custom",
    sourceType: contract.sourceType,
    sourceContent: contract.sourceContent,
    analysisResult: contract.analysisResult || null,
    parties: contract.parties || [],
    signatures: contract.signatures || [],
    metadata: contract.metadata || {},
    region: contract.region,
  });
}

export function buildSupabaseSubscriptionPayload(
  subscription: Partial<UnifiedSubscriptionRecord>,
): Record<string, unknown> {
  return {
    user_id: subscription.userId,
    plan: subscription.plan || "free",
    status: subscription.status || "inactive",
    price: subscription.price ?? null,
    currency: subscription.currency || "USD",
    billing_cycle: subscription.billingCycle || null,
    payment_method: subscription.paymentMethod || null,
    current_period_end: subscription.currentPeriodEnd || null,
    metadata: subscription.metadata || {},
  };
}

export function buildSupabasePaymentPayload(
  payment: Partial<UnifiedPaymentRecord>,
): Record<string, unknown> {
  return {
    user_id: payment.userId,
    amount: payment.amount ?? 0,
    currency: payment.currency || "USD",
    status: payment.status || "pending",
    payment_method: payment.paymentMethod || "",
    transaction_id: payment.transactionId || null,
    external_payment_id: payment.transactionId || null,
    subscription_id: payment.subscriptionId || null,
    metadata: payment.metadata || {},
  };
}
