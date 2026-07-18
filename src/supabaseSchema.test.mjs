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

test('QA artifacts are user-owned, release-scoped, and protected by RLS', () => {
  for (const table of ['projects', 'releases', 'requirement_documents', 'requirement_versions', 'test_suites', 'suite_reviews', 'audit_events']) {
    assert.match(schema, new RegExp(`create table if not exists public\\.${table}`, 'i'))
    assert.match(schema, new RegExp(`alter table public\\.${table} enable row level security`, 'i'))
  }
  assert.match(schema, /auth\.uid\(\) = owner_id/i)
  assert.match(schema, /create policy "Owners can create projects"/i)
})
