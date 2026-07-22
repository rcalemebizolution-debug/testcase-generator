import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../api/generate.js', import.meta.url), 'utf8')

test('AI prompt requires QA-lead risk-based test design', () => {
  assert.match(source, /QA Lead accountable for deciding whether this change is safe to release/)
  assert.match(source, /smallest set of distinct scenarios that gives meaningful release confidence/)
  assert.match(source, /Assign Critical or High only when failure could block a core user journey/)
  assert.match(source, /Do not invent requirements, limits, roles, messages, or integrations/)
  assert.match(source, /make the expected result observable/)
  assert.match(source, /one plain, precise sentence of no more than 45 words/)
  assert.match(source, /triggering action or condition, the specific UI\/data state to verify/)
  assert.match(source, /Never use generic statements such as/)
  assert.match(source, /cover every relevant scenario and risk stated in the issue/)
})

test('AI prompt grounds screenshot-based expected results in visible evidence', () => {
  assert.match(source, /The attached screenshot is evidence, not decoration/)
  assert.match(source, /anchor the expected result to at least one concrete visible UI fact/)
  assert.match(source, /Quote visible text only when it is legible/)
  assert.match(source, /specific enough that a tester can verify the visible UI or data state/)
})
