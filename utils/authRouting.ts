export const LOGIN_ROUTE = "/auth/login";
export const PROFILE_ROUTE = "/auth/completeProfile";
export const HOME_ROUTE = "/(tabs)/home";
export const RESET_ROUTE = "/auth/reset";

type RouteState = { pathname: string; hasSession: boolean; hasEmployee: boolean };

/**
 * Decide a donde hay que mandar al usuario segun su estado, o null si ya esta
 * en un sitio valido.
 *
 *  - sin sesion: solo se puede estar en /auth/* (login, registro). Antes se
 *    expulsaba tambien de /auth/signin hacia login.
 *  - con sesion pero sin ficha de empleado: hay que completar el perfil.
 *  - con sesion y empleado: las pantallas de /auth/* sobran, a la home.
 *  - /auth/reset es la excepcion: el enlace de recuperacion abre una sesion temporal y el usuario
 *    debe poder elegir su nueva contraseña antes de que se le lleve a la home.
 */
export function routeForState({ pathname: rawPathname, hasSession, hasEmployee }: RouteState): string | null {
  // En web expo-router devuelve la ruta CON el fragmento y la query ("/auth/reset#access_token=..."):
  // se comparan solo con la parte de la ruta.
  const pathname = rawPathname.split(/[?#]/)[0] || "/";
  const inAuth = pathname === "/auth" || pathname.startsWith("/auth/");
  if (pathname === RESET_ROUTE) return null;
  if (!hasSession) return inAuth ? null : LOGIN_ROUTE;
  if (!hasEmployee) return pathname === PROFILE_ROUTE ? null : PROFILE_ROUTE;
  return inAuth ? HOME_ROUTE : null;
}
