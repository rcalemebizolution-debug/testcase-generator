import { createClient } from '@supabase/supabase-js'
import { readSupabaseConfig } from './supabaseConfig.js'

const config = readSupabaseConfig(import.meta.env)

export const supabaseUrl = config.url
export const supabaseAnonKey = config.anonKey

export const supabaseEnabled = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = supabaseEnabled
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
