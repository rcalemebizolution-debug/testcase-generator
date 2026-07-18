import assert from 'node:assert/strict'
import test from 'node:test'
import { createGroqResponseFormat } from './groqResponseFormat.js'

const schema = { type: 'object' }

test('vision omits response formatting so image-capable models are not constrained by unsupported structured output modes', () => {
  assert.equal(createGroqResponseFormat(schema, true), undefined)
})

test('text generation retains strict JSON Schema output', () => {
  assert.deepEqual(createGroqResponseFormat(schema, false), {
    type: 'json_schema', json_schema: { name: 'test_case_suite', strict: true, schema },
  })
})
