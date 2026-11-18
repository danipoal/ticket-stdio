// Supabase simulado (auth + REST) para desarrollo visual y e2e sin backend real.
//   node e2e/mock-supabase.js            -> http://127.0.0.1:54321
// Compilar la app apuntando aqui:
//   EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 EXPO_PUBLIC_SUPABASE_KEY=mock npx expo start --web
// Usuarios: admin@demo.test (admin) y ana@demo.test (empleada). Cualquier contraseña.
const http = require('http');
const url = require('url');

const PORT = Number(process.env.MOCK_PORT || 54321);

const users = {
  'admin@demo.test': { id: 'u-admin', email: 'admin@demo.test' },
  'ana@demo.test': { id: 'u-ana', email: 'ana@demo.test' },
};
const employees = [
  { id: 'e-admin', name: 'Marta Ruiz', is_admin: true, id_organization: 'o1', id_user: 'u-admin' },
  { id: 'e-ana', name: 'Ana Pérez', is_admin: false, id_organization: 'o1', id_user: 'u-ana' },
  { id: 'e-luis', name: 'Luis Gómez', is_admin: false, id_organization: 'o1', id_user: 'u-luis' },
  { id: 'e-sara', name: 'Sara Vidal', is_admin: false, id_organization: 'o1', id_user: 'u-sara' },
];
const organizations = [{ id: 'o1', name: 'Acme Consulting S.L.', VAT_number: 'B12345678', street: 'C/ Mayor 12', city: 'Barcelona', country: 'España' }];
const statuses = [{ id: 1, name: 'Pendiente' }, { id: 2, name: 'Aprobado' }, { id: 3, name: 'Rechazado' }];
const payment = [{ id: 1, name: 'Tarjeta empresa' }, { id: 2, name: 'Efectivo' }, { id: 3, name: 'Transferencia' }];
const categories = [{ id: 1, name: 'Comidas' }, { id: 2, name: 'Transporte' }, { id: 3, name: 'Alojamiento' }, { id: 4, name: 'Material' }, { id: 5, name: 'Formación' }];

