import assert from 'node:assert/strict'
import test from 'node:test'
import { createGroqResponseFormat } from './groqResponseFormat.js'

const schema = { type: 'object' }

test('Qwen vision uses JSON mode so the response can be parsed safely', () => {
  assert.deepEqual(createGroqResponseFormat(schema, true, 'qwen/qwen3.6-27b'), { type: 'json_object' })
})

test('other vision models omit response formatting when JSON mode is unsupported', () => {
  assert.equal(createGroqResponseFormat(schema, true, 'another-vision-model'), undefined)
})

test('text generation retains strict JSON Schema output', () => {
  assert.deepEqual(createGroqResponseFormat(schema, false), {
    type: 'json_schema', json_schema: { name: 'test_case_suite', strict: true, schema },
  })
})
