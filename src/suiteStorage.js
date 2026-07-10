const fallbackTitle = 'Untitled test suite'

export function cleanStepText(step) {
  return String(step || '').replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '').trim()
}

export function stepsFromText(text) {
  return String(text || '').split('\n').map(cleanStepText).filter(Boolean)
}

export function createSuiteSnapshot({ form, cases, source = 'standard', existingId } = {}) {
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
    form: safeForm,
    cases: safeCases,
    updatedAt: now,
  }
}

export async function persistSavedSuite({ savedSuites = [], snapshot, save, limit = 12 } = {}) {
  const nextSuites = [snapshot, ...savedSuites.filter(item => item.id !== snapshot.id)].slice(0, limit)
  await save(nextSuites)
  return nextSuites
}

export function updateCaseField(cases, caseId, field, value) {
  return cases.map(item => item.id === caseId ? { ...item, [field]: value } : item)
}

export function updateCaseSteps(cases, caseId, text) {
  return updateCaseField(cases, caseId, 'steps', stepsFromText(text))
}
