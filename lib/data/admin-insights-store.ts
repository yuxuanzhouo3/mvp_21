import { getDatabase } from '@/lib/cloudbase/cloudbase-service';
import { isChinaRegion } from '@/lib/config/region';
import { getSupabaseAdmin } from '@/lib/integrations/supabase-admin';

type AdminUserSummary = {
  id: string;
  email: string;
  nickname: string;
  subscription_type: string;
  created_at: string;
  updated_at?: string;
  last_login_at?: string;
};

type TimelinePoint = {
  date: string;
  count?: number;
  amount?: number;
};

type DistributionPoint = {
  name: string;
  value: number;
};

type AdTrendPoint = {
  date: string;
  impressions: number;
  clicks: number;
  ctr: string;
};

type AdStats = {
  totalImpressions: number;
  totalClicks: number;
  ctr: string;
  revenue: number;
};

export interface AdminStatsPayload {
  stats: {
    totalUsers: number;
    newUsersToday: number;
    activeUsers: number;
    totalContracts: number;
    contractsToday: number;
    paidUsers: number;
    revenue: number;
    adImpressions: number;
    adClicks: number;
    adRevenue: number;
  };
  recentUsers: Array<{
    id: string;
    email: string;
    nickname: string;
    subscription_type: string;
    created_at: string;
  }>;
}

export interface AdminAnalyticsPayload {
  userTrend: Array<{ date: string; count: number }>;
  contractTrend: Array<{ date: string; count: number }>;
  revenueTrend: Array<{ date: string; amount: number }>;
  subscriptionChart: DistributionPoint[];
  contractTypeChart: DistributionPoint[];
  paymentMethodChart: DistributionPoint[];
  stats: {
    activeUsers7d: number;
    totalUsers: number;
    activeRate: string;
  };
}

export interface AdminAdsPayload {
  stats: AdStats;
  trend: AdTrendPoint[];
}

export interface AdminAdRecord {
  id: string;
  name: string;
  position: string;
  type: string;
  content: string;
  link: string;
  status: string;
  start_date?: string | null;
  end_date?: string | null;
  impressions?: number;
  clicks?: number;
  revenue?: number;
  created_at?: string;
  updated_at?: string;
}

function normalizeAdminAdRecord(record: Record<string, any>): AdminAdRecord {
  return {
    id: record._id || record.id,
    name: toSafeString(record.name),
    position: toSafeString(record.position),
    type: toSafeString(record.type),
    content: toSafeString(record.content),
    link: toSafeString(record.link),
    status: toSafeString(record.status),
    start_date: toSafeString(record.start_date) || null,
    end_date: toSafeString(record.end_date) || null,
    impressions: toNumber(record.impressions),
    clicks: toNumber(record.clicks),
    revenue: toNumber(record.revenue),
    created_at: toSafeString(record.created_at),
    updated_at: toSafeString(record.updated_at),
  };
}

function buildAdminAdMutationPayload(data: Partial<AdminAdRecord>) {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (data.name !== undefined) payload.name = toSafeString(data.name);
  if (data.position !== undefined) payload.position = toSafeString(data.position);
  if (data.type !== undefined) payload.type = toSafeString(data.type);
  if (data.content !== undefined) payload.content = toSafeString(data.content);
  if (data.link !== undefined) payload.link = toSafeString(data.link);
  if (data.status !== undefined) payload.status = toSafeString(data.status, "draft");
  if (data.start_date !== undefined) payload.start_date = data.start_date || null;
  if (data.end_date !== undefined) payload.end_date = data.end_date || null;
  if (data.impressions !== undefined) payload.impressions = toNumber(data.impressions);
  if (data.clicks !== undefined) payload.clicks = toNumber(data.clicks);
  if (data.revenue !== undefined) payload.revenue = toNumber(data.revenue);

  return payload;
}

function startOfDay(date: Date) {
  const cloned = new Date(date);
  cloned.setHours(0, 0, 0, 0);
  return cloned;
}

