import assert from 'node:assert/strict'
import test from 'node:test'

import { createDevelopmentAiPayload, createDevelopmentCases, developmentBlankForm, developmentExample } from './developmentTestDesign.js'

const feature = {
  ...developmentBlankForm,
  featureName: 'Team invitation',
  module: 'Workspace members',
  description: 'Workspace owners can invite teammates by email.',
  userRoles: 'Workspace owner\nInvited teammate',
  userFlow: 'Open team settings\nEnter an email address\nSend invitation\nAccept the invitation',
  expectedBehavior: 'The teammate joins the workspace with the selected role.',
  acceptanceCriteria: 'Only owners can invite\nDuplicate active members cannot be invited',
  dependencies: 'Email delivery service\nAuthentication service',
  edgeCases: 'Expired invitation\nInvitation email already belongs to a member',
  priority: 'High',
  coverage: 'Comprehensive',
}

test('development blank form contains the complete feature-design inputs', () => {
  assert.deepEqual(Object.keys(developmentBlankForm), [
    'featureName', 'module', 'description', 'userRoles', 'userFlow',
    'expectedBehavior', 'acceptanceCriteria', 'dependencies', 'edgeCases',
    'priority', 'coverage',
  ])
})

test('development example fills every feature-design section', () => {
  for (const key of Object.keys(developmentBlankForm)) {
    assert.ok(String(developmentExample[key]).trim(), `${key} should be populated`)
  }
  assert.equal(developmentExample.coverage, 'Comprehensive')
})

test('development AI payload remains compatible with the shared generation endpoint', () => {
  const payload = createDevelopmentAiPayload(feature)

  assert.equal(payload.workspace, 'development')
  assert.equal(payload.featureName, feature.featureName)
  assert.equal(payload.mainModule, feature.module)
  assert.equal(payload.subModule, 'Feature delivery')
  assert.equal(payload.issueTitle, feature.featureName)
  assert.match(payload.issueDetails, /Acceptance criteria:/)
  assert.equal(payload.coverage, 'Thorough')
})

test('createDevelopmentCases requires a feature name and description', () => {
  assert.deepEqual(createDevelopmentCases(developmentBlankForm), {
    ok: false,
    errors: { featureName: true, description: true },
    cases: [],
  })
})

test('createDevelopmentCases generates feature, role, acceptance, dependency, and edge coverage', () => {
  const result = createDevelopmentCases(feature)
  assert.equal(result.ok, true)
  assert.deepEqual(result.errors, {})
  assert.deepEqual(result.cases.map(item => item.type), [
    'Positive', 'Acceptance', 'Access', 'Integration', 'Edge case',
  ])
  assert.equal(result.cases[0].title, 'Team invitation — primary user flow')
  assert.deepEqual(result.cases[0].steps, [
    'Open team settings', 'Enter an email address', 'Send invitation', 'Accept the invitation',
  ])
  assert.match(result.cases[2].description, /Workspace owner/)
  assert.match(result.cases[3].expected, /safe, actionable error/i)
  assert.match(result.cases[4].steps.join(' '), /Expired invitation/)
})

test('focused coverage creates only the primary feature case', () => {
  const result = createDevelopmentCases({ ...feature, coverage: 'Focused' })
  assert.equal(result.ok, true)
  assert.equal(result.cases.length, 1)
  assert.equal(result.cases[0].type, 'Positive')
})

test('generated development cases retain selected requirement traceability', () => {
  const result = createDevelopmentCases({ ...feature, selectedRequirementIds: ['BRD-REG-001', 'BRD-REG-002'] })
  assert.deepEqual(result.cases[0].requirementIds, ['BRD-REG-001', 'BRD-REG-002'])
})
