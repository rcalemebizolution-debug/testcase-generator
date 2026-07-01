import assert from 'node:assert/strict'
import test from 'node:test'

import { cmsTemplateToForm, deleteCmsTemplate, upsertCmsTemplate, validateCmsTemplate } from './cmsStorage.js'

const baseTemplate = {
  title: 'Checkout flow',
  mainModule: 'Orders',
  subModule: 'Checkout',
  issueDetails: 'Customer can place an order with valid payment details.',
  precondition: 'Customer has items in the cart.',
  testSteps: 'Open cart\nProceed to checkout\nPay with a valid card',
  priority: 'High',
  coverage: 'Thorough',
  status: 'Published',
}

test('validateCmsTemplate requires content needed to generate a suite', () => {
  assert.equal(validateCmsTemplate({}), 'Enter a template title.')
  assert.equal(validateCmsTemplate({ ...baseTemplate, title: 'Checkout' }), '')
})

test('upsertCmsTemplate adds and replaces templates without duplicating ids', () => {
  const created = upsertCmsTemplate([], baseTemplate, 'cms-1')
  assert.equal(created.ok, true)
  assert.equal(created.template.id, 'cms-1')
  assert.equal(created.templates.length, 1)

  const edited = upsertCmsTemplate(created.templates, { ...baseTemplate, title: 'Edited checkout' }, 'cms-1')
  assert.equal(edited.ok, true)
  assert.equal(edited.templates.length, 1)
  assert.equal(edited.templates[0].title, 'Edited checkout')
})

test('cmsTemplateToForm maps CMS content into the generator draft', () => {
  assert.deepEqual(cmsTemplateToForm(baseTemplate), {
    mainModule: 'Orders',
    subModule: 'Checkout',
    issueTitle: 'Checkout flow',
    issueDetails: 'Customer can place an order with valid payment details.',
    precondition: 'Customer has items in the cart.',
    testSteps: 'Open cart\nProceed to checkout\nPay with a valid card',
    priority: 'High',
    coverage: 'Thorough',
  })
})

test('deleteCmsTemplate removes the matching template only', () => {
  const remaining = deleteCmsTemplate([{ id: 'cms-1' }, { id: 'cms-2' }], 'cms-1')
  assert.deepEqual(remaining, [{ id: 'cms-2' }])
})
