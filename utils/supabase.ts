import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import { createClient } from '@supabase/supabase-js'
import { friendlyAuthError } from './authErrors'

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_KEY!,
  {
    auth: {
      storage: Platform.OS === 'web' ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  })

export type AuthResult =
  | { ok: true; needsConfirmation: boolean }
  | { ok: false; message: string }

// Antes estas funciones usaban Alert.alert (no hace nada en react-native-web, asi
// que en la web los errores eran invisibles) y volcaban en consola el objeto
// completo de la sesion, con access/refresh token. Ahora devuelven el resultado
// y es la pantalla quien lo muestra.
export async function login(email: string, password: string): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) return { ok: false, message: friendlyAuthError(error.message) }
    return { ok: true, needsConfirmation: false }
  } catch (e: any) {
    return { ok: false, message: friendlyAuthError(e?.message) }
  }
}

export async function signin(email: string, password: string): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
    if (error) return { ok: false, message: friendlyAuthError(error.message) }
    // Con la confirmacion de email activa, Supabase no da error si el email ya
    // existe: devuelve un usuario sin identidades.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return { ok: false, message: friendlyAuthError('User already registered') }
    }
    return { ok: true, needsConfirmation: !data.session }
  } catch (e: any) {
    return { ok: false, message: friendlyAuthError(e?.message) }
  }
}
