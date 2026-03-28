import path from 'path';

import {
  deleteFileFromCloudBase,
  getDatabase,
  uploadFileToCloudBase,
} from '@/lib/cloudbase/cloudbase-service';
import { isChinaRegion } from '@/lib/config/region';
import { getSupabaseAdmin } from '@/lib/integrations/supabase-admin';

type RawRecord = Record<string, any>;

export interface AdminManagedUser {
  id: string;
  email: string;
  nickname: string;
  subscription_type: string;
  created_at: string;
  updated_at?: string;
  last_login_at?: string;
  role: string;
  avatar?: string;
  phone?: string;
  is_banned?: boolean;
}

export interface AdminManagedUserDetails {
  user: AdminManagedUser;
  contractCount: number;
  orders: Array<{
    id: string;
    plan_type?: string;
    amount?: number;
    status?: string;
    currency?: string;
    payment_method?: string;
    created_at?: string;
  }>;
  recentLogs: Array<{
    id?: string;
    action?: string;
    created_at?: string;
  }>;
}

export interface AdminManagedVersion {
  id: string;
  platform: string;
  version: string;
  buildNumber: number;
  fileUrl: string;
  fileSize: number;
  changelog: string;
  forceUpdate: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface AdminUploadedFile {
  path: string;
  url: string;
  size: number;
  name: string;
  provider: 'cloudbase' | 'supabase';
}

interface ListUsersOptions {
  page: number;
  limit: number;
  search?: string;
  subscriptionType?: string;
}

interface VersionInput {
  platform: string;
  version: string;
  buildNumber?: number;
  fileUrl: string;
  fileSize?: number;
  changelog?: string;
  forceUpdate?: boolean;
}

interface UpdateVersionInput {
  platform?: string;
  version?: string;
  buildNumber?: number;
  fileUrl?: string;
  fileSize?: number;
  changelog?: string;
  forceUpdate?: boolean;
  isActive?: boolean;
}

const VERSION_EXTENSIONS = ['.apk', '.ipa', '.dmg', '.exe', '.hap', '.zip', '.msi'];
const MAX_UPLOAD_SIZE = 500 * 1024 * 1024;

function toSafeString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function toSafeNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toSafeBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeSubscriptionType(value: unknown, fallback = 'free') {
  const candidate = toSafeString(value, fallback).toLowerCase();
  if (['free', 'pro', 'enterprise'].includes(candidate)) {
    return candidate;
  }
  return fallback;
}

function normalizeRole(value: unknown, fallback = 'user') {
  return toSafeString(value, fallback).toLowerCase() === 'admin' ? 'admin' : 'user';
}

function formatDate(value: unknown) {
  const raw = toSafeString(value);
  if (!raw) {
    return '';
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString();
}

function buildNickname(source: {
  nickname?: unknown;
  name?: unknown;
  full_name?: unknown;
  email?: unknown;
}) {
  const email = toSafeString(source.email);
  return (
    toSafeString(source.nickname) ||
    toSafeString(source.name) ||
    toSafeString(source.full_name) ||
    (email.includes('@') ? email.split('@')[0] : email) ||
    'User'
  );
}

function paginate<T>(items: T[], page: number, limit: number) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, limit);
  const offset = (safePage - 1) * safeLimit;
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));

  return {
    items: items.slice(offset, offset + safeLimit),
    total,
    page: safePage,
    limit: safeLimit,
    totalPages,
  };
}

function matchUserSearch(user: AdminManagedUser, keyword: string) {
  if (!keyword.trim()) {
    return true;
  }

  const normalized = keyword.trim().toLowerCase();
  return [user.email, user.nickname, user.phone || '']
    .join(' ')
    .toLowerCase()
    .includes(normalized);
}

function sortUsersDesc(users: AdminManagedUser[]) {
  return [...users].sort((left, right) =>
    toSafeString(right.created_at).localeCompare(toSafeString(left.created_at)),
  );
}

