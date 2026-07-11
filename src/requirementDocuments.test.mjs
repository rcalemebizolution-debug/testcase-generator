import assert from 'node:assert/strict'
import test from 'node:test'

import { applyRequirementDocumentDefaults, buildRequirementCoverage, createRequirementDocument, createRequirementDocumentDefaults, extractRequirementsFromText } from './requirementDocuments.js'

const sample = `Business Requirements\n\nBRD-REG-001 A customer can register with a valid email.\nBRD-REG-002 The password must contain at least eight characters.\nBRD-REG-003: A verification email must be sent.`

test('extractRequirementsFromText preserves explicit BRD requirement IDs', () => {
  assert.deepEqual(extractRequirementsFromText(sample), [
    { id: 'BRD-REG-001', text: 'A customer can register with a valid email.', approved: false },
    { id: 'BRD-REG-002', text: 'The password must contain at least eight characters.', approved: false },
    { id: 'BRD-REG-003', text: 'A verification email must be sent.', approved: false },
  ])
})

test('extractRequirementsFromText assigns stable IDs to requirement-like statements', () => {
  const extracted = extractRequirementsFromText('Users must accept the privacy policy before registration.\nThe system shall reject duplicate email addresses.')
  assert.deepEqual(extracted.map(item => item.id), ['REQ-001', 'REQ-002'])
})

test('createRequirementDocument stores file metadata and extracted requirements', () => {
  const document = createRequirementDocument({ name: 'Registration BRD.pdf', type: 'application/pdf', text: sample }, 'user-1')
  assert.equal(document.name, 'Registration BRD.pdf')
  assert.equal(document.ownerId, 'user-1')
  assert.equal(document.requirements.length, 3)
  assert.match(document.id, /^requirements-/)
})

test('approved BRD documents produce focused generator defaults', () => {
  const defaults = createRequirementDocumentDefaults({
    name: 'registration-brd.txt',
    requirements: [
      { id: 'BRD-REG-001', approved: true },
      { id: 'BRD-REG-002', approved: true },
      { id: 'BRD-REG-003', approved: false },
    ],
  })

  assert.deepEqual(defaults, {
    featureName: 'Registration',
    description: 'Validate the complete Registration workflow against all 2 approved requirements from registration-brd.txt.',
    selectedRequirementIds: ['BRD-REG-001', 'BRD-REG-002'],
  })
})

test('BRD defaults stay empty until at least one requirement is approved', () => {
  assert.deepEqual(createRequirementDocumentDefaults({ name: 'Checkout Requirements.docx', requirements: [] }), {
    featureName: '',
    description: '',
    selectedRequirementIds: [],
  })
})

test('approved BRD defaults fill blank generator fields and select all approved requirements', () => {
  const form = applyRequirementDocumentDefaults({ featureName: '', description: '', selectedRequirementIds: [] }, {
    id: 'doc-registration',
    name: 'registration-brd.txt',
    requirements: [{ id: 'BRD-REG-001', approved: true }, { id: 'BRD-REG-002', approved: true }],
  })

  assert.equal(form.featureName, 'Registration')
  assert.match(form.description, /all 2 approved requirements/)
  assert.equal(form.requirementDocumentId, 'doc-registration')
  assert.deepEqual(form.selectedRequirementIds, ['BRD-REG-001', 'BRD-REG-002'])
})

test('approved BRD defaults do not overwrite QA-entered scope', () => {
  const form = applyRequirementDocumentDefaults({ featureName: 'Email verification', description: 'Only verify activation.', selectedRequirementIds: ['BRD-REG-002'] }, {
    id: 'doc-registration',
    name: 'registration-brd.txt',
    requirements: [{ id: 'BRD-REG-001', approved: true }, { id: 'BRD-REG-002', approved: true }],
  })

  assert.equal(form.featureName, 'Email verification')
  assert.equal(form.description, 'Only verify activation.')
  assert.deepEqual(form.selectedRequirementIds, ['BRD-REG-002'])
})

test('buildRequirementCoverage links saved test cases back to requirements', () => {
  const requirements = [
    { id: 'BRD-REG-001', text: 'Registration works', approved: true },
    { id: 'BRD-REG-002', text: 'Email is unique', approved: true },
  ]
  const suites = [{ id: 'suite-1', title: 'Registration', cases: [
    { id: 'DTC-001', requirementIds: ['BRD-REG-001'] },
    { id: 'DTC-002', requirementIds: ['BRD-REG-001'] },
  ] }]

  assert.deepEqual(buildRequirementCoverage(requirements, suites), [
    { id: 'BRD-REG-001', text: 'Registration works', status: 'Covered', caseIds: ['DTC-001', 'DTC-002'] },
    { id: 'BRD-REG-002', text: 'Email is unique', status: 'Uncovered', caseIds: [] },
  ])
})
