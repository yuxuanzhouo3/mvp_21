/**
 * 统一数据库服务
 * 支持 Supabase（国际）和 CloudBase（国内）
 */

import { isChinaRegion } from '@/lib/config/region';

// 数据库表名映射
export const TABLES = {
  USERS: 'users',
  CONTRACTS: 'contracts',
  ADS: 'ads',
  AD_STATS: 'ad_stats',
  SUBSCRIPTIONS: 'subscriptions',
  PAYMENTS: 'payments',
  USER_SESSIONS: 'user_sessions',
} as const;

// 通用查询选项
export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
}

// 数据库服务接口
export interface DbService {
  // 通用 CRUD
  findMany<T>(table: string, filter?: Record<string, any>, options?: QueryOptions): Promise<T[]>;
  findOne<T>(table: string, filter: Record<string, any>): Promise<T | null>;
  findById<T>(table: string, id: string): Promise<T | null>;
  create<T>(table: string, data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  update<T>(table: string, id: string, data: Partial<T>): Promise<T>;
  delete(table: string, id: string): Promise<void>;
  count(table: string, filter?: Record<string, any>): Promise<number>;
}

// Supabase 实现
class SupabaseDbService implements DbService {
  private getClient() {
    // 动态导入避免循环依赖
    const { supabase } = require('@/lib/integrations/supabase');
    return supabase;
  }

  async findMany<T>(table: string, filter?: Record<string, any>, options?: QueryOptions): Promise<T[]> {
    const supabase = this.getClient();
    let query = supabase.from(table).select('*');

    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });
    }

    if (options?.orderBy) {
      query = query.order(options.orderBy, { ascending: options.orderDir !== 'desc' });
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;
    if (error) throw new Error(`查询失败: ${error.message}`);
    return data as T[];
  }

  async findOne<T>(table: string, filter: Record<string, any>): Promise<T | null> {
    const results = await this.findMany<T>(table, filter, { limit: 1 });
    return results[0] || null;
  }

  async findById<T>(table: string, id: string): Promise<T | null> {
    return this.findOne<T>(table, { id });
  }

  async create<T>(table: string, data: any): Promise<T> {
    const supabase = this.getClient();
    const now = new Date().toISOString();
    const insertData = {
      ...data,
      created_at: now,
      updated_at: now,
    };

    const { data: result, error } = await supabase
      .from(table)
      .insert(insertData)
      .select()
      .single();

    if (error) throw new Error(`创建失败: ${error.message}`);
    return result as T;
  }

  async update<T>(table: string, id: string, data: any): Promise<T> {
    const supabase = this.getClient();
    const updateData = {
      ...data,
      updated_at: new Date().toISOString(),
    };

    const { data: result, error } = await supabase
      .from(table)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`更新失败: ${error.message}`);
    return result as T;
  }

  async delete(table: string, id: string): Promise<void> {
    const supabase = this.getClient();
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw new Error(`删除失败: ${error.message}`);
  }

  async count(table: string, filter?: Record<string, any>): Promise<number> {
    const supabase = this.getClient();
    let query = supabase.from(table).select('*', { count: 'exact', head: true });

    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });
    }

    const { count, error } = await query;
    if (error) throw new Error(`计数失败: ${error.message}`);
    return count || 0;
  }
}

// 内存数据库实现（开发/测试用）
class MemoryDbService implements DbService {
  private data = new Map<string, Map<string, any>>();
  private idCounter = 0;

  private getTable(table: string): Map<string, any> {
    if (!this.data.has(table)) {
      this.data.set(table, new Map());
    }
    return this.data.get(table)!;
  }

  async findMany<T>(table: string, filter?: Record<string, any>, options?: QueryOptions): Promise<T[]> {
    const tableData = this.getTable(table);
    let results = Array.from(tableData.values());

    if (filter) {
      results = results.filter(item =>
        Object.entries(filter).every(([key, value]) =>
          value === undefined || value === null || item[key] === value
        )
      );
    }

    if (options?.orderBy) {
      results.sort((a, b) => {
        const aVal = a[options.orderBy!];
        const bVal = b[options.orderBy!];
        const dir = options.orderDir === 'desc' ? -1 : 1;
        return aVal > bVal ? dir : aVal < bVal ? -dir : 0;
      });
    }

    if (options?.offset) {
      results = results.slice(options.offset);
    }

    if (options?.limit) {
      results = results.slice(0, options.limit);
    }

    return results as T[];
  }

