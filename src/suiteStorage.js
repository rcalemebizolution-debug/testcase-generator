const fallbackTitle = 'Untitled test suite'

export function cleanStepText(step) {
  return String(step || '').replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '').trim()
}

export function stepsFromText(text) {
  return String(text || '').split('\n').map(cleanStepText).filter(Boolean)
}

export function createSuiteSnapshot({ form, cases, source = 'standard', existingId, ownerId } = {}) {
  const now = new Date().toISOString()
  const safeForm = { ...(form || {}) }
  const safeCases = Array.isArray(cases) ? cases.map(item => ({ ...item, steps: [...(item.steps || [])] })) : []

  return {
    id: existingId || `suite-${Date.now()}`,
    title: String(safeForm.issueTitle || '').trim() || fallbackTitle,
    module: String(safeForm.mainModule || '').trim(),
    subModule: String(safeForm.subModule || '').trim(),
    caseCount: safeCases.length,
    source,
    ...(ownerId ? { ownerId } : {}),
    form: safeForm,
    cases: safeCases,
    updatedAt: now,
  }
}

export function getSuitesForUser(suites, userId) {
  if (!userId) return []
  return (suites || []).filter(suite => suite.ownerId === userId)
}

export function assignUnownedSuites(suites, userId) {
  if (!userId) return suites || []
  return (suites || []).map(suite => suite.ownerId ? suite : { ...suite, ownerId: userId })
}

export async function persistSavedSuite({ savedSuites = [], snapshot, save, limit = 12 } = {}) {
  let nextSuites
  if (snapshot.ownerId) {
    const otherSuites = savedSuites.filter(item => item.ownerId !== snapshot.ownerId)
    const ownerSuites = [snapshot, ...savedSuites.filter(item => item.ownerId === snapshot.ownerId && item.id !== snapshot.id)].slice(0, limit)
    nextSuites = [...ownerSuites, ...otherSuites]
  } else {
    nextSuites = [snapshot, ...savedSuites.filter(item => item.id !== snapshot.id)].slice(0, limit)
  }
  await save(nextSuites)
  return nextSuites
}

export function updateCaseField(cases, caseId, field, value) {
  return cases.map(item => item.id === caseId ? { ...item, [field]: value } : item)
}

export function updateCaseSteps(cases, caseId, text) {
  return updateCaseField(cases, caseId, 'steps', stepsFromText(text))
}