function normalizeVersionRecord(record: RawRecord): AdminManagedVersion {
  return {
    id: toSafeString(record.id || record._id),
    platform: toSafeString(record.platform),
    version: toSafeString(record.version),
    buildNumber: toSafeNumber(record.build_number ?? record.buildNumber, 1),
    fileUrl: toSafeString(record.file_url ?? record.fileUrl),
    fileSize: toSafeNumber(record.file_size ?? record.fileSize),
    changelog: toSafeString(record.changelog),
    forceUpdate: toSafeBoolean(record.force_update ?? record.forceUpdate),
    isActive: toSafeBoolean(record.is_active ?? record.isActive, true),
    createdAt: formatDate(record.created_at ?? record.createdAt),
  };
}

function getProxyDownloadUrl(filePath: string, fileName: string) {
  const params = new URLSearchParams({
    path: filePath,
    name: fileName,
  });
  return `/api/admin/upload?${params.toString()}`;
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '-');
}

function getContentTypeFromName(fileName: string, fallback = 'application/octet-stream') {
  const ext = path.extname(fileName).toLowerCase();
  const mapping: Record<string, string> = {
    '.apk': 'application/vnd.android.package-archive',
    '.ipa': 'application/octet-stream',
    '.dmg': 'application/x-apple-diskimage',
    '.exe': 'application/vnd.microsoft.portable-executable',
    '.hap': 'application/zip',
    '.zip': 'application/zip',
    '.msi': 'application/x-msdownload',
  };
  return mapping[ext] || fallback;
}

async function safeSupabaseRows<T>(
  factory: () => Promise<{ data: T[] | null; error: any }>,
): Promise<T[]> {
  try {
    const { data, error } = await factory();
    if (error) {
      return [];
    }
    return data || [];
  } catch {
    return [];
  }
}

async function safeSupabaseSingle<T>(
  factory: () => Promise<{ data: T | null; error: any }>,
): Promise<T | null> {
  try {
    const { data, error } = await factory();
    if (error) {
      return null;
    }
    return data || null;
  } catch {
    return null;
  }
}

async function safeSupabaseCount(
  factory: () => Promise<{ count: number | null; error: any }>,
): Promise<number> {
  try {
    const { count, error } = await factory();
    if (error) {
      return 0;
    }
    return count || 0;
  } catch {
    return 0;
  }
}

async function trySupabaseMutation(factory: () => Promise<{ error: any }>) {
  try {
    await factory();
  } catch {
    // Compatibility writes are best effort.
  }
}

async function loadIntlAuthUsers() {
  const users: RawRecord[] = [];

  try {
    let page = 1;
    let lastPage = 1;

    while (page <= lastPage) {
      const { data, error } = await getSupabaseAdmin().auth.admin.listUsers({
        page,
        perPage: 200,
      });

      if (error) {
        break;
      }

      users.push(...(data.users || []));
      lastPage = data.lastPage || 1;
      page += 1;
    }
  } catch {
    return [];
  }

  return users;
}

async function loadIntlUserRows() {
  return safeSupabaseRows<RawRecord>(() =>
    getSupabaseAdmin()
      .from('users')
      .select('id,email,phone,nickname,avatar,subscription_type,role,created_at,updated_at,last_login_at')
      .order('created_at', { ascending: false }),
  );
}

async function loadIntlProfileRows() {
  return safeSupabaseRows<RawRecord>(() =>
    getSupabaseAdmin()
      .from('user_profiles')
      .select('id,email,full_name,avatar_url,subscription_plan,subscription_status,created_at,updated_at'),
  );
}

async function loadIntlSubscriptionRows() {
  return safeSupabaseRows<RawRecord>(() =>
    getSupabaseAdmin()
      .from('subscriptions')
      .select('id,user_id,plan_id,status,current_period_end,created_at,updated_at')
      .order('updated_at', { ascending: false }),
  );
}

