import assert from 'node:assert/strict'
import test from 'node:test'

import { assignUnownedSuites, createSuiteSnapshot, getSuitesForUser, persistSavedSuite, updateCaseField, updateCaseSteps } from './suiteStorage.js'

const baseForm = {
  mainModule: 'Authentication',
  subModule: 'Login',
  issueTitle: 'User can sign in',
  issueDetails: 'Registered user signs in successfully.',
  precondition: '',
  testSteps: 'Open login page',
  priority: 'High',
  coverage: 'Balanced',
}

const baseCases = [{
  id: 'TC-001',
  type: 'Positive',
  priority: 'High',
  title: 'User can sign in — happy path',
  module: 'Authentication',
  subModule: 'Login',
  description: 'Valid login works',
  precondition: 'User exists',
  steps: ['Open login page', 'Enter credentials'],
  expected: 'Dashboard opens',
}]

test('createSuiteSnapshot stores editable cases with metadata', () => {
  const saved = createSuiteSnapshot({ form: baseForm, cases: baseCases, source: 'standard', existingId: 'suite-1' })

  assert.equal(saved.id, 'suite-1')
  assert.equal(saved.title, 'User can sign in')
  assert.equal(saved.module, 'Authentication')
  assert.equal(saved.caseCount, 1)
  assert.deepEqual(saved.cases, baseCases)
  assert.ok(saved.updatedAt)
})

test('private suites are visible only to their creator', () => {
  const mine = createSuiteSnapshot({ form: baseForm, cases: baseCases, existingId: 'mine', ownerId: 'user-1' })
  const theirs = createSuiteSnapshot({ form: baseForm, cases: baseCases, existingId: 'theirs', ownerId: 'user-2' })

  assert.equal(mine.ownerId, 'user-1')
  assert.deepEqual(getSuitesForUser([mine, theirs], 'user-1').map(item => item.id), ['mine'])
})

test('legacy suites without an owner are assigned once to the current user', () => {
  const legacy = createSuiteSnapshot({ form: baseForm, cases: baseCases, existingId: 'legacy' })
  const owned = createSuiteSnapshot({ form: baseForm, cases: baseCases, existingId: 'owned', ownerId: 'user-2' })
  const migrated = assignUnownedSuites([legacy, owned], 'user-1')

  assert.equal(migrated[0].ownerId, 'user-1')
  assert.equal(migrated[1].ownerId, 'user-2')
})

test('persistSavedSuite writes the updated collection before reporting success', async () => {
  const existing = createSuiteSnapshot({ form: baseForm, cases: baseCases, existingId: 'suite-old' })
  const replacement = createSuiteSnapshot({ form: { ...baseForm, issueTitle: 'Updated suite' }, cases: baseCases, existingId: 'suite-new' })
  let persisted = null

  const result = await persistSavedSuite({
    savedSuites: [existing],
    snapshot: replacement,
    save: async suites => { persisted = suites },
  })

  assert.deepEqual(result, persisted)
  assert.equal(result[0].id, 'suite-new')
  assert.equal(result[1].id, 'suite-old')
})

test('persistSavedSuite limits only the creator collection and preserves other users suites', async () => {
  const mine = Array.from({ length: 12 }, (_, index) => ({ id: `mine-${index}`, ownerId: 'user-1' }))
  const theirs = [{ id: 'theirs', ownerId: 'user-2' }]
  const snapshot = { id: 'mine-new', ownerId: 'user-1' }

  const result = await persistSavedSuite({
    savedSuites: [...mine, ...theirs],
    snapshot,
    save: async () => {},
  })

  assert.equal(result.filter(item => item.ownerId === 'user-1').length, 12)
  assert.ok(result.some(item => item.id === 'theirs'))
})

test('updateCaseField edits one case without mutating the original list', () => {
  const edited = updateCaseField(baseCases, 'TC-001', 'title', 'Edited title')

  assert.equal(edited[0].title, 'Edited title')
  assert.equal(baseCases[0].title, 'User can sign in — happy path')
})

test('updateCaseSteps converts textarea text into clean step array', () => {
  const edited = updateCaseSteps(baseCases, 'TC-001', '1. Open page\n\n- Submit form\n * Verify dashboard')

  assert.deepEqual(edited[0].steps, ['Open page', 'Submit form', 'Verify dashboard'])
})