function addDays(date: Date, days: number) {
  const cloned = new Date(date);
  cloned.setDate(cloned.getDate() + days);
  return cloned;
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildDateSeries(days: number) {
  const today = startOfDay(new Date());
  return Array.from({ length: days }, (_, index) =>
    formatDateKey(addDays(today, index - days + 1)),
  );
}

function toNumber(value: unknown) {
  return typeof value === 'number' ? value : Number(value || 0);
}

function toSafeString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function isWithinRange(value: unknown, startDate: Date) {
  if (!value || typeof value !== 'string') {
    return false;
  }

  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed >= startDate;
}

function bucketCountsByDate<T>(
  rows: T[],
  dateResolver: (row: T) => string | undefined,
  days: number,
) {
  const template = new Map<string, number>(
    buildDateSeries(days).map((date) => [date, 0]),
  );

  for (const row of rows) {
    const rawDate = dateResolver(row);
    if (!rawDate) {
      continue;
    }

    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) {
      continue;
    }

    const key = formatDateKey(parsed);
    if (template.has(key)) {
      template.set(key, (template.get(key) || 0) + 1);
    }
  }

  return Array.from(template.entries()).map(([date, count]) => ({ date, count }));
}

function bucketAmountByDate<T>(
  rows: T[],
  dateResolver: (row: T) => string | undefined,
  amountResolver: (row: T) => number,
  days: number,
) {
  const template = new Map<string, number>(
    buildDateSeries(days).map((date) => [date, 0]),
  );

  for (const row of rows) {
    const rawDate = dateResolver(row);
    if (!rawDate) {
      continue;
    }

    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) {
      continue;
    }

    const key = formatDateKey(parsed);
    if (template.has(key)) {
      template.set(key, (template.get(key) || 0) + amountResolver(row));
    }
  }

  return Array.from(template.entries()).map(([date, amount]) => ({
    date,
    amount: Number(amount.toFixed(2)),
  }));
}

function countByName(values: string[]) {
  const counters = new Map<string, number>();

  for (const value of values) {
    counters.set(value, (counters.get(value) || 0) + 1);
  }

  return Array.from(counters.entries()).map(([name, value]) => ({ name, value }));
}

async function safeSupabaseSelect<T>(
  queryFactory: () => Promise<{ data: T[] | null; error: any }>,
) {
  try {
    const { data, error } = await queryFactory();
    if (error) {
      return [] as T[];
    }
    return data || [];
  } catch {
    return [] as T[];
  }
}

async function safeSupabaseCount(
  queryFactory: () => Promise<{ count: number | null; error: any }>,
) {
  try {
    const { count, error } = await queryFactory();
    if (error) {
      return 0;
    }
    return count || 0;
  } catch {
    return 0;
  }
}

async function loadIntlUsersFromTable() {
  const rows = await safeSupabaseSelect<Record<string, any>>(() =>
    getSupabaseAdmin()
      .from('users')
      .select('id,email,nickname,subscription_type,subscription_plan,created_at,updated_at,last_login_at')
      .order('created_at', { ascending: false }),
  );

  return rows.map<AdminUserSummary>((row) => ({
    id: row.id,
    email: toSafeString(row.email),
    nickname:
      toSafeString(row.nickname) ||
      toSafeString(row.full_name) ||
      toSafeString(row.email).split('@')[0] ||
      'User',
    subscription_type:
      toSafeString(row.subscription_type) ||
      toSafeString(row.subscription_plan) ||
      'free',
    created_at: toSafeString(row.created_at),
    updated_at: toSafeString(row.updated_at),
    last_login_at: toSafeString(row.last_login_at),
  }));
}

