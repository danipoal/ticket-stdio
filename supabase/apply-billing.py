#!/usr/bin/env python3
"""Despliega la facturacion con Stripe: Edge Functions `billing` y `stripe-webhook`, secretos y configuracion en Stripe.

Lee:  supabase/functions/**                  codigo de las funciones (la logica comun esta en _shared/stripe.ts)
Usa:  ~/.config/supabase-token               token personal de Supabase (Management API)
      ~/.config/stripe-key                   clave SECRETA de Stripe (sk_test_... / sk_live_...). Opcional: sin ella solo se
                                             despliegan las funciones y la app muestra "pasarela sin configurar".
      ~/.config/stripe-webhook-secret        se genera y guarda solo al crear el endpoint del webhook (chmod 600)

Uso:
  python3 supabase/apply-billing.py --dry-run          construye y valida las funciones (Deno en Docker) y muestra el plan; no toca nada
  python3 supabase/apply-billing.py --functions-only   despliega solo las funciones (sin Stripe)
  python3 supabase/apply-billing.py                    funciones + Stripe: webhook, portal de cliente y secretos en Supabase
  python3 supabase/apply-billing.py --check-stripe     solo comprueba la clave de Stripe (muestra cuenta y modo)

Para cambiar de modo test a modo real basta con poner la clave sk_live_ en ~/.config/stripe-key y volver a ejecutarlo
(crea el webhook y el portal en la cuenta real y sustituye los secretos).
"""
import json, os, re, shutil, subprocess, sys, urllib.error, urllib.parse, urllib.request, uuid

HERE = os.path.dirname(os.path.abspath(__file__))
REF = os.environ.get("SUPABASE_PROJECT_REF", "zyiegqaaeltcgazcvbfs")
SITE_URL = os.environ.get("SITE_URL", "https://ticket.danipoal.com")
FUNCTIONS = {"billing": True, "stripe-webhook": False}  # nombre -> verify_jwt
WEBHOOK_URL = f"https://{REF}.supabase.co/functions/v1/stripe-webhook"
WEBHOOK_EVENTS = [
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.upcoming",
    "invoice.payment_failed",
]
DRY = "--dry-run" in sys.argv
FUNCTIONS_ONLY = "--functions-only" in sys.argv
CHECK_STRIPE = "--check-stripe" in sys.argv


def read_secret(path, env=None):
    if env and os.environ.get(env):
        return os.environ[env].strip()
    p = os.path.expanduser(path)
    return open(p).read().strip() if os.path.exists(p) else ""