// Hojas de Ana (e-ana) a lo largo de 8 meses + algunas de otros empleados
const titles = ['Viaje Madrid', 'Congreso Valencia', 'Material oficina', 'Comida cliente', 'Formación React', 'Visita Sevilla', 'Taller equipo', 'Feria Bilbao', 'Cena proyecto', 'Desplazamientos', 'Curso AWS', 'Reunión Lisboa', 'Suministros', 'Workshop UX'];
const projects = ['Alfa', 'Beta', 'Gamma', 'Interno'];
const sheets = [];
const lines = [];
let lid = 1;
function rnd(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const r = rnd(7);
titles.forEach((t, i) => {
  const owner = i < 9 ? 'e-ana' : ['e-luis', 'e-sara'][i % 2];
  const month = 5 + Math.floor(i * 0.45); // junio..noviembre
  const status = i % 5 === 0 ? 3 : i % 3 === 0 ? 1 : 2;
  const id = i + 1;
  const date = new Date(2026, month, 3 + (i % 20));
  const nLines = 2 + Math.floor(r() * 4);
  let total = 0;
  for (let k = 0; k < nLines; k++) {
    const amount = Math.round((8 + r() * 140) * 100) / 100;
    total += amount;
    lines.push({
      id: lid++, id_sheet: String(id), title: ['Taxi', 'Menú del día', 'Hotel', 'Billete tren', 'Cartuchos', 'Matrícula curso', 'Parking'][(i + k) % 7],
      amount, tax: [21, 10, 21, 10][k % 4], date: date.toISOString().slice(0, 10), foto: k % 3 === 0 ? 'https://example.com/f.jpg' : null,
      id_payment_type: String(1 + ((i + k) % 3)), id_category: String(1 + ((i * 2 + k) % 5)),
    });
  }
  sheets.push({
    id, title: t, description: i % 2 ? 'Gastos del desplazamiento y dietas' : '', project: projects[i % 4],
    total_amount: String(Math.round(total * 100) / 100), create_date: date.toISOString(), approval_date: status === 2 ? date.toISOString() : null,
    id_user: owner, status: statuses.find((s) => s.id === status),
  });
});

function stats(emp) {
  const mine = sheets.filter((s) => s.id_user === emp.id);
  const ids = new Set(mine.map((s) => String(s.id)));
  return {
    id_user: emp.id, name: emp.name, id_admin: 'e-admin',
    total_expense_sheets: mine.length,
    approved_sheets: mine.filter((s) => s.status.id === 2).length,
    pending_sheets: mine.filter((s) => s.status.id === 1).length,
    denied_sheets: mine.filter((s) => s.status.id === 3).length,
    total_expense_lines: lines.filter((l) => ids.has(l.id_sheet)).length,
    total_amount: mine.reduce((a, s) => a + Number(s.total_amount), 0),
  };
}

const tables = {
  employees: () => employees,
  Organization: () => organizations,
  Sheet_status: () => statuses,
  Expense_payment_type: () => payment,
  Expense_category: () => categories,
  expense_sheet_with_total: () => sheets,
  Expense_line: () => lines,
  Expense_sheet: () => sheets,
  expense_dashboard_stats: () => employees.filter((e) => e.id !== 'e-admin').map(stats).concat([stats(employees[0])]),
};

function applyFilters(rows, query) {
  let out = rows;
  for (const [k, v] of Object.entries(query)) {
    if (['select', 'order', 'limit', 'offset'].includes(k)) continue;
    const m = /^(eq|in)\.(.*)$/.exec(v);
    if (!m) continue;
    if (m[1] === 'eq') out = out.filter((row) => String(row[k]) === m[2]);
    else {
      const set = m[2].replace(/^\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, ''));
      out = out.filter((row) => set.includes(String(row[k])));
    }
  }
  if (query.order) {
    const [col, dir] = query.order.split('.');
    out = [...out].sort((a, b) => (a[col] > b[col] ? 1 : -1) * (dir === 'desc' ? -1 : 1));
  }
  return out;
}

function session(user) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return {
    access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, exp, role: 'authenticated' })}.sig`,
    token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'refresh-' + user.id,
    user: { id: user.id, aud: 'authenticated', role: 'authenticated', email: user.email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(), identities: [{}] },
  };
}

const server = http.createServer((req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*', 'Access-Control-Expose-Headers': '*' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  const u = url.parse(req.url, true);
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', ...cors }); res.end(obj === undefined ? '' : JSON.stringify(obj)); };
    if (u.pathname === '/auth/v1/token') {
      const b = JSON.parse(body || '{}');
      const user = users[(b.email || '').toLowerCase()];
      if (!user) return send(400, { error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials', code: 400 });
      return send(200, session(user));
    }
    if (u.pathname === '/auth/v1/user') {
      const tok = (req.headers.authorization || '').split('.')[1];
      try { const id = JSON.parse(Buffer.from(tok, 'base64url').toString()).sub; const user = Object.values(users).find((x) => x.id === id); return send(200, session(user).user); } catch { return send(401, { msg: 'bad jwt' }); }
    }
    if (u.pathname === '/auth/v1/logout') return send(204);
    const m = /^\/rest\/v1\/(\w+)$/.exec(u.pathname);
    if (m && tables[m[1]]) {
      if (req.method === 'GET') {
        const rows = applyFilters(tables[m[1]](), u.query);
        if ((req.headers.accept || '').includes('vnd.pgrst.object')) {
          if (rows.length === 1) return send(200, rows[0]);
          if (rows.length === 0 && req.headers.accept) return send(406, { code: 'PGRST116', message: 'no rows' });
          return send(406, { code: 'PGRST116', message: 'multiple rows' });
        }
        return send(200, rows);
      }
      return send(201, []);
    }
    send(404, { message: 'mock: ' + u.pathname });
  });
});
server.listen(PORT, '0.0.0.0', () => console.log('mock supabase en http://127.0.0.1:' + PORT));