async function loadIntlUsersFromAuth() {
  try {
    let page = 1;
    let lastPage = 1;
    const users: AdminUserSummary[] = [];

    while (page <= lastPage) {
      const { data, error } = await getSupabaseAdmin().auth.admin.listUsers({
        page,
        perPage: 200,
      });

      if (error) {
        break;
      }

      lastPage = data.lastPage || 1;

      for (const user of data.users || []) {
        const metadata = user.user_metadata || {};
        users.push({
          id: user.id,
          email: user.email || '',
          nickname:
            toSafeString(metadata.displayName) ||
            toSafeString(metadata.full_name) ||
            toSafeString(metadata.name) ||
            toSafeString(user.email).split('@')[0] ||
            'User',
          subscription_type:
            toSafeString(metadata.subscription_type) ||
            toSafeString(metadata.subscription_plan) ||
            (metadata.pro ? 'pro' : 'free'),
          created_at: toSafeString(user.created_at),
          updated_at: toSafeString(user.updated_at),
          last_login_at: toSafeString(user.last_sign_in_at),
        });
      }

      page += 1;
    }

    return users.sort((left, right) =>
      toSafeString(right.created_at).localeCompare(toSafeString(left.created_at)),
    );
  } catch {
    return [] as AdminUserSummary[];
  }
}

async function loadIntlUsers() {
  const tableUsers = await loadIntlUsersFromTable();
  if (tableUsers.length > 0) {
    return tableUsers;
  }
  return loadIntlUsersFromAuth();
}

async function loadChinaUsers() {
  try {
    const db = getDatabase();
    const result = await db.collection('web_users').orderBy('created_at', 'desc').get();

    return (result.data || []).map(
      (row: Record<string, any>): AdminUserSummary => ({
        id: row._id || row.id,
        email: toSafeString(row.email),
        nickname:
          toSafeString(row.name) ||
          toSafeString(row.nickname) ||
          toSafeString(row.email).split('@')[0] ||
          'User',
        subscription_type:
          toSafeString(row.subscription_plan) ||
          (row.pro ? 'pro' : 'free'),
        created_at: toSafeString(row.created_at),
        updated_at: toSafeString(row.updated_at),
        last_login_at: toSafeString(row.last_login_at),
      }),
    );
  } catch {
    return [] as AdminUserSummary[];
  }
}

async function loadAdminUsers() {
  return isChinaRegion() ? loadChinaUsers() : loadIntlUsers();
}

async function loadChinaContractsSince(startDate?: Date) {
  try {
    const db = getDatabase();
    let query = db.collection('contracts');
    if (startDate) {
      query = query.where({
        created_at: db.command.gte(startDate.toISOString()),
      });
    }

    const result = await query.get();
    return result.data || [];
  } catch {
    return [] as Record<string, any>[];
  }
}

async function loadIntlContractsSince(startDate?: Date) {
  return safeSupabaseSelect<Record<string, any>>(() => {
    let query = getSupabaseAdmin()
      .from('contracts')
      .select('id,user_id,type,created_at,updated_at');

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }

    return query.order('created_at', { ascending: true });
  });
}

async function loadAdminContractsSince(startDate?: Date) {
  return isChinaRegion()
    ? loadChinaContractsSince(startDate)
    : loadIntlContractsSince(startDate);
}

async function loadChinaPaymentsSince(startDate?: Date) {
  try {
    const db = getDatabase();
    let query = db.collection('payments');

    if (startDate) {
      query = query.where({
        created_at: db.command.gte(startDate.toISOString()),
      });
    }

    const result = await query.get();
    return (result.data || []).filter(
      (row: Record<string, any>) => toSafeString(row.status) === 'completed',
    );
  } catch {
    return [] as Record<string, any>[];
  }
}

async function loadIntlPaymentsSince(startDate?: Date) {
  const payments = await safeSupabaseSelect<Record<string, any>>(() => {
    let query = getSupabaseAdmin()
      .from('payments')
      .select('id,user_id,amount,status,payment_method,currency,created_at');

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }

    return query.eq('status', 'completed').order('created_at', { ascending: true });
  });

  if (payments.length > 0) {
    return payments;
  }

  const orders = await safeSupabaseSelect<Record<string, any>>(() => {
    let query = getSupabaseAdmin()
      .from('orders')
      .select('id,user_id,amount,status,payment_method,currency,created_at');

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }

    return query.eq('status', 'paid').order('created_at', { ascending: true });
  });

  return orders.map((row) => ({
    ...row,
    status: 'completed',
  }));
}

