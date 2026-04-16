import { getDatabase as getCloudBaseDatabase } from "@/lib/cloudbase/cloudbase-service";
import { isChinaRegion } from "@/lib/config/region";
import { DataValidators } from "@/lib/models/database";

export interface DatabaseAdapter {
  query<T>(table: string, filter?: Record<string, any>): Promise<T[]>;
  insert<T>(table: string, data: T): Promise<T & { id: string }>;
  update<T>(table: string, id: string, data: Partial<T>): Promise<T>;
  delete(table: string, id: string): Promise<void>;
  getById<T>(table: string, id: string): Promise<T | null>;
}

class SupabaseDatabaseAdapter implements DatabaseAdapter {
  private supabase: any;
  private initPromise: Promise<any>;

  constructor() {
    this.initPromise = import("@/lib/integrations/supabase").then(
      ({ supabase }) => {
        this.supabase = supabase;
        return supabase;
      },
    );
  }

  private async ensureSupabase() {
    if (this.supabase) {
      return this.supabase;
    }

    return this.initPromise;
  }

  async query<T>(table: string, filter?: Record<string, any>): Promise<T[]> {
    const supabase = await this.ensureSupabase();
    let query = supabase.from(table).select("*");

    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Query failed: ${error.message}`);
    }

    return (data || []) as T[];
  }

  async insert<T>(table: string, data: T): Promise<T & { id: string }> {
    const supabase = await this.ensureSupabase();

    if (table === "user_profiles" && !DataValidators.validateUserProfile(data as any)) {
      throw new Error("Invalid user profile payload");
    }
    if (table === "chat_sessions" && !DataValidators.validateChatSession(data as any)) {
      throw new Error("Invalid chat session payload");
    }
    if (table === "chat_messages" && !DataValidators.validateChatMessage(data as any)) {
      throw new Error("Invalid chat message payload");
    }
    if (table === "payment_records" && !DataValidators.validatePaymentRecord(data as any)) {
      throw new Error("Invalid payment record payload");
    }

    const { data: result, error } = await supabase
      .from(table)
      .insert(data)
      .select()
      .single();

    if (error) {
      throw new Error(`Insert failed: ${error.message}`);
    }

    return result as T & { id: string };
  }

  async update<T>(table: string, id: string, data: Partial<T>): Promise<T> {
    const supabase = await this.ensureSupabase();
    const { data: result, error } = await supabase
      .from(table)
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Update failed: ${error.message}`);
    }

    return result as T;
  }

  async delete(table: string, id: string): Promise<void> {
    const supabase = await this.ensureSupabase();
    const { error } = await supabase.from(table).delete().eq("id", id);

    if (error) {
      throw new Error(`Delete failed: ${error.message}`);
    }
  }

  async getById<T>(table: string, id: string): Promise<T | null> {
    const supabase = await this.ensureSupabase();
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Query failed: ${error.message}`);
    }

    return data as T;
  }
}

class CloudBaseDatabaseAdapter implements DatabaseAdapter {
  private db: any;

  constructor() {
    this.db = getCloudBaseDatabase();
  }

  async query<T>(table: string, filter?: Record<string, any>): Promise<T[]> {
    const collection = this.db.collection(table);
    const query = filter ? collection.where(filter) : collection;
    const result = await query.get();
    return (result?.data || []) as T[];
  }

  async insert<T>(table: string, data: T): Promise<T & { id: string }> {
    const created = await this.db
      .collection(table)
      .add(data as Record<string, unknown>);
    const inserted = await this.db.collection(table).doc(created.id).get();
    const row = inserted?.data?.[0] || {};

    return {
      ...(row as T),
      id: String((row as any)._id || (row as any).id || created.id),
    };
  }

  async update<T>(table: string, id: string, data: Partial<T>): Promise<T> {
    await this.db.collection(table).doc(id).update(data as Record<string, unknown>);
    const updated = await this.getById<T>(table, id);

    if (!updated) {
      throw new Error(`Record not found after update: ${table}/${id}`);
    }

    return updated;
  }

  async delete(table: string, id: string): Promise<void> {
    await this.db.collection(table).doc(id).remove();
  }

  async getById<T>(table: string, id: string): Promise<T | null> {
    const result = await this.db.collection(table).doc(id).get();
    const row = result?.data?.[0] as T | undefined;
    return row || null;
  }
}

class MemoryDatabaseAdapter implements DatabaseAdapter {
  private data: Map<string, Map<string, any>> = new Map();

  async query<T>(table: string, filter?: Record<string, any>): Promise<T[]> {
    const tableData = this.data.get(table) || new Map();
    let results = Array.from(tableData.values()) as T[];

    if (filter) {
      results = results.filter((item: any) =>
        Object.entries(filter).every(([key, value]) => item[key] === value),
      );
    }

    return results;
  }

  async insert<T>(table: string, data: T): Promise<T & { id: string }> {
    if (!this.data.has(table)) {
      this.data.set(table, new Map());
    }

    const tableData = this.data.get(table)!;
    const id =
      (data as any).id || `mem_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const item = { ...data, id };
    tableData.set(id, item);
    return item as T & { id: string };
  }

  async update<T>(table: string, id: string, data: Partial<T>): Promise<T> {
    const tableData = this.data.get(table);
    if (!tableData || !tableData.has(id)) {
      throw new Error(`Record not found: ${table}/${id}`);
    }

    const existing = tableData.get(id);
    const updated = { ...existing, ...data };
    tableData.set(id, updated);
    return updated as T;
  }

  async delete(table: string, id: string): Promise<void> {
    const tableData = this.data.get(table);
    if (tableData) {
      tableData.delete(id);
    }
  }

  async getById<T>(table: string, id: string): Promise<T | null> {
    const tableData = this.data.get(table);
    if (!tableData) {
      return null;
    }

    return (tableData.get(id) as T) || null;
  }
}

export function createDatabaseAdapter(): DatabaseAdapter {
  if (isChinaRegion()) {
    try {
      return new CloudBaseDatabaseAdapter();
    } catch (error) {
      console.warn(
        "[database/adapter] CloudBase unavailable, falling back to in-memory adapter.",
        error,
      );
      return new MemoryDatabaseAdapter();
    }
  }

  return new SupabaseDatabaseAdapter();
}

let dbInstance: DatabaseAdapter | null = null;

export function getDatabase(): DatabaseAdapter {
  if (!dbInstance) {
    dbInstance = createDatabaseAdapter();
  }

  return dbInstance;
}