def write_secret(path, value):
    p = os.path.expanduser(path)
    fd = os.open(p, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        f.write(value)


def http(method, url, headers=None, body=None):
    req = urllib.request.Request(url, method=method, data=body, headers=headers or {})
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return r.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        try:
            return e.code, json.loads(raw)
        except ValueError:
            return e.code, {"raw": raw[:400]}


# ------------------------------------------------------------------------------------------------ empaquetado

def bundle(name):
    """Un solo fichero por funcion: la logica comun se incluye en linea (sin `export`) y se quita el import relativo."""
    shared = open(os.path.join(HERE, "functions", "_shared", "stripe.ts"), encoding="utf-8").read()
    index = open(os.path.join(HERE, "functions", name, "index.ts"), encoding="utf-8").read()
    shared = re.sub(r"^export ", "", shared, flags=re.M)
    lines = index.split("\n")
    imports = [l for l in lines if l.startswith("import ") and "_shared/stripe.ts" not in l]
    body = [l for l in lines if not l.startswith("import ")]
    if not any("_shared/stripe.ts" in l for l in lines):
        sys.exit(f"{name}/index.ts no importa ../_shared/stripe.ts")
    return "\n".join(imports) + "\n\n// ---- _shared/stripe.ts (incluido por apply-billing.py) ----\n" + shared + "\n// ---- " + name + "/index.ts ----\n" + "\n".join(body)


def deno_check(name, source):
    """Valida tipos y sintaxis con Deno (en Docker). Si Docker no esta disponible se avisa y se sigue."""
    if not shutil.which("docker"):
        print(f"  [aviso] sin Docker: no se valida {name} con Deno")
        return True
    work = os.path.join(HERE, ".bundle-" + uuid.uuid4().hex[:8])
    os.makedirs(work)
    try:
        open(os.path.join(work, "index.ts"), "w", encoding="utf-8").write(source)
        r = subprocess.run(["docker", "run", "--rm", "-v", f"{work}:/w", "-w", "/w", "denoland/deno:latest", "deno", "check", "index.ts"],
                           capture_output=True, text=True)
        if r.returncode != 0:
            print(r.stdout[-1500:] + r.stderr[-2500:])
            return False
        return True
    finally:
        shutil.rmtree(work, ignore_errors=True)


# ------------------------------------------------------------------------------------------------ Supabase

class Supabase:
    def __init__(self, token):
        self.h = {"Authorization": f"Bearer {token}"}
        self.base = f"https://api.supabase.com/v1/projects/{REF}"

    def deploy(self, name, source, verify_jwt):
        boundary = "----ticket" + uuid.uuid4().hex
        meta = json.dumps({"entrypoint_path": "index.ts", "name": name, "verify_jwt": verify_jwt})
        parts = (
            f'--{boundary}\r\nContent-Disposition: form-data; name="metadata"\r\nContent-Type: application/json\r\n\r\n{meta}\r\n'
            f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="index.ts"\r\nContent-Type: application/typescript\r\n\r\n{source}\r\n'
            f"--{boundary}--\r\n"
        ).encode("utf-8")
        headers = {**self.h, "Content-Type": f"multipart/form-data; boundary={boundary}"}
        return http("POST", f"{self.base}/functions/deploy?slug={urllib.parse.quote(name)}", headers, parts)

    def set_secrets(self, secrets):
        body = json.dumps([{"name": k, "value": v} for k, v in secrets.items()]).encode()
        return http("POST", f"{self.base}/secrets", {**self.h, "Content-Type": "application/json"}, body)


# ------------------------------------------------------------------------------------------------ Stripe

class Stripe:
    def __init__(self, key):
        self.key = key
        self.mode = "REAL" if key.startswith(("sk_live_", "rk_live_")) else "PRUEBA"

    def call(self, method, path, params=None):
        data = None
        headers = {"Authorization": f"Bearer {self.key}"}
        url = "https://api.stripe.com/v1" + path
        if params is not None:
            enc = form_encode(params)
            if method == "GET":
                url += "?" + enc
            else:
                data = enc.encode()
                headers["Content-Type"] = "application/x-www-form-urlencoded"
        return http(method, url, headers, data)


def form_encode(params):
    pairs = []

    def walk(prefix, v):
        if v is None:
            return
        if isinstance(v, list):
            for i, x in enumerate(v):
                walk(f"{prefix}[{i}]", x)
        elif isinstance(v, dict):
            for k, x in v.items():
                walk(f"{prefix}[{k}]", x)
        else:
            pairs.append(f"{urllib.parse.quote(prefix, safe='')}={urllib.parse.quote(str(v).lower() if isinstance(v, bool) else str(v), safe='')}")

    for k, v in params.items():
        walk(k, v)
    return "&".join(pairs)


def ensure_webhook(stripe):
    """Crea el endpoint del webhook (el secreto de firma solo se ve al crearlo). Si ya existe sin secreto guardado, lo recrea."""
    stored = read_secret("~/.config/stripe-webhook-secret")
    code, lst = stripe.call("GET", "/webhook_endpoints", {"limit": 100})
    if code != 200:
        sys.exit(f"Stripe: no se pudo listar webhooks ({code}): {lst}")
    existing = [e for e in lst.get("data", []) if e.get("url") == WEBHOOK_URL]
    if existing and stored and set(existing[0].get("enabled_events", [])) >= set(WEBHOOK_EVENTS):
        print(f"  webhook ya creado ({existing[0]['id']}) y con su secreto guardado")
        return stored
    for e in existing:  # sin secreto guardado no se puede verificar: se recrea
        stripe.call("DELETE", f"/webhook_endpoints/{e['id']}")
    code, created = stripe.call("POST", "/webhook_endpoints", {
        "url": WEBHOOK_URL, "enabled_events": WEBHOOK_EVENTS, "description": "Ticket Stdio: estado de la suscripcion",
        "metadata": {"app": "ticket-stdio"},
    })
    if code != 200 or not created.get("secret"):
        sys.exit(f"Stripe: no se pudo crear el webhook ({code}): {created}")
    write_secret("~/.config/stripe-webhook-secret", created["secret"])
    print(f"  webhook creado ({created['id']}); secreto guardado en ~/.config/stripe-webhook-secret")
    return created["secret"]


def ensure_portal(stripe):
    """Portal de cliente: metodo de pago, facturas y baja al final del periodo. Reutiliza la configuracion si ya existe."""
    code, lst = stripe.call("GET", "/billing_portal/configurations", {"limit": 100})
    if code == 200:
        for c in lst.get("data", []):
            if (c.get("metadata") or {}).get("app") == "ticket-stdio":
                print(f"  portal ya configurado ({c['id']})")
                return c["id"]
    code, created = stripe.call("POST", "/billing_portal/configurations", {
        "business_profile": {"headline": "Ticket Stdio · gestiona la suscripción de tu empresa"},
        "features": {
            "customer_update": {"enabled": True, "allowed_updates": ["email", "address", "tax_id", "name"]},
            "invoice_history": {"enabled": True},
            "payment_method_update": {"enabled": True},
            "subscription_cancel": {"enabled": True, "mode": "at_period_end"},
        },
        "metadata": {"app": "ticket-stdio"},
    })
    if code != 200:
        sys.exit(f"Stripe: no se pudo crear el portal ({code}): {created}")
    print(f"  portal creado ({created['id']})")
    return created["id"]


# ------------------------------------------------------------------------------------------------ main

def main():
    stripe_key = read_secret("~/.config/stripe-key", "STRIPE_SECRET_KEY")

    if CHECK_STRIPE:
        if not stripe_key:
            sys.exit("Falta la clave de Stripe (~/.config/stripe-key)")
        st = Stripe(stripe_key)
        code, acc = st.call("GET", "/account")
        if code != 200:
            sys.exit(f"Stripe rechazo la clave ({code}): {acc.get('error', {}).get('message', acc)}")
        print(f"Clave valida · modo {st.mode} · cuenta {acc.get('settings', {}).get('dashboard', {}).get('display_name') or acc.get('id')}")
        return

    print("1/3 Construyendo y validando las funciones")
    sources = {}
    for name in FUNCTIONS:
        sources[name] = bundle(name)
        ok = deno_check(name, sources[name])
        print(f"  {name}: {len(sources[name])} caracteres · Deno {'OK' if ok else 'CON ERRORES'}")
        if not ok:
            sys.exit(1)

    if DRY:
        print("\n[dry-run] se desplegaria: " + ", ".join(f"{n} (verify_jwt={v})" for n, v in FUNCTIONS.items()))
        if FUNCTIONS_ONLY or not stripe_key:
            print("[dry-run] sin Stripe: las funciones responderian 'not_configured'")
        else:
            print(f"[dry-run] Stripe en modo {Stripe(stripe_key).mode}: crearia webhook {WEBHOOK_URL}, portal de cliente y secretos")
        return

    token = read_secret("~/.config/supabase-token", "SUPABASE_ACCESS_TOKEN")
    if not token:
        sys.exit("Falta el token de Supabase (~/.config/supabase-token)")
    sb = Supabase(token)

    secrets = {"SITE_URL": SITE_URL}
    if not FUNCTIONS_ONLY and stripe_key:
        print("2/3 Configurando Stripe")
        st = Stripe(stripe_key)
        code, acc = st.call("GET", "/account")
        if code != 200:
            sys.exit(f"Stripe rechazo la clave ({code}): {acc.get('error', {}).get('message', acc)}")
        print(f"  modo {st.mode}")
        secrets["STRIPE_SECRET_KEY"] = stripe_key
        secrets["STRIPE_WEBHOOK_SECRET"] = ensure_webhook(st)
        secrets["STRIPE_PORTAL_CONFIGURATION"] = ensure_portal(st)
    else:
        print("2/3 Sin Stripe (las funciones responderan 'not_configured')")

    code, res = sb.set_secrets(secrets)
    if code not in (200, 201):
        sys.exit(f"Supabase rechazo los secretos ({code}): {res}")
    print(f"  secretos en Supabase: {', '.join(secrets)}")

    print("3/3 Desplegando funciones")
    for name, verify_jwt in FUNCTIONS.items():
        code, res = sb.deploy(name, sources[name], verify_jwt)
        if code not in (200, 201):
            sys.exit(f"Supabase rechazo el despliegue de {name} ({code}): {res}")
        print(f"  {name}: desplegada")
    print("Hecho.")


if __name__ == "__main__":
    main()