async function loadAdminPaymentsSince(startDate?: Date) {
  return isChinaRegion()
    ? loadChinaPaymentsSince(startDate)
    : loadIntlPaymentsSince(startDate);
}

async function loadChinaSubscriptions() {
  try {
    const db = getDatabase();
    const result = await db.collection('subscriptions').get();
    return result.data || [];
  } catch {
    return [] as Record<string, any>[];
  }
}

async function loadIntlSubscriptions() {
  return safeSupabaseSelect<Record<string, any>>(() =>
    getSupabaseAdmin()
      .from('subscriptions')
      .select('id,user_id,plan,plan_id,status,billing_cycle,payment_method,current_period_end,created_at,updated_at'),
  );
}

async function loadAdminSubscriptions() {
  return isChinaRegion() ? loadChinaSubscriptions() : loadIntlSubscriptions();
}

function deriveActiveUserCount(
  users: AdminUserSummary[],
  contracts: Record<string, any>[],
  payments: Record<string, any>[],
  subscriptions: Record<string, any>[],
  startDate: Date,
) {
  const activeUserIds = new Set<string>();

  for (const user of users) {
    if (isWithinRange(user.last_login_at, startDate) || isWithinRange(user.updated_at, startDate)) {
      activeUserIds.add(user.id);
    }
  }

  for (const contract of contracts) {
    if (
      isWithinRange(contract.updated_at || contract.created_at, startDate) &&
      toSafeString(contract.user_id)
    ) {
      activeUserIds.add(toSafeString(contract.user_id));
    }
  }

  for (const payment of payments) {
    if (
      isWithinRange(payment.created_at, startDate) &&
      toSafeString(payment.user_id)
    ) {
      activeUserIds.add(toSafeString(payment.user_id));
    }
  }

  for (const subscription of subscriptions) {
    if (
      isWithinRange(subscription.updated_at || subscription.created_at, startDate) &&
      toSafeString(subscription.user_id)
    ) {
      activeUserIds.add(toSafeString(subscription.user_id));
    }
  }

  return activeUserIds.size;
}

function derivePaidUserCount(users: AdminUserSummary[], subscriptions: Record<string, any>[]) {
  const paidFromSubscriptions = new Set<string>();

  for (const subscription of subscriptions) {
    const plan = toSafeString(subscription.plan || subscription.plan_id);
    const status = toSafeString(subscription.status);
    const userId = toSafeString(subscription.user_id);

    if (userId && plan !== 'free' && status === 'active') {
      paidFromSubscriptions.add(userId);
    }
  }

  if (paidFromSubscriptions.size > 0) {
    return paidFromSubscriptions.size;
  }

  return users.filter((user) => ['pro', 'enterprise'].includes(user.subscription_type)).length;
}

function deriveSubscriptionDistribution(users: AdminUserSummary[], subscriptions: Record<string, any>[]) {
  if (users.length > 0) {
    return countByName(users.map((user) => user.subscription_type || 'free'));
  }

  if (subscriptions.length > 0) {
    return countByName(
      subscriptions.map((subscription) =>
        toSafeString(subscription.plan || subscription.plan_id, 'free'),
      ),
    );
  }

  return [] as DistributionPoint[];
}

function deriveContractTypeDistribution(contracts: Record<string, any>[]) {
  return countByName(contracts.map((contract) => toSafeString(contract.type, 'custom')));
}

function derivePaymentMethodDistribution(payments: Record<string, any>[]) {
  return countByName(
    payments.map((payment) => toSafeString(payment.payment_method, 'unknown')),
  );
}

async function loadChinaAdRows() {
  try {
    const db = getDatabase();
    const result = await db.collection('ads').get();
    return result.data || [];
  } catch {
    return [] as Record<string, any>[];
  }
}

async function loadIntlAdRows() {
  return safeSupabaseSelect<Record<string, any>>(() =>
    getSupabaseAdmin()
      .from('ads')
      .select('id,name,position,type,content,link,status,start_date,end_date,impressions,clicks,revenue,created_at,updated_at'),
  );
}

async function loadAdminAdRows() {
  return isChinaRegion() ? loadChinaAdRows() : loadIntlAdRows();
}

