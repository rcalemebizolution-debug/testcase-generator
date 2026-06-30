import assert from 'node:assert/strict'
import test from 'node:test'

import { createSuiteSnapshot, updateCaseField, updateCaseSteps } from './suiteStorage.js'

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

test('updateCaseField edits one case without mutating the original list', () => {
  const edited = updateCaseField(baseCases, 'TC-001', 'title', 'Edited title')

  assert.equal(edited[0].title, 'Edited title')
  assert.equal(baseCases[0].title, 'User can sign in — happy path')
})

test('updateCaseSteps converts textarea text into clean step array', () => {
  const edited = updateCaseSteps(baseCases, 'TC-001', '1. Open page\n\n- Submit form\n * Verify dashboard')

  assert.deepEqual(edited[0].steps, ['Open page', 'Submit form', 'Verify dashboard'])
})
