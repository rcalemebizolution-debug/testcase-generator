import assert from 'node:assert/strict'
import test from 'node:test'

import { DB_NAME, DB_VERSION, STORE_NAMES, createDraftRecord, createSessionRecord, stripRecordId } from './appDatabase.js'

test('database schema names the app database and expected stores', () => {
  assert.equal(DB_NAME, 'casecraft-db')
  assert.equal(DB_VERSION, 2)
  assert.deepEqual(STORE_NAMES, ['users', 'session', 'suites', 'draft'])
})

test('createSessionRecord stores the current session with a stable id', () => {
  const session = createSessionRecord({ id: 'user-1', name: 'Isaac', email: 'isaac@example.com' })

  assert.equal(session.id, 'current')
  assert.equal(session.userId, 'user-1')
  assert.equal(session.name, 'Isaac')
  assert.equal(session.email, 'isaac@example.com')
})

test('createDraftRecord stores the current form with a stable id', () => {
  const form = { issueTitle: 'Login works' }
  assert.deepEqual(createDraftRecord(form), { id: 'current', form })
})

test('stripRecordId removes database-only id from singleton records', () => {
  assert.deepEqual(stripRecordId({ id: 'current', form: { issueTitle: 'A' } }), { form: { issueTitle: 'A' } })
  assert.deepEqual(stripRecordId({ id: 'current', userId: 'user-1', name: 'Isaac' }), { id: 'user-1', name: 'Isaac' })
  assert.equal(stripRecordId(null), null)
})