async function loadChinaAdStatsRows(days: number) {
  const startDate = addDays(startOfDay(new Date()), -days + 1);
  try {
    const db = getDatabase();
    const result = await db
      .collection('ad_stats')
      .where({
        date: db.command.gte(formatDateKey(startDate)),
      })
      .get();

    return result.data || [];
  } catch {
    return [] as Record<string, any>[];
  }
}

async function loadIntlAdStatsRows(days: number) {
  const startDate = addDays(startOfDay(new Date()), -days + 1);
  const rows = await safeSupabaseSelect<Record<string, any>>(() =>
    getSupabaseAdmin()
      .from('ad_stats')
      .select('date,impressions,clicks,revenue')
      .gte('date', formatDateKey(startDate))
      .order('date', { ascending: true }),
  );

  if (rows.length > 0) {
    return rows;
  }

  return safeSupabaseSelect<Record<string, any>>(() =>
    getSupabaseAdmin()
      .from('usage_logs')
      .select('action,created_at')
      .in('action', ['ad_impression', 'ad_click'])
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true }),
  );
}

async function loadAdminAdStatsRows(days: number) {
  return isChinaRegion() ? loadChinaAdStatsRows(days) : loadIntlAdStatsRows(days);
}

function buildAdTrend(days: number, adStatsRows: Record<string, any>[]) {
  const template = new Map<string, { impressions: number; clicks: number; revenue: number }>(
    buildDateSeries(days).map((date) => [
      date,
      { impressions: 0, clicks: 0, revenue: 0 },
    ]),
  );

  for (const row of adStatsRows) {
    if (row.action && row.created_at) {
      const key = formatDateKey(new Date(row.created_at));
      const current = template.get(key);
      if (!current) {
        continue;
      }

      if (row.action === 'ad_impression') {
        current.impressions += 1;
      }
      if (row.action === 'ad_click') {
        current.clicks += 1;
      }
      continue;
    }

    const key = toSafeString(row.date);
    const current = template.get(key);
    if (!current) {
      continue;
    }

    current.impressions += toNumber(row.impressions);
    current.clicks += toNumber(row.clicks);
    current.revenue += toNumber(row.revenue);
  }

  return Array.from(template.entries()).map(([date, stats]) => ({
    date,
    impressions: stats.impressions,
    clicks: stats.clicks,
    ctr:
      stats.impressions > 0
        ? ((stats.clicks / stats.impressions) * 100).toFixed(2)
        : '0',
  }));
}

function aggregateAdStats(adRows: Record<string, any>[], adTrend: AdTrendPoint[]) {
  const totalsFromAds = adRows.reduce(
    (accumulator, row) => ({
      impressions: accumulator.impressions + toNumber(row.impressions),
      clicks: accumulator.clicks + toNumber(row.clicks),
      revenue: accumulator.revenue + toNumber(row.revenue),
    }),
    { impressions: 0, clicks: 0, revenue: 0 },
  );

  const totalsFromTrend = adTrend.reduce(
    (accumulator, row) => ({
      impressions: accumulator.impressions + row.impressions,
      clicks: accumulator.clicks + row.clicks,
    }),
    { impressions: 0, clicks: 0 },
  );

  const impressions = Math.max(totalsFromAds.impressions, totalsFromTrend.impressions);
  const clicks = Math.max(totalsFromAds.clicks, totalsFromTrend.clicks);
  const revenue =
    totalsFromAds.revenue > 0 ? totalsFromAds.revenue : Number((clicks * 0.5).toFixed(2));

  return {
    totalImpressions: impressions,
    totalClicks: clicks,
    ctr: impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : '0',
    revenue: Number(revenue.toFixed(2)),
  };
}

