import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const schema = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8')

test('profile role and status changes are protected by a database trigger', () => {
  assert.match(schema, /create or replace function public\.protect_profile_admin_fields\(\)/i)
  assert.match(schema, /old\.role is distinct from new\.role/i)
  assert.match(schema, /old\.status is distinct from new\.status/i)
  assert.match(schema, /before update on public\.profiles/i)
})
