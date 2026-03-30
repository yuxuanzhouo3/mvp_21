/**
 * CloudBase collection schema references for the CN deployment.
 * These interfaces are documentation-first and intentionally align with
 * the unified data model used in the app layer.
 */

export interface WebUser {
  _id?: string;
  email: string;
  password: string;
  name: string;
  avatar?: string;
  phone?: string;
  bio?: string;
  pro: boolean;
  subscription_plan?: "free" | "pro" | "enterprise";
  subscription_status?: "active" | "paused" | "canceled" | "cancelled" | "expired" | "inactive";
  subscription_expires_at?: string;
  membership_expires_at?: string;
  region: string;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
  last_login_ip?: string;
  login_count?: number;
  preferences?: {
    language?: string;
    theme?: string;
    notifications?: boolean;
    emailUpdates?: boolean;
    autoSaveDrafts?: boolean;
    contractReminders?: boolean;
  };
}

export interface CompanyProfileRecord {
  _id?: string;
  user_id: string;
  profile_name?: string;
  company_name: string;
  credit_code: string;
  legal_person: string;
  address: string;
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
  status?: "active" | "archived";
  is_default?: boolean;
  source?: string;
  ocr_status?: "pending" | "completed" | "failed";
  license_file_url?: string;
  metadata?: Record<string, unknown>;
  last_verified_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AdminAuditLogRecord {
  _id?: string;
  id?: string;
  actor_user_id?: string;
  action: string;
  message: string;
  path?: string;
  method?: string;
  ip?: string;
  user_agent?: string;
  status: "success" | "error" | "denied";
  severity: "info" | "warn" | "error";
  meta?: Record<string, unknown>;
  created_at: string;
}

export interface ContractRecord {
  _id?: string;
  user_id: string;
  title: string;
  type: string;
  status:
    | "draft"
    | "pending"
    | "active"
    | "signed"
    | "completed"
    | "expired"
    | "cancelled";
  content: Record<string, unknown>;
  source_type?: string;
  source_content?: string;
  analysis_result?: Record<string, unknown> | null;
  parties?: Array<Record<string, unknown>>;
  signatures?: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown>;
  region?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AIConversation {
  _id?: string;
  user_id: string;
  title: string;
  model: string;
  provider: string;
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: string;
  }>;
  tokens?: {
    input: number;
    output: number;
    total: number;
  };
  cost?: number;
  region: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  _id?: string;
  user_id: string;
  email?: string;
  amount: number;
  currency: string;
  method?: "wechat" | "alipay";
  payment_method?: "wechat" | "alipay" | "stripe" | "paypal" | "manual";
  status: "pending" | "completed" | "failed" | "refunded";
  order_id?: string;
  transaction_id?: string;
  subscription_id?: string;
  product_type?: "pro" | "tokens" | "subscription";
  product_name?: string;
  quantity?: number;
  region: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
  completed_at?: string;
}

export interface TokenRecord {
  _id?: string;
  user_id: string;
  conversation_id?: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost: number;
  region: string;
  created_at: string;
}

export interface Subscription {
  _id?: string;
  user_id: string;
  email?: string;
  plan: "free" | "pro" | "enterprise";
  plan_id?: "free" | "pro" | "enterprise";
  status: "active" | "paused" | "canceled" | "cancelled" | "expired" | "inactive";
  start_date?: string;
  current_period_end?: string;
  end_date?: string;
  renewal_date?: string;
  auto_renew?: boolean;
  monthly_tokens?: number;
  used_tokens?: number;
  monthly_limit?: number;
  price?: number;
  currency?: string;
  billing_cycle?: "monthly" | "yearly";
  payment_method?: string;
  metadata?: Record<string, unknown>;
  region: string;
  created_at: string;
  updated_at: string;
}

export interface WechatLogin {
  _id?: string;
  user_id?: string;
  open_id: string;
  nickname?: string;
  avatar?: string;
  union_id?: string;
  status: "active" | "inactive";
  last_login_at: string;
  region: string;
  created_at: string;
  updated_at: string;
}

export interface SecurityLog {
  _id?: string;
  user_id?: string;
  email?: string;
  event: string;
  ip_address: string;
  user_agent?: string;
  status: "success" | "failure";
  message?: string;
  region: string;
  created_at: string;
}

export interface RefreshTokenRecord {
  _id?: string;
  tokenId: string;
  userId: string;
  email: string;
  refreshToken?: string;
  deviceInfo?: string;
  ipAddress?: string;
  userAgent?: string;
  isRevoked: boolean;
  revokedAt?: string;
  revokeReason?: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt?: string;
  usageCount: number;
  region: string;
}

export const CLOUDBASE_COLLECTIONS = {
  WEB_USERS: "web_users",
  COMPANY_PROFILES: "company_profiles",
  CONTRACTS: "contracts",
  AI_CONVERSATIONS: "ai_conversations",
  PAYMENTS: "payments",
  TOKENS: "tokens",
  SUBSCRIPTIONS: "subscriptions",
  WECHAT_LOGINS: "wechat_logins",
  SECURITY_LOGS: "security_logs",
  REFRESH_TOKENS: "refresh_tokens",
  ADMIN_AUDIT_LOGS: "admin_audit_logs",
} as const;

export const CLOUDBASE_INDEXES = {
  [CLOUDBASE_COLLECTIONS.WEB_USERS]: [
    { key: { email: 1 }, unique: true },
    { key: { created_at: -1 } },
    { key: { subscription_status: 1 } },
  ],
  [CLOUDBASE_COLLECTIONS.COMPANY_PROFILES]: [
    { key: { user_id: 1, updated_at: -1 } },
    { key: { user_id: 1, is_default: -1, updated_at: -1 } },
    { key: { credit_code: 1 } },
    { key: { updated_at: -1 } },
  ],
  [CLOUDBASE_COLLECTIONS.CONTRACTS]: [
    { key: { user_id: 1, created_at: -1 } },
    { key: { status: 1 } },
    { key: { updated_at: -1 } },
  ],
  [CLOUDBASE_COLLECTIONS.AI_CONVERSATIONS]: [
    { key: { user_id: 1, created_at: -1 } },
    { key: { model: 1 } },
  ],
  [CLOUDBASE_COLLECTIONS.PAYMENTS]: [
    { key: { user_id: 1, created_at: -1 } },
    { key: { order_id: 1 }, unique: true },
    { key: { status: 1 } },
    { key: { subscription_id: 1 } },
  ],
  [CLOUDBASE_COLLECTIONS.TOKENS]: [
    { key: { user_id: 1, created_at: -1 } },
    { key: { model: 1 } },
  ],
  [CLOUDBASE_COLLECTIONS.SUBSCRIPTIONS]: [
    { key: { user_id: 1 } },
    { key: { status: 1 } },
    { key: { current_period_end: 1 } },
  ],
  [CLOUDBASE_COLLECTIONS.WECHAT_LOGINS]: [
    { key: { open_id: 1 }, unique: true },
    { key: { user_id: 1 } },
  ],
  [CLOUDBASE_COLLECTIONS.SECURITY_LOGS]: [
    { key: { user_id: 1, created_at: -1 } },
    { key: { email: 1, created_at: -1 } },
    { key: { event: 1 } },
  ],
  [CLOUDBASE_COLLECTIONS.REFRESH_TOKENS]: [
    { key: { tokenId: 1 }, unique: true },
    { key: { userId: 1, createdAt: -1 } },
    { key: { isRevoked: 1, expiresAt: 1 } },
    { key: { expiresAt: 1 } },
  ],
  [CLOUDBASE_COLLECTIONS.ADMIN_AUDIT_LOGS]: [
    { key: { created_at: -1 } },
    { key: { actor_user_id: 1, created_at: -1 } },
    { key: { status: 1, created_at: -1 } },
    { key: { path: 1, method: 1, created_at: -1 } },
  ],
} as const;
