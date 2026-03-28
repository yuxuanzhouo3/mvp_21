/**
 * User and user-profile helpers.
 */

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  passwordHash?: string;
  provider?: "email" | "wechat" | "google";
  providerId?: string;
  plan: "free" | "pro" | "enterprise";
  contractsThisMonth: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  email: string;
  name?: string;
  password?: string;
  provider?: "email" | "wechat" | "google";
  providerId?: string;
}

export interface UpdateUserInput {
  name?: string;
  avatar?: string;
  plan?: "free" | "pro" | "enterprise";
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  provider?: "email" | "wechat" | "google";
  providerId?: string;
  region?: "china" | "intl";
  wechat_openid?: string;
  wechat_unionid?: string;
  subscription_plan?: "free" | "pro" | "enterprise";
  subscription_status?: "active" | "inactive" | "cancelled";
  membership_expires_at?: string;
  lastLoginIp?: string;
  lastLoginAt?: Date | string;
  loginCount?: number;
  created_at?: string;
  updated_at?: string;
}

const users = new Map<string, User>();

export async function createUser(input: CreateUserInput): Promise<User> {
  const id = `user_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const user: User = {
    id,
    email: input.email,
    name: input.name,
    provider: input.provider || "email",
    providerId: input.providerId,
    plan: "free",
    contractsThisMonth: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  users.set(id, user);
  return user;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  for (const user of users.values()) {
    if (user.email === email) {
      return user;
    }
  }
  return null;
}

export async function findUserById(id: string): Promise<User | null> {
  return users.get(id) || null;
}

export async function findUserByProviderId(
  provider: string,
  providerId: string,
): Promise<User | null> {
  for (const user of users.values()) {
    if (user.provider === provider && user.providerId === providerId) {
      return user;
    }
  }
  return null;
}

export async function updateUser(
  id: string,
  input: UpdateUserInput,
): Promise<User | null> {
  const user = users.get(id);
  if (!user) return null;

  const updated = {
    ...user,
    ...input,
    updatedAt: new Date(),
  };
  users.set(id, updated);
  return updated;
}

export async function incrementContractsCount(id: string): Promise<void> {
  const user = users.get(id);
  if (user) {
    user.contractsThisMonth++;
    user.updatedAt = new Date();
    users.set(id, user);
  }
}

export async function resetMonthlyContractsCount(): Promise<void> {
  for (const [id, user] of users) {
    user.contractsThisMonth = 0;
    user.updatedAt = new Date();
    users.set(id, user);
  }
}

export function createProfileFromEmailUser(
  userId: string,
  email: string,
  fullName: string,
): UserProfile {
  return {
    id: userId,
    email,
    name: fullName,
    provider: "email",
    region: "china",
    subscription_plan: "free",
    subscription_status: "active",
    loginCount: 1,
    lastLoginAt: new Date(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function createProfileFromWechatUser(
  userId: string,
  wechatUser: {
    openid: string;
    unionid?: string;
    nickname?: string;
    headimgurl?: string;
  },
): UserProfile {
  return {
    id: userId,
    email: `wechat_${wechatUser.openid}@local.wechat`,
    name: wechatUser.nickname || "WeChat User",
    avatar: wechatUser.headimgurl || "",
    provider: "wechat",
    providerId: wechatUser.openid,
    region: "china",
    wechat_openid: wechatUser.openid,
    wechat_unionid: wechatUser.unionid,
    subscription_plan: "free",
    subscription_status: "active",
    loginCount: 1,
    lastLoginAt: new Date(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function mergeUserProfile(
  existing: UserProfile,
  updates: Partial<UserProfile>,
): UserProfile {
  return {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString(),
  };
}
