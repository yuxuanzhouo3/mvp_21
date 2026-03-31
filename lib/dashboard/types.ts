export type DashboardActivityType =
  | "signed"
  | "pending"
  | "created"
  | "updated"
  | "archived";

export interface DashboardActivity {
  id: string;
  type: DashboardActivityType;
  title: string;
  description: string;
  createdAt: string;
  contractId?: string;
}

export interface DashboardOverviewStats {
  totalContracts: number;
  totalContractsDelta: number;
  pendingSignatures: number;
  pendingSignaturesDelta: number;
  completedContracts: number;
  completedContractsDelta: number;
  activeParties: number;
  activePartiesDelta: number;
  lastUpdated: string;
}

export interface DashboardOverviewData {
  stats: DashboardOverviewStats;
  recentActivity: DashboardActivity[];
}

export interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  content?: string;
  isPublic: boolean;
  userId?: string;
  status: "active" | "draft" | "archived";
  version: number;
  sourceTemplateId?: string;
  usageCount: number;
  lastUsedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DashboardTemplatePermissions {
  canCreate: boolean;
  canEditOwned: boolean;
  canCreateVersion: boolean;
  canCopy: boolean;
}

export interface DashboardTemplatesData {
  templates: DashboardTemplate[];
  permissions: DashboardTemplatePermissions;
}

export type DashboardTeamRole = "owner" | "admin" | "member";
export type DashboardTeamStatus = "active" | "invited" | "suspended";

export interface DashboardTeamMember {
  id: string;
  userId?: string;
  workspaceOwnerId?: string;
  name: string;
  email: string;
  role: DashboardTeamRole;
  status: DashboardTeamStatus;
  avatar?: string;
  initials: string;
  joinedAt?: string;
  lastActiveAt?: string;
}

export interface DashboardTeamPermissions {
  currentRole: DashboardTeamRole;
  canInvite: boolean;
  canManageRoles: boolean;
  canRemoveMembers: boolean;
  canChangeStatus: boolean;
}

export interface DashboardTeamData {
  members: DashboardTeamMember[];
  permissions: DashboardTeamPermissions;
  workspaceOwnerId: string;
}

export interface DashboardBillingRecord {
  id: string;
  date?: string;
  amount: number;
  currency: string;
  status: "paid" | "pending" | "failed" | "refunded";
  description: string;
  paymentMethod: string;
  invoiceUrl?: string | null;
}

export interface DashboardBillingSummary {
  plan: string;
  status: string;
  price?: number;
  currency: string;
  billingCycle?: string;
  paymentMethod?: string;
  membershipExpiresAt?: string;
  totalPayments: number;
  totalSpent: number;
  lastPaymentAt?: string;
  recentPayments: DashboardBillingRecord[];
}
