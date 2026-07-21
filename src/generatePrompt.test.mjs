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
})
