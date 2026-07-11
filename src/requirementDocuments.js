const STORAGE_KEY = 'casecraft-requirement-documents-v1'
const REQUIREMENT_LINE = /^\s*([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)[\s:–—-]+(.+?)\s*$/i
const REQUIREMENT_LANGUAGE = /\b(must|shall|should|can|will|is required to|are required to|able to)\b/i

export function extractRequirementsFromText(text) {
  const rawLines = String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const explicit = rawLines.map(line => {
    const match = line.match(REQUIREMENT_LINE)
    return match ? { id: match[1].toUpperCase(), text: match[2].trim(), approved: false } : null
  }).filter(Boolean)
  if (explicit.length) return explicit.filter((item, index, all) => all.findIndex(candidate => candidate.id === item.id) === index)

  const statements = rawLines
    .flatMap(line => line.split(/(?<=[.!?])\s+/))
    .map(line => line.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '').trim())
    .filter(line => line.length >= 15 && REQUIREMENT_LANGUAGE.test(line))

  return statements.map((statement, index) => ({
    id: `REQ-${String(index + 1).padStart(3, '0')}`,
    text: statement,
    approved: false,
  }))
}

export function createRequirementDocument({ name, type, text }, ownerId) {
  const now = new Date().toISOString()
  return {
    id: `requirements-${Date.now()}`,
    ownerId,
    name: name || 'Untitled requirements',
    type: type || 'text/plain',
    version: '1.0',
    text: String(text || '').slice(0, 200000),
    requirements: extractRequirementsFromText(text),
    createdAt: now,
    updatedAt: now,
  }
}

export function createRequirementDocumentDefaults(requirementDocument) {
  const approvedRequirements = (requirementDocument?.requirements || []).filter(requirement => requirement.approved)
  if (!approvedRequirements.length) return { featureName: '', description: '', selectedRequirementIds: [] }

  const cleanedName = String(requirementDocument?.name || '')
    .replace(/\.[^.]+$/, '')
    .replace(/\bv(?:ersion)?[\s._-]*\d+(?:\.\d+)*\b/gi, '')
    .replace(/\b(?:brd|business requirements document|requirements?|specifications?|spec)\b/gi, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const featureName = (cleanedName || 'BRD feature').replace(/\b\w/g, character => character.toUpperCase())
  const count = approvedRequirements.length

  return {
    featureName,
    description: `Validate the complete ${featureName} workflow against all ${count} approved requirement${count === 1 ? '' : 's'} from ${requirementDocument.name}.`,
    selectedRequirementIds: approvedRequirements.map(requirement => requirement.id),
  }
}

export function applyRequirementDocumentDefaults(form, requirementDocument) {
  const defaults = createRequirementDocumentDefaults(requirementDocument)
  if (!defaults.selectedRequirementIds.length) return form

  return {
    ...form,
    requirementDocumentId: requirementDocument.id,
    featureName: form.featureName?.trim() ? form.featureName : defaults.featureName,
    description: form.description?.trim() ? form.description : defaults.description,
    selectedRequirementIds: form.selectedRequirementIds?.length ? form.selectedRequirementIds : defaults.selectedRequirementIds,
  }
}

export function buildRequirementCoverage(requirements, suites) {
  return (requirements || []).map(requirement => {
    const caseIds = []
    for (const suite of suites || []) {
      for (const testCase of suite.cases || []) {
        if ((testCase.requirementIds || []).includes(requirement.id) && !caseIds.includes(testCase.id)) caseIds.push(testCase.id)
      }
    }
    return { id: requirement.id, text: requirement.text, status: caseIds.length ? 'Covered' : 'Uncovered', caseIds }
  })
}

export function loadRequirementDocuments(ownerId) {
  try {
    const documents = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(documents) ? documents.filter(document => document.ownerId === ownerId) : []
  } catch {
    return []
  }
}

export function saveRequirementDocuments(ownerId, ownerDocuments) {
  let allDocuments = []
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    if (Array.isArray(parsed)) allDocuments = parsed
  } catch {
    allDocuments = []
  }
  const others = allDocuments.filter(document => document.ownerId !== ownerId)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ownerDocuments, ...others]))
    return true
  } catch {
    return false
  }
}

function loadBrowserScript(source) {
  return new Promise((resolve, reject) => {
    const existing = [...document.scripts].find(script => script.src === source)
    if (existing && window.mammoth) return resolve()
    const script = document.createElement('script')
    script.src = source
    script.onload = resolve
    script.onerror = () => reject(new Error('The document reader could not be loaded. Check your internet connection.'))
    document.head.appendChild(script)
  })
}

export async function readRequirementFile(file) {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension === 'txt' || file.type.startsWith('text/')) return file.text()

  if (extension === 'docx') {
    const source = 'https://cdn.jsdelivr.net/npm/mammoth@1.10.0/mammoth.browser.min.js'
    if (!window.mammoth) await loadBrowserScript(source)
    const result = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    return result.value
  }

  if (extension === 'pdf') {
    const pdfjs = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.149/build/pdf.mjs')
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.149/build/pdf.worker.mjs'
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
    const pages = []
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      pages.push(content.items.map(item => item.str).join(' '))
    }
    return pages.join('\n')
  }

  throw new Error('Unsupported file type. Upload a PDF, DOCX, or TXT document.')
}
