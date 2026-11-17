/**
 * Mock encadenable de supabase-js para tests.
 *
 *   const db = createSupabaseMock();
 *   db.on('Expense_line', 'select', { data: [...], error: null });
 *   jest.mock('@/utils/supabase', () => ({ supabase: db.client }));
 *
 * Cada llamada queda registrada en db.calls para poder hacer asserts del
 * payload que realmente se envia.
 */
export type Result = { data?: any; error?: { message: string } | null };
export type Call = { table: string; op: string; payload?: any; filters: [string, any][] };

export function createSupabaseMock() {
  const handlers = new Map<string, Result | ((call: Call) => Result)>();
  const calls: Call[] = [];

  const builder = (table: string) => {
    const call: Call = { table, op: 'select', filters: [] };
    const settle = (): Promise<Result> => {
      calls.push(call);
      const h = handlers.get(`${table}:${call.op}`);
      const r = typeof h === 'function' ? h(call) : h;
      return Promise.resolve({ data: null, error: null, ...(r ?? {}) });
    };
    const chain: any = {
      select: () => chain,
      order: () => chain,
      insert: (payload: any) => ((call.op = 'insert'), (call.payload = payload), chain),
      update: (payload: any) => ((call.op = 'update'), (call.payload = payload), chain),
      delete: () => ((call.op = 'delete'), chain),
      eq: (k: string, v: any) => (call.filters.push([k, v]), chain),
      in: (k: string, v: any) => (call.filters.push([k, v]), chain),
      single: () => settle(),
      maybeSingle: () => settle(),
      then: (res: any, rej: any) => settle().then(res, rej),
    };
    return chain;
  };

  const auth = {
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(async () => ({ error: null })),
    getSession: jest.fn(async () => ({ data: { session: null } })),
    onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
  };

  const storageUpload = jest.fn(async () => ({ data: { path: 'x' }, error: null }));
  const storage = {
    from: jest.fn(() => ({
      upload: storageUpload,
      getPublicUrl: jest.fn((p: string) => ({ data: { publicUrl: `https://cdn.test/${p}` } })),
    })),
  };

  return {
    client: { from: (t: string) => builder(t), auth, storage },
    on: (table: string, op: string, r: Result | ((c: Call) => Result)) =>
      void handlers.set(`${table}:${op}`, r),
    calls,
    auth,
    storageUpload,
    reset: () => {
      handlers.clear();
      calls.length = 0;
    },
  };
}

/** Instancia compartida: la usan tanto jest.mock(...) como los tests. */
export const db = createSupabaseMock();
