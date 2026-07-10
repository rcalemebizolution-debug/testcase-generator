export function readSupabaseConfig(env = {}) {
  return {
    url: env.VITE_SUPABASE_URL || '',
    anonKey: env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLIC_ANON_KEY || '',
  }
}