  async findOne<T>(table: string, filter: Record<string, any>): Promise<T | null> {
    const results = await this.findMany<T>(table, filter, { limit: 1 });
    return results[0] || null;
  }

  async findById<T>(table: string, id: string): Promise<T | null> {
    const tableData = this.getTable(table);
    return tableData.get(id) || null;
  }

  async create<T>(table: string, data: any): Promise<T> {
    const tableData = this.getTable(table);
    const id = `${table}_${++this.idCounter}_${Date.now()}`;
    const now = new Date().toISOString();
    const record = {
      id,
      ...data,
      created_at: now,
      updated_at: now,
    };
    tableData.set(id, record);
    return record as T;
  }

  async update<T>(table: string, id: string, data: any): Promise<T> {
    const tableData = this.getTable(table);
    const existing = tableData.get(id);
    if (!existing) throw new Error(`记录不存在: ${id}`);

    const updated = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
    };
    tableData.set(id, updated);
    return updated as T;
  }

  async delete(table: string, id: string): Promise<void> {
    const tableData = this.getTable(table);
    tableData.delete(id);
  }

  async count(table: string, filter?: Record<string, any>): Promise<number> {
    const results = await this.findMany(table, filter);
    return results.length;
  }

  // 用于测试：添加初始数据
  seed(table: string, records: any[]) {
    const tableData = this.getTable(table);
    records.forEach(record => {
      tableData.set(record.id, record);
    });
  }
}

// CloudBase 数据库实现（国内版）
class CloudBaseDbService implements DbService {
  private db: any = null;

  private async getDb() {
    if (this.db) return this.db;

    const cloudbase = require('@cloudbase/node-sdk');
    const app = cloudbase.init({
      env: process.env.NEXT_PUBLIC_CLOUDBASE_ENV_ID,
      secretId: process.env.CLOUDBASE_SECRET_ID,
      secretKey: process.env.CLOUDBASE_SECRET_KEY,
    });
    this.db = app.database();
    return this.db;
  }

  async findMany<T>(table: string, filter?: Record<string, any>, options?: QueryOptions): Promise<T[]> {
    const db = await this.getDb();
    let query = db.collection(table);

    if (filter) {
      query = query.where(filter);
    }

    if (options?.orderBy) {
      query = query.orderBy(options.orderBy, options.orderDir || 'asc');
    }

    if (options?.offset) {
      query = query.skip(options.offset);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data } = await query.get();
    // CloudBase 用 _id，转换为 id
    return (data || []).map((item: any) => ({
      ...item,
      id: item._id || item.id,
    })) as T[];
  }

  async findOne<T>(table: string, filter: Record<string, any>): Promise<T | null> {
    const results = await this.findMany<T>(table, filter, { limit: 1 });
    return results[0] || null;
  }

