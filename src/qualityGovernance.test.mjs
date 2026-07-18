import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildReleaseReadiness,
  createProject,
  createRelease,
  createRequirementVersion,
  createReviewRecord,
  createAuditEvent,
  validateGeneratedCases,
} from './qualityGovernance.js'

test('project and release records preserve ownership and a release boundary', () => {
  const project = createProject({ name: 'Customer Portal', ownerId: 'user-1' })
  const release = createRelease({ projectId: project.id, name: 'v2.4 Password recovery', ownerId: 'user-1' })

  assert.equal(project.ownerId, 'user-1')
  assert.equal(release.ownerId, 'user-1')
  assert.equal(release.projectId, project.id)
  assert.equal(release.status, 'Draft')
})

test('requirement versions preserve immutable source and approval snapshots', () => {
  const version = createRequirementVersion({
    document: { id: 'doc-1', name: 'Registration BRD', version: '1.0', text: 'REQ-1: User must register', requirements: [{ id: 'REQ-1', text: 'User must register', approved: true }] },
    projectId: 'project-1',
    releaseId: 'release-1',
  })

  assert.equal(version.documentId, 'doc-1')
  assert.equal(version.projectId, 'project-1')
  assert.equal(version.releaseId, 'release-1')
  assert.equal(version.requirements[0].id, 'REQ-1')
  assert.notEqual(version.sourceFingerprint, '')
  assert.equal(Object.isFrozen(version.requirements), true)
})

test('release readiness distinguishes generated, reviewed, passed, blocked, and uncovered requirements', () => {
  const requirements = [
    { id: 'REQ-1', text: 'A' }, { id: 'REQ-2', text: 'B' }, { id: 'REQ-3', text: 'C' }, { id: 'REQ-4', text: 'D' }, { id: 'REQ-5', text: 'E' },
  ]
  const suites = [{
    id: 'suite-1',
    cases: [
      { id: 'TC-1', requirementIds: ['REQ-1'], reviewStatus: 'Reviewed', executionStatus: 'Passed' },
      { id: 'TC-2', requirementIds: ['REQ-2'], reviewStatus: 'Reviewed', executionStatus: 'Blocked' },
      { id: 'TC-3', requirementIds: ['REQ-3'], reviewStatus: 'Draft', executionStatus: 'Not Run' },
      { id: 'TC-4', requirementIds: ['REQ-4'], reviewStatus: 'Reviewed', executionStatus: 'Not Run' },
    ],
  }]

  const readiness = buildReleaseReadiness(requirements, suites)
  assert.deepEqual(readiness.items.map(item => item.status), ['Passed', 'Blocked', 'Generated', 'Reviewed', 'Uncovered'])
  assert.equal(readiness.ready, false)
  assert.equal(readiness.summary.uncovered, 1)
  assert.equal(readiness.summary.atRisk, 1)
})

test('review records and audit events retain actors and evidence', () => {
  const review = createReviewRecord({ suiteId: 'suite-1', actorId: 'qa-lead', decision: 'Approved', evidence: 'Regression evidence attached' })
  const audit = createAuditEvent({ actorId: 'qa-lead', action: 'suite.approved', entityType: 'suite', entityId: 'suite-1' })

  assert.equal(review.decision, 'Approved')
  assert.equal(review.evidence, 'Regression evidence attached')
  assert.equal(audit.actorId, 'qa-lead')
  assert.equal(audit.entityId, 'suite-1')
})

test('generated cases need the manual QA fields before review', () => {
  const invalid = validateGeneratedCases([{ id: 'TC-1', title: 'Missing fields', steps: [], expected: '' }])
  const valid = validateGeneratedCases([{ id: 'TC-1', title: 'Complete', type: 'Positive', priority: 'High', precondition: 'Signed in', steps: ['Submit'], expected: 'Saved', requirementIds: ['REQ-1'] }])

  assert.equal(invalid.ok, false)
  assert.equal(invalid.errors.some(error => /steps/i.test(error)), true)
  assert.equal(valid.ok, true)
})