export async function getAdminOverviewStats(): Promise<AdminStatsPayload> {
  const today = startOfDay(new Date());
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const sevenDaysAgo = addDays(today, -6);
  const monthDays = Math.max(
    1,
    Math.floor((today.getTime() - monthStart.getTime()) / (24 * 60 * 60 * 1000)) + 1,
  );

  const [users, recentContracts, monthPayments, recentPayments, subscriptions, adRows, adStatsRows] =
    await Promise.all([
      loadAdminUsers(),
      loadAdminContractsSince(sevenDaysAgo),
      loadAdminPaymentsSince(monthStart),
      loadAdminPaymentsSince(sevenDaysAgo),
      loadAdminSubscriptions(),
      loadAdminAdRows(),
      loadAdminAdStatsRows(monthDays),
    ]);

  const totalContracts = await (async () => {
    if (isChinaRegion()) {
      try {
        const db = getDatabase();
        const result = await db.collection('contracts').count();
        return result.total || 0;
      } catch {
        return recentContracts.length;
      }
    }

    const total = await safeSupabaseCount(() =>
      getSupabaseAdmin().from('contracts').select('id', { count: 'exact', head: true }),
    );
    return total || recentContracts.length;
  })();

  const contractsToday = recentContracts.filter((contract) =>
    isWithinRange(contract.created_at, today),
  ).length;

  const newUsersToday = users.filter((user) => isWithinRange(user.created_at, today)).length;
  const activeUsers = deriveActiveUserCount(
    users,
    recentContracts,
    recentPayments,
    subscriptions,
    sevenDaysAgo,
  );
  const paidUsers = derivePaidUserCount(users, subscriptions);
  const revenue = Number(
    monthPayments.reduce((sum, payment) => sum + toNumber(payment.amount), 0).toFixed(2),
  );
  const adTrend = buildAdTrend(monthDays, adStatsRows);
  const adStatsFromTrend = {
    totalImpressions: adTrend.reduce((sum, item) => sum + item.impressions, 0),
    totalClicks: adTrend.reduce((sum, item) => sum + item.clicks, 0),
  };
  const adStats = {
    totalImpressions:
      adStatsFromTrend.totalImpressions > 0
        ? adStatsFromTrend.totalImpressions
        : adRows.reduce((sum, row) => sum + toNumber(row.impressions), 0),
    totalClicks:
      adStatsFromTrend.totalClicks > 0
        ? adStatsFromTrend.totalClicks
        : adRows.reduce((sum, row) => sum + toNumber(row.clicks), 0),
    revenue:
      adStatsRows.length > 0
        ? Number(
            adStatsRows.reduce((sum, row) => sum + toNumber(row.revenue), 0).toFixed(2),
          )
        : Number(
            adRows
              .reduce((sum, row) => sum + toNumber(row.revenue), 0)
              .toFixed(2),
          ),
    ctr: '0',
  };
  adStats.ctr =
    adStats.totalImpressions > 0
      ? ((adStats.totalClicks / adStats.totalImpressions) * 100).toFixed(2)
      : '0';

  return {
    stats: {
      totalUsers: users.length,
      newUsersToday,
      activeUsers,
      totalContracts,
      contractsToday,
      paidUsers,
      revenue,
      adImpressions: adStats.totalImpressions,
      adClicks: adStats.totalClicks,
      adRevenue: adStats.revenue,
    },
    recentUsers: users.slice(0, 5).map((user) => ({
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      subscription_type: user.subscription_type,
      created_at: user.created_at,
    })),
  };
}

export async function getAdminAnalytics(days: number): Promise<AdminAnalyticsPayload> {
  const normalizedDays = Math.min(Math.max(days, 7), 365);
  const startDate = addDays(startOfDay(new Date()), -normalizedDays + 1);
  const activeWindowStart = addDays(startOfDay(new Date()), -6);

  const [users, contracts, payments, subscriptions] = await Promise.all([
    loadAdminUsers(),
    loadAdminContractsSince(startDate),
    loadAdminPaymentsSince(startDate),
    loadAdminSubscriptions(),
  ]);

  const activeUsers7d = deriveActiveUserCount(
    users,
    contracts,
    payments,
    subscriptions,
    activeWindowStart,
  );

  const totalUsers = users.length;
  const activeRate = totalUsers > 0 ? ((activeUsers7d / totalUsers) * 100).toFixed(1) : '0';

  return {
    userTrend: bucketCountsByDate(users, (user) => user.created_at, normalizedDays),
    contractTrend: bucketCountsByDate(
      contracts,
      (contract) => toSafeString(contract.created_at),
      normalizedDays,
    ),
    revenueTrend: bucketAmountByDate(
      payments,
      (payment) => toSafeString(payment.created_at),
      (payment) => toNumber(payment.amount),
      normalizedDays,
    ),
    subscriptionChart: deriveSubscriptionDistribution(users, subscriptions),
    contractTypeChart: deriveContractTypeDistribution(contracts),
    paymentMethodChart: derivePaymentMethodDistribution(payments),
    stats: {
      activeUsers7d,
      totalUsers,
      activeRate,
    },
  };
}

