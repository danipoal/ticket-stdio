import * as fs from 'fs';
import * as path from 'path';

const DIR = path.join(__dirname, '..', 'supabase');
const TPL = path.join(DIR, 'email-templates');
const cfg = JSON.parse(fs.readFileSync(path.join(DIR, 'email-config.json'), 'utf8'));
const read = (n: string) => fs.readFileSync(path.join(TPL, `${n}.html`), 'utf8');

const withLink = ['confirmation', 'recovery', 'magic_link', 'invite', 'email_change'];

describe('plantillas de correo de Supabase Auth', () => {
  it.each(Object.keys(cfg.subjects))('"%s" tiene plantilla y asunto en castellano', (k) => {
    expect(fs.existsSync(path.join(TPL, `${k}.html`))).toBe(true);
    expect(cfg.subjects[k].length).toBeGreaterThan(10);
    expect(cfg.subjects[k]).not.toMatch(/Confirm Your|Reset Your|Magic Link|You have been/); // no quedan los de fabrica
  });

  it.each(withLink)('"%s" incluye el enlace y un texto alternativo con la URL', (k) => {
    const html = read(k);
    expect((html.match(/\{\{ \.ConfirmationURL \}\}/g) ?? []).length).toBeGreaterThanOrEqual(2); // boton + texto alternativo
  });

  it('el cambio de correo menciona el correo antiguo y el nuevo', () => {
    const html = read('email_change');
    expect(html).toContain('{{ .Email }}');
    expect(html).toContain('{{ .NewEmail }}');
  });

  it('el codigo de reautenticacion muestra el token', () => {
    expect(read('reauthentication')).toContain('{{ .Token }}');
  });

  it.each(Object.keys(cfg.subjects))('"%s": HTML valido para clientes de correo (es, estilos en linea, sin scripts ni imagenes remotas)', (k) => {
    const html = read(k);
    expect(html).toContain('<html lang="es">');
    expect(html).toContain('{{ .Email }}');
    expect(html).not.toMatch(/<script|<img|<link|@import|javascript:/i);
    expect(html).not.toMatch(/http:\/\//); // todo https
    // plantillas Go: llaves emparejadas
    expect((html.match(/\{\{/g) ?? []).length).toBe((html.match(/\}\}/g) ?? []).length);
  });

  it('el aviso de recuperacion explica que se ignore si no se pidio', () => {
    expect(read('recovery')).toMatch(/no lo has pedido/i);
  });
});

describe('email-config.json', () => {
  it('remitente ticket@danipoal.com por Resend (465) y URLs permitidas del dominio', () => {
    expect(cfg.smtp.admin_email).toBe('ticket@danipoal.com');
    expect(cfg.smtp.host).toBe('smtp.resend.com');
    expect(cfg.smtp.port).toBe('465');
    expect(cfg.smtp.user).toBe('resend');
    expect(cfg.uri_allow_list).toBe('https://ticket.danipoal.com/**');
    expect(cfg.site_url).toBe('https://ticket.danipoal.com');
  });
  it('NO contiene secretos (la clave de Resend se lee de un fichero)', () => {
    const raw = fs.readFileSync(path.join(DIR, 'email-config.json'), 'utf8');
    expect(raw).not.toMatch(/re_[A-Za-z0-9]{10,}/);
    expect(cfg.smtp.pass).toBeUndefined();
    expect(cfg.smtp.password).toBeUndefined();
  });
  it('el limite de envios es mayor que el de fabrica (2/h) y el codigo caduca en <= 1 h', () => {
    expect(cfg.rate_limit_email_sent).toBeGreaterThan(2);
    expect(cfg.mailer_otp_exp).toBeLessThanOrEqual(3600);
  });
});
