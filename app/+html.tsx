import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Esqueleto HTML de todas las paginas de la app (solo web, se genera al exportar). Incluye la pantalla de carga de marca
 * (#boot) para que, mientras se descarga el JavaScript, no haya una pantalla en blanco. Es identica a
 * components/custom/BootSplash.tsx, que la retira cuando la app ya ha pintado la suya (sin salto visible).
 */
const BOOT_CSS = `
#boot{position:fixed;inset:0;z-index:9998;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;
  background:#111827;color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;overflow:hidden}
#boot::before,#boot::after{content:"";position:absolute;border-radius:50%}
#boot::before{width:520px;height:520px;top:-190px;right:-170px;background:#4f46e5;opacity:.32}
#boot::after{width:440px;height:440px;bottom:-170px;left:-130px;background:#0891b2;opacity:.2}
#boot .logo{position:relative;width:72px;height:72px;border-radius:22px;background:#4f46e5;display:grid;place-items:center;margin-bottom:18px;box-shadow:0 10px 24px rgba(79,70,229,.55)}
#boot .logo::after{content:"";position:absolute;inset:0;border-radius:24px;border:2px solid #818cf8;animation:boot-ring 1.6s ease-out infinite}
#boot b{position:relative;font-size:26px;font-weight:800;letter-spacing:-.5px}
#boot p{position:relative;display:flex;align-items:center;gap:10px;margin:14px 0 0;font-size:15px;font-weight:500;color:#9ca3af}
#boot p i{width:16px;height:16px;border-radius:50%;border:2px solid #a5b4fc;border-right-color:transparent;animation:boot-spin .8s linear infinite}
@keyframes boot-ring{0%{transform:scale(1);opacity:.55}100%{transform:scale(1.45);opacity:0}}
@keyframes boot-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){#boot .logo::after{animation:none;opacity:0}#boot p i{animation-duration:2.4s}}
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#4f46e5" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: BOOT_CSS }} />
      </head>
      <body>
        {children}
        <div id="boot" role="progressbar" aria-label="Cargando Ticket Stdio" aria-live="polite">
          <div className="logo">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
              <path d="M13 5v2" />
              <path d="M13 17v2" />
              <path d="M13 11v2" />
            </svg>
          </div>
          <b>Ticket Stdio</b>
          <p>
            <i />
            Cargando…
          </p>
        </div>
        <noscript>
          <style dangerouslySetInnerHTML={{ __html: '#boot{display:none}' }} />
          <p style={{ padding: 24, fontFamily: 'system-ui,sans-serif' }}>Ticket Stdio necesita JavaScript para funcionar.</p>
        </noscript>
      </body>
    </html>
  );
}
