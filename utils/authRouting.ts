export const LOGIN_ROUTE = "/auth/login";
export const PROFILE_ROUTE = "/auth/completeProfile";
export const HOME_ROUTE = "/(tabs)/home";

type RouteState = { pathname: string; hasSession: boolean; hasEmployee: boolean };

/**
 * Decide a donde hay que mandar al usuario segun su estado, o null si ya esta
 * en un sitio valido.
 *
 *  - sin sesion: solo se puede estar en /auth/* (login, registro). Antes se
 *    expulsaba tambien de /auth/signin hacia login.
 *  - con sesion pero sin ficha de empleado: hay que completar el perfil.
 *  - con sesion y empleado: las pantallas de /auth/* sobran, a la home.
 */
export function routeForState({ pathname, hasSession, hasEmployee }: RouteState): string | null {
  const inAuth = pathname === "/auth" || pathname.startsWith("/auth/");
  if (!hasSession) return inAuth ? null : LOGIN_ROUTE;
  if (!hasEmployee) return pathname === PROFILE_ROUTE ? null : PROFILE_ROUTE;
  return inAuth ? HOME_ROUTE : null;
}
