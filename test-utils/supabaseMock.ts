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
export type Call = { table: string; op: string; payload?: any; filters: [string, any][]; order?: [string, any]; select?: string };

export function createSupabaseMock() {
  const handlers = new Map<string, Result | ((call: Call) => Result | Promise<Result>)>();
  const rpcHandlers = new Map<string, Result | ((args: any) => Result)>();
  const calls: Call[] = [];

  const builder = (table: string) => {
    const call: Call = { table, op: 'select', filters: [] };
    const settle = (): Promise<Result> => {
      calls.push(call);
      const h = handlers.get(`${table}:${call.op}`);
      const r = typeof h === 'function' ? h(call) : h;
      // El handler puede devolver una promesa (para dejar una consulta "en espera" en un test)
      return Promise.resolve(r).then((rr) => ({ data: null, error: null, ...(rr ?? {}) }));
    };
    const chain: any = {
      select: (cols?: string) => ((call.select = cols), chain),
      order: (col: string, opts?: any) => ((call.order = [col, opts]), chain),
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
    signInWithPassword: jest.fn<Promise<any>, any[]>(),
    signUp: jest.fn<Promise<any>, any[]>(),
    signOut: jest.fn(async () => ({ error: null })),
    getSession: jest.fn(async (): Promise<any> => ({ data: { session: null } })),
    onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
  };

  const storageUpload = jest.fn(async () => ({ data: { path: 'x' }, error: null }));
  const storageRemove = jest.fn(async (_paths: string[]): Promise<any> => ({ data: [], error: null }));
  const storageSignedUrl = jest.fn(async (p: string): Promise<any> => ({ data: { signedUrl: `https://signed.test/${p}?token=t` }, error: null }));
  const storage = {
    from: jest.fn(() => ({
      upload: storageUpload,
      remove: storageRemove,
      createSignedUrl: storageSignedUrl,
      getPublicUrl: jest.fn((p: string) => ({ data: { publicUrl: `https://cdn.test/${p}` } })),
    })),
  };

  // supabase.rpc(nombre, args): se registra en calls como table "rpc:<nombre>"
  const rpc = (name: string, args?: any) => {
    calls.push({ table: `rpc:${name}`, op: 'rpc', payload: args, filters: [] });
    const h = rpcHandlers.get(name);
    const r = typeof h === 'function' ? h(args) : h;
    return Promise.resolve({ data: null, error: null, ...(r ?? {}) });
  };

  // supabase.functions.invoke(nombre, { body }): se registra como "fn:<nombre>"
  const fnHandlers = new Map<string, any>();
  const functions = {
    invoke: (name: string, opts?: any) => {
      calls.push({ table: `fn:${name}`, op: 'invoke', payload: opts?.body, filters: [] });
      const h = fnHandlers.get(name);
      const r = typeof h === 'function' ? h(opts?.body) : h;
      return Promise.resolve({ data: null, error: null, ...(r ?? {}) });
    },
  };

  return {
    client: { from: (t: string) => builder(t), auth, storage, rpc, functions },
    onFunction: (name: string, r: any) => void fnHandlers.set(name, r),
    on: (table: string, op: string, r: Result | ((c: Call) => Result | Promise<Result>)) =>
      void handlers.set(`${table}:${op}`, r),
    onRpc: (name: string, r: Result | ((args: any) => Result)) => void rpcHandlers.set(name, r),
    calls,
    auth,
    storageUpload,
    storageRemove,
    storageSignedUrl,
    reset: () => {
      handlers.clear();
      rpcHandlers.clear();
      fnHandlers.clear();
      calls.length = 0;
      storageUpload.mockClear();
      storageSignedUrl.mockClear();
      storageRemove.mockClear();
    },
  };
}

/** Instancia compartida: la usan tanto jest.mock(...) como los tests. */
export const db = createSupabaseMock();
