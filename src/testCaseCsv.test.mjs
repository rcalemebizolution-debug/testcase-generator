import assert from 'node:assert/strict'
import test from 'node:test'

import { buildTestCaseCsv } from './testCaseCsv.js'

const columns = ['Test Cases #', 'Priority', 'Module', 'Sub-Module', 'Test Scenario', 'Description', 'Pre-Condition', 'Steps / Test Data', 'Expected Result', 'Actual Result', 'Status', 'Bug Link/ID', 'Tester', 'Date Tested', 'Remarks']

test('CSV follows the Maintenance test-case template', () => {
  const csv = buildTestCaseCsv([{
    id: 'DTC-001',
    priority: 'High',
    module: 'Registration',
    subModule: '',
    title: 'Register with valid details',
    description: 'Verify successful registration',
    precondition: 'Visitor is logged out',
    steps: ['Open registration', 'Submit valid details'],
    expected: 'Pending account is created',
  }])

  const [header, row] = csv.split('\r\n')
  assert.equal(header, columns.map(value => `"${value}"`).join(','))
  assert.match(row, /^"DTC-001","High","Registration","","Register with valid details"/)
  assert.match(row, /"1\. Open registration\n2\. Submit valid details"/)
  assert.equal(row.split(',').length, 15)
})

test('CSV escapes quotes using RFC-compatible doubled quotes', () => {
  const csv = buildTestCaseCsv([{ id: 'DTC-002', title: 'Reject "existing" email', steps: [] }])
  assert.match(csv, /"Reject ""existing"" email"/)
})
