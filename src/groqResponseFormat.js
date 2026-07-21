export function createGroqResponseFormat(schema, usesVision, model) {
  if (usesVision) {
    if (model === 'qwen/qwen3.6-27b') return { type: 'json_object' }
    return undefined
  }

  return {
    type: 'json_schema',
    json_schema: {
      name: 'test_case_suite',
      strict: true,
      schema,
    },
  }
}