function buildIntlUserSummary(input: {
  auth?: RawRecord;
  table?: RawRecord;
  profile?: RawRecord;
  subscription?: RawRecord;
}): AdminManagedUser {
  const metadata = (input.auth?.user_metadata || {}) as RawRecord;
  const email =
    toSafeString(input.auth?.email) ||
    toSafeString(input.table?.email) ||
    toSafeString(input.profile?.email);

  return {
    id: toSafeString(
      input.auth?.id || input.table?.id || input.profile?.id || input.subscription?.user_id,
    ),
    email,
    nickname: buildNickname({
      nickname:
        input.table?.nickname ||
        metadata.displayName ||
        metadata.full_name ||
        metadata.name,
      name: metadata.name,
      full_name: input.profile?.full_name,
      email,
    }),
    subscription_type: normalizeSubscriptionType(
      input.table?.subscription_type ||
        input.profile?.subscription_plan ||
        input.subscription?.plan_id ||
        metadata.subscription_type ||
        metadata.subscription_plan ||
        (metadata.pro ? 'pro' : undefined),
    ),
    created_at: formatDate(
      input.auth?.created_at || input.table?.created_at || input.profile?.created_at,
    ),
    updated_at: formatDate(
      input.table?.updated_at || input.profile?.updated_at || input.auth?.updated_at,
    ),
    last_login_at: formatDate(input.auth?.last_sign_in_at || input.table?.last_login_at),
    role: normalizeRole(input.table?.role || metadata.role),
    avatar:
      toSafeString(input.table?.avatar) ||
      toSafeString(input.profile?.avatar_url) ||
      toSafeString(metadata.avatar) ||
      toSafeString(metadata.avatar_url),
    phone: toSafeString(input.table?.phone) || toSafeString(metadata.phone),
    is_banned: toSafeBoolean(metadata.is_banned),
  };
}

async function loadIntlUsers(): Promise<AdminManagedUser[]> {
  const [authUsers, tableUsers, profiles, subscriptions] = await Promise.all([
    loadIntlAuthUsers(),
    loadIntlUserRows(),
    loadIntlProfileRows(),
    loadIntlSubscriptionRows(),
  ]);

  const map = new Map<
    string,
    { auth?: RawRecord; table?: RawRecord; profile?: RawRecord; subscription?: RawRecord }
  >();

  for (const authUser of authUsers) {
    map.set(authUser.id, { ...(map.get(authUser.id) || {}), auth: authUser });
  }

  for (const row of tableUsers) {
    map.set(row.id, { ...(map.get(row.id) || {}), table: row });
  }

  for (const row of profiles) {
    map.set(row.id, { ...(map.get(row.id) || {}), profile: row });
  }

  for (const row of subscriptions) {
    const userId = toSafeString(row.user_id);
    if (!userId || map.get(userId)?.subscription) {
      continue;
    }
    map.set(userId, { ...(map.get(userId) || {}), subscription: row });
  }

  return sortUsersDesc(
    Array.from(map.values())
      .map((item) => buildIntlUserSummary(item))
      .filter((item) => Boolean(item.id)),
  );
}

async function loadChinaUsers(): Promise<AdminManagedUser[]> {
  try {
    const db = getDatabase();
    const result = await db.collection('web_users').orderBy('created_at', 'desc').get();

    return sortUsersDesc(
      (result.data || []).map((row: RawRecord) => ({
        id: toSafeString(row._id || row.id),
        email: toSafeString(row.email),
        nickname: buildNickname({
          nickname: row.nickname,
          name: row.name,
          full_name: row.full_name,
          email: row.email,
        }),
        subscription_type: normalizeSubscriptionType(
          row.subscription_plan || (row.pro ? 'pro' : 'free'),
        ),
        created_at: formatDate(row.created_at),
        updated_at: formatDate(row.updated_at),
        last_login_at: formatDate(row.last_login_at),
        role: normalizeRole(row.role),
        avatar: toSafeString(row.avatar || row.avatar_url),
        phone: toSafeString(row.phone),
        is_banned: toSafeBoolean(row.is_banned),
      })),
    );
  } catch {
    return [];
  }
}

async function loadManagedUsers() {
  return isChinaRegion() ? loadChinaUsers() : loadIntlUsers();
}

