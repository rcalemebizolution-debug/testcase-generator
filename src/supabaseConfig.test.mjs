import test from 'node:test'
import assert from 'node:assert/strict'

import { readSupabaseConfig } from './supabaseConfig.js'

test('readSupabaseConfig keeps the project URL separate from the anon key', () => {
  const config = readSupabaseConfig({
    VITE_SUPABASE_URL: 'https://example.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon-secret',
    VITE_SUPABASE_PUBLIC_ANON_KEY: 'public-fallback',
  })

  assert.deepEqual(config, {
    url: 'https://example.supabase.co',
    anonKey: 'anon-secret',
  })
})

test('readSupabaseConfig accepts the current Supabase publishable key name', () => {
  const config = readSupabaseConfig({
    VITE_SUPABASE_URL: 'https://example.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
  })

  assert.deepEqual(config, {
    url: 'https://example.supabase.co',
    anonKey: 'sb_publishable_example',
  })
})

test('readSupabaseConfig accepts the public anon key fallback', () => {
  const config = readSupabaseConfig({
    VITE_SUPABASE_URL: 'https://example.supabase.co',
    VITE_SUPABASE_PUBLIC_ANON_KEY: 'public-fallback',
  })

  assert.deepEqual(config, {
    url: 'https://example.supabase.co',
    anonKey: 'public-fallback',
  })
})
