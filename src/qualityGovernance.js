const VALID_EXECUTION_STATUSES = new Set(['Not Run', 'Passed', 'Failed', 'Blocked', 'Skipped'])
const VALID_REVIEW_STATUSES = new Set(['Draft', 'Reviewed', 'Approved'])

function now() {
  return new Date().toISOString()
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function fingerprint(value) {
  let hash = 2166136261
  for (const character of String(value || '')) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

export function createProject({ id, name, ownerId, description = '' } = {}) {
  const createdAt = now()
  return {
    id: id || createId('project'),
    ownerId: String(ownerId || ''),
    name: String(name || '').trim() || 'Untitled project',
    description: String(description || '').trim(),
    createdAt,
    updatedAt: createdAt,
  }
}

export function createRelease({ id, projectId, name, ownerId, status = 'Draft', targetDate = '' } = {}) {
  const createdAt = now()
  return {
    id: id || createId('release'),
    projectId: String(projectId || ''),
    ownerId: String(ownerId || ''),
    name: String(name || '').trim() || 'Untitled release',
    status: ['Draft', 'In QA', 'Ready', 'Released'].includes(status) ? status : 'Draft',
    targetDate: String(targetDate || ''),
    createdAt,
    updatedAt: createdAt,
  }
}

export function createRequirementVersion({ id, document, projectId = '', releaseId = '', createdBy = '' } = {}) {
  const source = document || {}
  const requirements = (source.requirements || []).map(requirement => Object.freeze({
    id: String(requirement.id || '').trim(),
    text: String(requirement.text || '').trim(),
    approved: Boolean(requirement.approved),
  }))
  const createdAt = now()
  return {
    id: id || createId('requirement-version'),
    documentId: String(source.id || ''),
    projectId: String(projectId || ''),
    releaseId: String(releaseId || ''),
    createdBy: String(createdBy || source.ownerId || ''),
    documentName: String(source.name || 'Untitled requirements'),
    documentVersion: String(source.version || '1.0'),
    sourceFingerprint: fingerprint(source.text || requirements.map(item => `${item.id}:${item.text}`).join('\n')),
    sourceText: String(source.text || ''),
    requirements: Object.freeze(requirements),
    createdAt,
  }
}

function getRequirementStatus(cases) {
  if (!cases.length) return 'Uncovered'
  const execution = cases.map(testCase => testCase.executionStatus || 'Not Run')
  if (execution.includes('Blocked')) return 'Blocked'
  if (execution.includes('Failed')) return 'Failed'
  if (execution.includes('Passed')) return 'Passed'
  const review = cases.map(testCase => testCase.reviewStatus || 'Draft')
  if (review.includes('Approved')) return 'Approved'
  if (review.includes('Reviewed')) return 'Reviewed'
  return 'Generated'
}

export function buildReleaseReadiness(requirements = [], suites = []) {
  const items = requirements.map(requirement => {
    const cases = suites.flatMap(suite => suite.cases || []).filter(testCase => (testCase.requirementIds || []).includes(requirement.id))
    return { id: requirement.id, text: requirement.text, caseIds: cases.map(testCase => testCase.id), status: getRequirementStatus(cases) }
  })
  const summary = {
    total: items.length,
    passed: items.filter(item => item.status === 'Passed').length,
    failed: items.filter(item => item.status === 'Failed').length,
    blocked: items.filter(item => item.status === 'Blocked').length,
    reviewed: items.filter(item => ['Reviewed', 'Approved'].includes(item.status)).length,
    generated: items.filter(item => item.status === 'Generated').length,
    uncovered: items.filter(item => item.status === 'Uncovered').length,
  }
  summary.atRisk = summary.failed + summary.blocked
  return { items, summary, ready: summary.total > 0 && summary.uncovered === 0 && summary.atRisk === 0 }
}

export function createReviewRecord({ id, suiteId, caseId = '', actorId, decision, evidence = '', comment = '' } = {}) {
  return {
    id: id || createId('review'),
    suiteId: String(suiteId || ''),
    caseId: String(caseId || ''),
    actorId: String(actorId || ''),
    decision: ['Approved', 'Changes requested', 'Rejected'].includes(decision) ? decision : 'Changes requested',
    evidence: String(evidence || '').trim(),
    comment: String(comment || '').trim(),
    createdAt: now(),
  }
}

export function createAuditEvent({ id, actorId, action, entityType, entityId, metadata = {} } = {}) {
  return {
    id: id || createId('audit'),
    actorId: String(actorId || ''),
    action: String(action || ''),
    entityType: String(entityType || ''),
    entityId: String(entityId || ''),
    metadata: { ...metadata },
    createdAt: now(),
  }
}

export function validateGeneratedCases(cases = []) {
  const errors = []
  for (const testCase of cases) {
    if (!String(testCase.id || '').trim()) errors.push('Each case needs an ID.')
    if (!String(testCase.title || '').trim()) errors.push('Each case needs a title.')
    if (!String(testCase.type || '').trim()) errors.push('Each case needs a type.')
    if (!String(testCase.priority || '').trim()) errors.push('Each case needs a priority.')
    if (!String(testCase.precondition || '').trim()) errors.push('Each case needs a precondition.')
    if (!Array.isArray(testCase.steps) || testCase.steps.length === 0) errors.push('Each case needs test steps.')
    if (!String(testCase.expected || '').trim()) errors.push('Each case needs an expected result.')
  }
  return { ok: errors.length === 0, errors: [...new Set(errors)] }
}

export function normalizeCaseGovernance(testCase = {}) {
  return {
    ...testCase,
    reviewStatus: VALID_REVIEW_STATUSES.has(testCase.reviewStatus) ? testCase.reviewStatus : 'Draft',
    executionStatus: VALID_EXECUTION_STATUSES.has(testCase.executionStatus) ? testCase.executionStatus : 'Not Run',
    actualResult: String(testCase.actualResult || ''),
    bugLink: String(testCase.bugLink || ''),
    tester: String(testCase.tester || ''),
    testedAt: String(testCase.testedAt || ''),
    remarks: String(testCase.remarks || ''),
  }
}
