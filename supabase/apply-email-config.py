#!/usr/bin/env python3
"""Aplica en Supabase Auth el SMTP (Resend), las URLs permitidas y las plantillas de correo en castellano.

Lee:  supabase/email-config.json y supabase/email-templates/*.html
Usa:  ~/.config/supabase-token    token personal de Supabase (Management API)
      ~/.config/resend-ticket-key clave de API de Resend con permiso de envio (o la variable RESEND_API_KEY)

Uso:
  python3 supabase/apply-email-config.py --dry-run               muestra QUE claves cambiaria (sin secretos) y no toca nada
  python3 supabase/apply-email-config.py                         aplica SMTP + plantillas + URLs permitidas
  python3 supabase/apply-email-config.py --require-confirmation  ademas exige confirmar el correo al registrarse
                                                                 (mailer_autoconfirm = false)
"""
import json, os, sys, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
REF = os.environ.get("SUPABASE_PROJECT_REF", "zyiegqaaeltcgazcvbfs")
DRY = "--dry-run" in sys.argv
REQUIRE_CONFIRMATION = "--require-confirmation" in sys.argv


def secret(env, path):
    if os.environ.get(env):
        return os.environ[env].strip()
    p = os.path.expanduser(path)
    return open(p).read().strip() if os.path.exists(p) else ""


def build_payload(cfg, resend_key):
    smtp = cfg["smtp"]
    payload = {
        "site_url": cfg["site_url"],
        "uri_allow_list": cfg["uri_allow_list"],
        "rate_limit_email_sent": cfg["rate_limit_email_sent"],
        "mailer_otp_exp": cfg["mailer_otp_exp"],
        "smtp_host": smtp["host"],
        "smtp_port": smtp["port"],
        "smtp_user": smtp["user"],
        "smtp_pass": resend_key,
        "smtp_admin_email": smtp["admin_email"],
        "smtp_sender_name": smtp["sender_name"],
        "smtp_max_frequency": smtp["max_frequency"],
        "mailer_notifications_password_changed_enabled": True,
    }
    for key, subject in cfg["subjects"].items():
        payload[f"mailer_subjects_{key}"] = subject
        html = os.path.join(HERE, "email-templates", f"{key}.html")
        if os.path.exists(html):
            payload[f"mailer_templates_{key}_content"] = open(html, encoding="utf-8").read()
    if REQUIRE_CONFIRMATION:
        payload["mailer_autoconfirm"] = False
    return payload


def main():
    cfg = json.load(open(os.path.join(HERE, "email-config.json"), encoding="utf-8"))
    resend_key = secret("RESEND_API_KEY", "~/.config/resend-ticket-key")
    if not resend_key and not DRY:
        sys.exit("Falta la clave de Resend (~/.config/resend-ticket-key o RESEND_API_KEY).")
    payload = build_payload(cfg, resend_key or "<clave>")

    if DRY:
        print("Claves que se cambiarian (los valores secretos no se muestran):")
        for k, v in payload.items():
            shown = "<oculto>" if k == "smtp_pass" else (f"<{len(v)} caracteres>" if isinstance(v, str) and len(v) > 80 else v)
            print(f"  {k}: {shown}")
        return

    token = secret("SUPABASE_ACCESS_TOKEN", "~/.config/supabase-token")
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{REF}/config/auth", method="PATCH",
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    try:
        urllib.request.urlopen(req).read()
    except urllib.error.HTTPError as e:
        sys.exit(f"Supabase rechazo el cambio: {e.code} {e.read().decode()[:400]}")
    print("Configuracion de correo aplicada.")


if __name__ == "__main__":
    main()
