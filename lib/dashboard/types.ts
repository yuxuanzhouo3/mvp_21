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
export type DashboardTeamInviteStatus =
  | "pending"
  | "accepted"
  | "revoked"
  | "expired";

export interface DashboardTeamInvite {
  id: string;
  memberId?: string;
  workspaceOwnerId: string;
  email: string;
  name?: string;
  role: DashboardTeamRole;
  status: DashboardTeamInviteStatus;
  inviteUrl?: string;
  expiresAt?: string;
  accessCount: number;
  invitedBy?: string;
  acceptedByUserId?: string;
  acceptedAt?: string;
  revokedAt?: string;
  lastAccessedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DashboardTeamInvitePreview {
  invite: DashboardTeamInvite;
  workspaceOwnerName: string;
  workspaceOwnerEmail: string;
  canAccept: boolean;
  statusLabel: string;
}

export interface DashboardTeamInviteAcceptResult {
  accepted: boolean;
  workspaceOwnerId: string;
  workspaceOwnerName: string;
}

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
  invite?: DashboardTeamInvite;
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
  latestInvite?: DashboardTeamInvite;
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

export type DashboardDocumentType = "contract" | "draft" | "uploaded";
export type DashboardDocumentVerificationStatus = "verified" | "pending";
export type DashboardDocumentSourceKind = "contract" | "uploaded";

export interface DashboardDocumentParticipant {
  role: "sender" | "counterparty";
  name: string;
  status: "pending" | "confirmed";
  confirmedAt?: string;
}

export interface DashboardDocumentItem {
  id: string;
  sourceKind: DashboardDocumentSourceKind;
  rawId: string;
  contractId?: string;
  title: string;
  fileName: string;
  documentType: DashboardDocumentType;
  verificationStatus: DashboardDocumentVerificationStatus;
  contractStatus?: string;
  signFlowStatus?: string;
  sourceType?: string;
  category: string;
  groupName?: string;
  tags: string[];
  contentType?: string;
  storageProvider?: string;
  sizeBytes: number;
  sizeLabel: string;
  pageCount: number;
  hash: string;
  uploadedAt?: string;
  updatedAt?: string;
  participants: DashboardDocumentParticipant[];
  shareUrl?: string;
  shareExpiresAt?: string;
  shareAccessCount?: number;
  shareLastAccessedAt?: string;
}

export interface DashboardDocumentStats {
  totalDocuments: number;
  verifiedDocuments: number;
  pendingDocuments: number;
  totalStorageBytes: number;
  totalStorageLabel: string;
  averageProcessingHours: number;
  averageProcessingLabel: string;
  complianceRate: number;
}

export interface DashboardDocumentsData {
  documents: DashboardDocumentItem[];
  stats: DashboardDocumentStats;
  generatedAt: string;
}

export interface DashboardDocumentEvidenceItem {
  id: string;
  label: string;
  description: string;
  createdAt: string;
  type: string;
}

export interface DashboardDocumentTimelineEvent {
  id: string;
  label: string;
  description: string;
  occurredAt: string;
  type: "created" | "signing" | "signature" | "reminder" | "final_copy" | "update";
}

export interface DashboardDocumentSignatureRecord {
  id: string;
  role: "sender" | "counterparty";
  signerName: string;
  status: "pending" | "confirmed";
  method?: string;
  source?: string;
  createdAt?: string;
}

export interface DashboardDocumentVerificationData {
  document: DashboardDocumentItem;
  integrityStatus: DashboardDocumentVerificationStatus;
  integritySummary: string;
  contentHash: string;
  finalCopy?: {
    filename: string;
    createdAt: string;
    note: string;
  };
  evidence: DashboardDocumentEvidenceItem[];
  signatures: DashboardDocumentSignatureRecord[];
  timeline: DashboardDocumentTimelineEvent[];
  shareUrl?: string;
  shareExpiresAt?: string;
  shareAccessCount?: number;
  shareLastAccessedAt?: string;
}