  async findById<T>(table: string, id: string): Promise<T | null> {
    const db = await this.getDb();
    try {
      const { data } = await db.collection(table).doc(id).get();
      if (data && data.length > 0) {
        return { ...data[0], id: data[0]._id || id } as T;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  async create<T>(table: string, data: any): Promise<T> {
    const db = await this.getDb();
    const now = new Date().toISOString();
    const insertData = {
      ...data,
      created_at: now,
      updated_at: now,
    };

    const { id } = await db.collection(table).add(insertData);
    return { ...insertData, id, _id: id } as T;
  }

  async update<T>(table: string, id: string, data: any): Promise<T> {
    const db = await this.getDb();
    const updateData = {
      ...data,
      updated_at: new Date().toISOString(),
    };

    await db.collection(table).doc(id).update(updateData);
    const updated = await this.findById<T>(table, id);
    return updated as T;
  }

  async delete(table: string, id: string): Promise<void> {
    const db = await this.getDb();
    await db.collection(table).doc(id).remove();
  }

  async count(table: string, filter?: Record<string, any>): Promise<number> {
    const db = await this.getDb();
    let query = db.collection(table);

    if (filter) {
      query = query.where(filter);
    }

    const { total } = await query.count();
    return total || 0;
  }
}

// 单例实例
let dbInstance: DbService | null = null;

export function getDb(): DbService {
  if (dbInstance) return dbInstance;

  // 根据环境变量选择实现
  const useMemory = process.env.USE_MEMORY_DB === 'true';

  if (useMemory) {
    console.log('📦 使用内存数据库（开发模式）');
    dbInstance = new MemoryDbService();
    seedDemoData(dbInstance as MemoryDbService);
  } else if (isChinaRegion()) {
    console.log('📦 使用 CloudBase 数据库（国内版）');
    dbInstance = new CloudBaseDbService();
  } else {
    console.log('📦 使用 Supabase 数据库（国际版）');
    dbInstance = new SupabaseDbService();
  }

  return dbInstance;
}

// 模拟数据
function seedDemoData(db: MemoryDbService) {
  // 用户数据
  db.seed(TABLES.USERS, [
    {
      id: 'user_1',
      email: 'admin@contracthub.com',
      name: '管理员',
      role: 'admin',
      plan: 'enterprise',
      status: 'active',
      contracts_count: 50,
      contracts_this_month: 12,
      last_login_at: new Date().toISOString(),
      created_at: '2024-01-01T00:00:00Z',
      updated_at: new Date().toISOString(),
    },
    {
      id: 'user_2',
      email: 'li@example.com',
      name: '李四',
      role: 'user',
      plan: 'pro',
      status: 'active',
      contracts_count: 28,
      contracts_this_month: 8,
      last_login_at: new Date().toISOString(),
      created_at: '2024-06-15T00:00:00Z',
      updated_at: new Date().toISOString(),
    },
    {
      id: 'user_3',
      email: 'wang@example.com',
      name: '王五',
      role: 'user',
      plan: 'free',
      status: 'active',
      contracts_count: 5,
      contracts_this_month: 2,
      last_login_at: new Date(Date.now() - 86400000).toISOString(),
      created_at: '2024-10-01T00:00:00Z',
      updated_at: new Date().toISOString(),
    },
  ]);

  // 广告数据
  db.seed(TABLES.ADS, [
    {
      id: 'ad_1',
      name: '首页横幅广告',
      position: 'banner_top',
      type: 'image',
      content: '/ads/banner1.jpg',
      link: 'https://example.com/promo1',
      status: 'active',
      impressions: 15680,
      clicks: 342,
      revenue: 1890.5,
      start_date: '2024-12-01',
      end_date: '2025-02-28',
      created_at: '2024-11-20T00:00:00Z',
      updated_at: new Date().toISOString(),
    },
    {
      id: 'ad_2',
      name: '侧边栏推广',
      position: 'sidebar',
      type: 'image',
      content: '/ads/sidebar1.jpg',
      link: 'https://example.com/promo2',
      status: 'active',
      impressions: 8920,
      clicks: 156,
      revenue: 780.0,
      start_date: '2024-12-15',
      end_date: '2025-01-31',
      created_at: '2024-12-10T00:00:00Z',
      updated_at: new Date().toISOString(),
    },
  ]);

  // 订阅数据
  db.seed(TABLES.SUBSCRIPTIONS, [
    {
      id: 'sub_1',
      user_id: 'user_2',
      plan: 'pro',
      status: 'active',
      price: 29,
      billing_cycle: 'monthly',
      payment_method: 'wechat',
      start_date: '2024-12-01',
      next_bill_date: '2025-02-01',
      created_at: '2024-12-01T00:00:00Z',
      updated_at: new Date().toISOString(),
    },
  ]);

  // 支付记录
  db.seed(TABLES.PAYMENTS, [
    {
      id: 'pay_1',
      user_id: 'user_2',
      subscription_id: 'sub_1',
      amount: 29,
      currency: 'CNY',
      status: 'completed',
      payment_method: 'wechat',
      created_at: '2025-01-01T10:30:00Z',
    },
    {
      id: 'pay_2',
      user_id: 'user_2',
      subscription_id: 'sub_1',
      amount: 29,
      currency: 'CNY',
      status: 'completed',
      payment_method: 'wechat',
      created_at: '2024-12-01T09:15:00Z',
    },
  ]);
}

export default getDb;
