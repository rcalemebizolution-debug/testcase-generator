const fallbackTemplate = 'Untitled template'

export const blankCmsTemplate = {
  title: '',
  mainModule: '',
  subModule: '',
  issueDetails: '',
  precondition: '',
  testSteps: '',
  priority: 'Medium',
  coverage: 'Balanced',
  status: 'Draft',
}

export function normalizeCmsTemplate(template = {}) {
  return {
    ...blankCmsTemplate,
    ...template,
    title: String(template.title || '').trim(),
    mainModule: String(template.mainModule || '').trim(),
    subModule: String(template.subModule || '').trim(),
    issueDetails: String(template.issueDetails || '').trim(),
    precondition: String(template.precondition || '').trim(),
    testSteps: String(template.testSteps || '').trim(),
    priority: ['Low', 'Medium', 'High', 'Critical'].includes(template.priority) ? template.priority : 'Medium',
    coverage: ['Focused', 'Balanced', 'Thorough'].includes(template.coverage) ? template.coverage : 'Balanced',
    status: ['Draft', 'Published'].includes(template.status) ? template.status : 'Draft',
  }
}

export function validateCmsTemplate(template = {}) {
  const item = normalizeCmsTemplate(template)
  if (!item.title) return 'Enter a template title.'
  if (!item.mainModule) return 'Enter the main module.'
  if (!item.subModule) return 'Enter the sub module.'
  if (!item.issueDetails) return 'Enter issue details for the template.'
  if (!item.testSteps) return 'Enter at least one test step.'
  return ''
}

export function upsertCmsTemplate(templates, template, existingId = '') {
  const safeTemplates = Array.isArray(templates) ? templates : []
  const error = validateCmsTemplate(template)
  if (error) return { ok: false, error, templates: safeTemplates }

  const now = new Date().toISOString()
  const normalized = normalizeCmsTemplate(template)
  const item = {
    id: existingId || template.id || `cms-${Date.now()}`,
    ...normalized,
    updatedAt: now,
  }

  return {
    ok: true,
    template: item,
    templates: [item, ...safeTemplates.filter(entry => entry.id !== item.id)],
  }
}

export function deleteCmsTemplate(templates, templateId) {
  return (Array.isArray(templates) ? templates : []).filter(entry => entry.id !== templateId)
}

export function cmsTemplateToForm(template = {}) {
  const item = normalizeCmsTemplate(template)
  return {
    mainModule: item.mainModule,
    subModule: item.subModule,
    issueTitle: item.title || fallbackTemplate,
    issueDetails: item.issueDetails,
    precondition: item.precondition,
    testSteps: item.testSteps,
    priority: item.priority,
    coverage: item.coverage,
  }
}