export async function listAdminUsers(options: ListUsersOptions) {
  const users = await loadManagedUsers();
  const filtered = users.filter((user) => {
    if (options.subscriptionType && options.subscriptionType !== 'all') {
      if (normalizeSubscriptionType(user.subscription_type) !== options.subscriptionType) {
        return false;
      }
    }
    return matchUserSearch(user, options.search || '');
  });

  const paginated = paginate(filtered, options.page, options.limit);
  return {
    users: paginated.items,
    total: paginated.total,
    page: paginated.page,
    limit: paginated.limit,
    totalPages: paginated.totalPages,
  };
}

async function getChinaUserDetails(id: string): Promise<AdminManagedUserDetails | null> {
  const users = await loadChinaUsers();
  const user = users.find((item) => item.id === id);
  if (!user) {
    return null;
  }

  const db = getDatabase();
  const [contractsResult, paymentsResult, securityLogsResult] = await Promise.all([
    db.collection('contracts').where({ user_id: id }).get().catch(() => ({ data: [] })),
    db
      .collection('payments')
      .where({ user_id: id })
      .orderBy('created_at', 'desc')
      .limit(10)
      .get()
      .catch(() => ({ data: [] })),
    db
      .collection('security_logs')
      .where({ user_id: id })
      .orderBy('created_at', 'desc')
      .limit(20)
      .get()
      .catch(() => ({ data: [] })),
  ]);

  return {
    user,
    contractCount: (contractsResult.data || []).length,
    orders: (paymentsResult.data || []).map((item: RawRecord) => ({
      id: toSafeString(item._id || item.id),
      plan_type: toSafeString(item.product_type || item.plan_type || item.metadata?.plan),
      amount: toSafeNumber(item.amount),
      status: toSafeString(item.status),
      currency: toSafeString(item.currency, 'CNY'),
      payment_method: toSafeString(item.payment_method || item.method),
      created_at: formatDate(item.created_at),
    })),
    recentLogs: (securityLogsResult.data || []).map((item: RawRecord) => ({
      id: toSafeString(item._id || item.id),
      action: toSafeString(item.event || item.message),
      created_at: formatDate(item.created_at),
    })),
  };
}

async function getIntlUserDetails(id: string): Promise<AdminManagedUserDetails | null> {
  const users = await loadIntlUsers();
  const user = users.find((item) => item.id === id);
  if (!user) {
    return null;
  }

  const [contractCount, payments, orders, recentLogs] = await Promise.all([
    safeSupabaseCount(() =>
      getSupabaseAdmin()
        .from('contracts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', id),
    ),
    safeSupabaseRows<RawRecord>(() =>
      getSupabaseAdmin()
        .from('payments')
        .select('id,amount,currency,status,payment_method,subscription_id,transaction_id,created_at')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(10),
    ),
    safeSupabaseRows<RawRecord>(() =>
      getSupabaseAdmin()
        .from('orders')
        .select('id,plan_type,amount,status,currency,payment_method,created_at')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(10),
    ),
    safeSupabaseRows<RawRecord>(() =>
      getSupabaseAdmin()
        .from('usage_logs')
        .select('id,action,created_at')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(20),
    ),
  ]);

  const normalizedOrders =
    payments.length > 0
      ? payments.map((item) => ({
          id: toSafeString(item.id),
          plan_type: toSafeString(item.subscription_id || 'subscription'),
          amount: toSafeNumber(item.amount),
          status: toSafeString(item.status),
          currency: toSafeString(item.currency, 'USD'),
          payment_method: toSafeString(item.payment_method),
          created_at: formatDate(item.created_at),
        }))
      : orders.map((item) => ({
          id: toSafeString(item.id),
          plan_type: toSafeString(item.plan_type),
          amount: toSafeNumber(item.amount),
          status: toSafeString(item.status),
          currency: toSafeString(item.currency, 'USD'),
          payment_method: toSafeString(item.payment_method),
          created_at: formatDate(item.created_at),
        }));

  return {
    user,
    contractCount,
    orders: normalizedOrders,
    recentLogs: recentLogs.map((item) => ({
      id: toSafeString(item.id),
      action: toSafeString(item.action),
      created_at: formatDate(item.created_at),
    })),
  };
}

