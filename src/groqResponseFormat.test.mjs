import assert from 'node:assert/strict'
import test from 'node:test'
import { createGroqResponseFormat } from './groqResponseFormat.js'

const schema = { type: 'object' }

test('vision uses JSON mode instead of unsupported JSON Schema', () => {
  assert.deepEqual(createGroqResponseFormat(schema, true), { type: 'json_object' })
})

test('text generation retains strict JSON Schema output', () => {
  assert.deepEqual(createGroqResponseFormat(schema, false), {
    type: 'json_schema', json_schema: { name: 'test_case_suite', strict: true, schema },
  })
})