export async function getAdminAdsMetrics(days = 7): Promise<AdminAdsPayload> {
  const normalizedDays = Math.min(Math.max(days, 7), 30);
  const [adRows, adStatsRows] = await Promise.all([
    loadAdminAdRows(),
    loadAdminAdStatsRows(normalizedDays),
  ]);

  const trend = buildAdTrend(normalizedDays, adStatsRows);
  const stats = aggregateAdStats(adRows, trend);

  return {
    stats,
    trend,
  };
}

export async function listAdminAds(): Promise<AdminAdRecord[]> {
  const rows = await loadAdminAdRows();

  return rows
    .map((record) => normalizeAdminAdRecord(record))
    .sort((left, right) =>
      toSafeString(right.updated_at || right.created_at).localeCompare(
        toSafeString(left.updated_at || left.created_at),
      ),
    );
}

export async function createAdminAd(
  data: Partial<AdminAdRecord>,
): Promise<AdminAdRecord | null> {
  const now = new Date().toISOString();
  const payload = {
    name: toSafeString(data.name, "Untitled Ad"),
    position: toSafeString(data.position, "dashboard_top"),
    type: toSafeString(data.type, "banner"),
    content: toSafeString(data.content),
    link: toSafeString(data.link),
    status: toSafeString(data.status, "draft"),
    start_date: data.start_date || null,
    end_date: data.end_date || null,
    impressions: toNumber(data.impressions),
    clicks: toNumber(data.clicks),
    revenue: toNumber(data.revenue),
    created_at: now,
    updated_at: now,
  };

  if (isChinaRegion()) {
    const db = getDatabase();
    const result = await db.collection("ads").add(payload);
    return getAdminAdById(result.id);
  }

  const { data: created, error } = await getSupabaseAdmin()
    .from("ads")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return created ? normalizeAdminAdRecord(created as Record<string, any>) : null;
}

export async function getAdminAdById(id: string): Promise<AdminAdRecord | null> {
  if (isChinaRegion()) {
    try {
      const db = getDatabase();
      const result = await db.collection('ads').doc(id).get();
      const record = result?.data?.[0];
      if (!record) {
        return null;
      }
      return normalizeAdminAdRecord(record);
    } catch {
      return null;
    }
  }

  const rows = await safeSupabaseSelect<Record<string, any>>(() =>
    getSupabaseAdmin()
      .from('ads')
      .select('*')
      .eq('id', id)
      .limit(1),
  );

  const record = rows[0];
  if (!record) {
    return null;
  }

  return normalizeAdminAdRecord(record);
}

export async function updateAdminAdById(
  id: string,
  data: Partial<AdminAdRecord>,
) {
  const payload = buildAdminAdMutationPayload(data);

  if (isChinaRegion()) {
    const db = getDatabase();
    await db.collection('ads').doc(id).update(payload);
    return getAdminAdById(id);
  }

  const { error } = await getSupabaseAdmin().from('ads').update(payload).eq('id', id);
  if (error) {
    throw error;
  }
  return getAdminAdById(id);
}

export async function deleteAdminAdById(id: string) {
  if (isChinaRegion()) {
    const db = getDatabase();
    await db.collection('ads').doc(id).remove();
    return;
  }

  const { error } = await getSupabaseAdmin().from('ads').delete().eq('id', id);
  if (error) {
    throw error;
  }
}
