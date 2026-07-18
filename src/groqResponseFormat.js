export function createGroqResponseFormat(schema, usesVision) {
  if (usesVision) return undefined

  return {
    type: 'json_schema',
    json_schema: {
      name: 'test_case_suite',
      strict: true,
      schema,
    },
  }
}