export async function getAdminUserDetails(id: string) {
  return isChinaRegion() ? getChinaUserDetails(id) : getIntlUserDetails(id);
}

export async function updateAdminUser(id: string, payload: Partial<AdminManagedUser>) {
  if (isChinaRegion()) {
    const db = getDatabase();
    const updateData: RawRecord = {
      updated_at: new Date().toISOString(),
    };

    if (payload.nickname !== undefined) {
      updateData.name = payload.nickname;
      updateData.nickname = payload.nickname;
    }
    if (payload.avatar !== undefined) {
      updateData.avatar = payload.avatar;
    }
    if (payload.phone !== undefined) {
      updateData.phone = payload.phone;
    }
    if (payload.subscription_type !== undefined) {
      const plan = normalizeSubscriptionType(payload.subscription_type);
      updateData.subscription_plan = plan;
      updateData.pro = plan !== 'free';
    }
    if (payload.role !== undefined) {
      updateData.role = normalizeRole(payload.role);
    }
    if (payload.is_banned !== undefined) {
      updateData.is_banned = payload.is_banned;
    }

    await db.collection('web_users').doc(id).update(updateData);
    return getAdminUserDetails(id);
  }

  let rawAuthUser: RawRecord | null = null;
  try {
    const { data } = await getSupabaseAdmin().auth.admin.getUserById(id);
    rawAuthUser = (data as any)?.user || null;
  } catch {
    rawAuthUser = null;
  }

  const metadata = (rawAuthUser?.user_metadata || {}) as RawRecord;
  const nextMetadata: RawRecord = { ...metadata };

  if (payload.nickname !== undefined) {
    nextMetadata.displayName = payload.nickname;
    nextMetadata.full_name = payload.nickname;
    nextMetadata.name = payload.nickname;
  }
  if (payload.avatar !== undefined) {
    nextMetadata.avatar = payload.avatar;
    nextMetadata.avatar_url = payload.avatar;
  }
  if (payload.phone !== undefined) {
    nextMetadata.phone = payload.phone;
  }
  if (payload.subscription_type !== undefined) {
    const plan = normalizeSubscriptionType(payload.subscription_type);
    nextMetadata.subscription_type = plan;
    nextMetadata.subscription_plan = plan;
  }
  if (payload.role !== undefined) {
    nextMetadata.role = normalizeRole(payload.role);
  }
  if (payload.is_banned !== undefined) {
    nextMetadata.is_banned = payload.is_banned;
  }

  if (rawAuthUser?.id) {
    await getSupabaseAdmin().auth.admin.updateUserById(id, {
      user_metadata: nextMetadata,
    });
  }

  const usersUpdate: RawRecord = {
    updated_at: new Date().toISOString(),
  };
  if (payload.nickname !== undefined) usersUpdate.nickname = payload.nickname;
  if (payload.avatar !== undefined) usersUpdate.avatar = payload.avatar;
  if (payload.phone !== undefined) usersUpdate.phone = payload.phone;
  if (payload.subscription_type !== undefined) {
    usersUpdate.subscription_type = normalizeSubscriptionType(payload.subscription_type);
  }
  if (payload.role !== undefined) usersUpdate.role = normalizeRole(payload.role);

  await trySupabaseMutation(() =>
    getSupabaseAdmin().from('users').update(usersUpdate).eq('id', id),
  );

  await trySupabaseMutation(() =>
    getSupabaseAdmin().from('user_profiles').upsert(
      {
        id,
        email: payload.email,
        full_name: payload.nickname,
        avatar_url: payload.avatar,
        subscription_plan:
          payload.subscription_type !== undefined
            ? normalizeSubscriptionType(payload.subscription_type)
            : undefined,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    ),
  );

  return getAdminUserDetails(id);
}

export async function deleteAdminUser(id: string) {
  if (isChinaRegion()) {
    const db = getDatabase();
    await db.collection('web_users').doc(id).remove();
    return;
  }

  try {
    await getSupabaseAdmin().auth.admin.deleteUser(id);
  } catch {
    // Keep removing compatibility rows even when auth user is gone.
  }

  await trySupabaseMutation(() => getSupabaseAdmin().from('users').delete().eq('id', id));
  await trySupabaseMutation(() =>
    getSupabaseAdmin().from('user_profiles').delete().eq('id', id),
  );
}

async function deactivateVersionsByPlatform(platform: string, excludeId?: string) {
  if (isChinaRegion()) {
    const db = getDatabase();
    const result = await db.collection('app_versions').where({ platform }).get();
    const rows = (result.data || []).filter((item: RawRecord) => {
      const currentId = toSafeString(item._id || item.id);
      return currentId && currentId !== excludeId && toSafeBoolean(item.is_active, true);
    });

    await Promise.all(
      rows.map((item: RawRecord) =>
        db.collection('app_versions').doc(item._id || item.id).update({
          is_active: false,
          updated_at: new Date().toISOString(),
        }),
      ),
    );
    return;
  }

  let query = getSupabaseAdmin()
    .from('app_versions')
    .update({ is_active: false })
    .eq('platform', platform);
  if (excludeId) {
    query = query.neq('id', excludeId);
  }
  await query;
}

export async function listAdminVersions(): Promise<AdminManagedVersion[]> {
  if (isChinaRegion()) {
    try {
      const db = getDatabase();
      const result = await db.collection('app_versions').orderBy('created_at', 'desc').get();
      return (result.data || []).map((item: RawRecord) => normalizeVersionRecord(item));
    } catch {
      return [];
    }
  }

  const rows = await safeSupabaseRows<RawRecord>(() =>
    getSupabaseAdmin()
      .from('app_versions')
      .select('id,platform,version,build_number,file_url,file_size,changelog,force_update,is_active,created_at')
      .order('created_at', { ascending: false }),
  );

  return rows.map((item) => normalizeVersionRecord(item));
}

async function getAdminVersionById(id: string): Promise<AdminManagedVersion | null> {
  if (isChinaRegion()) {
    try {
      const db = getDatabase();
      const result = await db.collection('app_versions').doc(id).get();
      const record = result?.data?.[0];
      return record ? normalizeVersionRecord(record) : null;
    } catch {
      return null;
    }
  }

  const row = await safeSupabaseSingle<RawRecord>(() =>
    getSupabaseAdmin()
      .from('app_versions')
      .select('id,platform,version,build_number,file_url,file_size,changelog,force_update,is_active,created_at')
      .eq('id', id)
      .single(),
  );

  return row ? normalizeVersionRecord(row) : null;
}

export async function createAdminVersion(input: VersionInput) {
  const payload = {
    platform: input.platform,
    version: input.version,
    build_number: toSafeNumber(input.buildNumber, 1),
    file_url: input.fileUrl,
    file_size: toSafeNumber(input.fileSize),
    changelog: input.changelog || '',
    force_update: Boolean(input.forceUpdate),
    is_active: true,
    created_at: new Date().toISOString(),
  };

  await deactivateVersionsByPlatform(input.platform);

  if (isChinaRegion()) {
    const db = getDatabase();
    const result = await db.collection('app_versions').add({
      ...payload,
      updated_at: payload.created_at,
    });
    return getAdminVersionById(result.id);
  }

  const { data, error } = await getSupabaseAdmin()
    .from('app_versions')
    .insert(payload)
    .select('id,platform,version,build_number,file_url,file_size,changelog,force_update,is_active,created_at')
    .single();

  if (error) {
    throw error;
  }

  return data ? normalizeVersionRecord(data) : null;
}

export async function updateAdminVersion(id: string, input: UpdateVersionInput) {
  const current = await getAdminVersionById(id);
  if (!current) {
    return null;
  }

  const nextPlatform = input.platform || current.platform;
  if (input.isActive) {
    await deactivateVersionsByPlatform(nextPlatform, id);
  }

  if (isChinaRegion()) {
    const db = getDatabase();
    const updateData: RawRecord = {
      updated_at: new Date().toISOString(),
    };

    if (input.version !== undefined) updateData.version = input.version;
    if (input.buildNumber !== undefined) updateData.build_number = toSafeNumber(input.buildNumber, 1);
    if (input.fileUrl !== undefined) updateData.file_url = input.fileUrl;
    if (input.fileSize !== undefined) updateData.file_size = toSafeNumber(input.fileSize);
    if (input.changelog !== undefined) updateData.changelog = input.changelog;
    if (input.forceUpdate !== undefined) updateData.force_update = Boolean(input.forceUpdate);
    if (input.isActive !== undefined) updateData.is_active = Boolean(input.isActive);

    await db.collection('app_versions').doc(id).update(updateData);
    return getAdminVersionById(id);
  }

  const updateData: RawRecord = {};
  if (input.version !== undefined) updateData.version = input.version;
  if (input.buildNumber !== undefined) updateData.build_number = toSafeNumber(input.buildNumber, 1);
  if (input.fileUrl !== undefined) updateData.file_url = input.fileUrl;
  if (input.fileSize !== undefined) updateData.file_size = toSafeNumber(input.fileSize);
  if (input.changelog !== undefined) updateData.changelog = input.changelog;
  if (input.forceUpdate !== undefined) updateData.force_update = Boolean(input.forceUpdate);
  if (input.isActive !== undefined) updateData.is_active = Boolean(input.isActive);

  const { error } = await getSupabaseAdmin().from('app_versions').update(updateData).eq('id', id);
  if (error) {
    throw error;
  }

  return getAdminVersionById(id);
}

export async function deleteAdminVersion(id: string) {
  if (isChinaRegion()) {
    const db = getDatabase();
    await db.collection('app_versions').doc(id).remove();
    return;
  }

  const { error } = await getSupabaseAdmin().from('app_versions').delete().eq('id', id);
  if (error) {
    throw error;
  }
}

export async function uploadAdminFile(file: File, folder = 'app-releases'): Promise<AdminUploadedFile> {
  if (!file) {
    throw new Error('No file selected');
  }

  const extension = path.extname(file.name).toLowerCase();
  if (!VERSION_EXTENSIONS.includes(extension)) {
    throw new Error('Unsupported file type');
  }

  if (file.size > MAX_UPLOAD_SIZE) {
    throw new Error('File size exceeds 500MB limit');
  }

  const sanitizedName = sanitizeFileName(file.name);
  const uploadKey = `${folder}/${Date.now()}-${sanitizedName}`;
  const content = Buffer.from(await file.arrayBuffer());

  if (isChinaRegion()) {
    const uploaded = await uploadFileToCloudBase(uploadKey, content);
    return {
      path: uploaded.fileID,
      url: getProxyDownloadUrl(uploaded.fileID, sanitizedName),
      size: file.size,
      name: file.name,
      provider: 'cloudbase',
    };
  }

  const { data, error } = await getSupabaseAdmin().storage.from('files').upload(uploadKey, content, {
    contentType: file.type || getContentTypeFromName(file.name),
    cacheControl: '3600',
    upsert: false,
  });

  if (error) {
    throw error;
  }

  const { data: urlData } = getSupabaseAdmin().storage.from('files').getPublicUrl(uploadKey);
  return {
    path: data.path,
    url: urlData.publicUrl,
    size: file.size,
    name: file.name,
    provider: 'supabase',
  };
}

export async function deleteAdminUploadedFile(pathValue: string) {
  if (!pathValue) {
    return;
  }

  if (isChinaRegion()) {
    await deleteFileFromCloudBase([pathValue]);
    return;
  }

  const { error } = await getSupabaseAdmin().storage.from('files').remove([pathValue]);
  if (error) {
    throw error;
  }
}

export function resolveDownloadContentType(fileName?: string) {
  return getContentTypeFromName(fileName || '');
}
