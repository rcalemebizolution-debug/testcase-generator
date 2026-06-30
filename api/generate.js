import { timingSafeEqual } from 'node:crypto'

const RATE_WINDOW_MS = 60_000
const RATE_LIMIT = 8
const CASE_TYPES = ['Positive', 'Negative', 'Validation', 'Boundary', 'Security', 'Usability', 'Resilience', 'Integration']
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical']
const rateStore = globalThis.__casecraftRateStore || new Map()
globalThis.__casecraftRateStore = rateStore

function matchesSecret(received, expected) {
  if (!received || !expected) return false
  const a = Buffer.from(received)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

function isRateLimited(ip) {
  const now = Date.now()
  const entry = rateStore.get(ip)
  if (!entry || now - entry.startedAt > RATE_WINDOW_MS) {
    rateStore.set(ip, { startedAt: now, count: 1 })
    return false
  }
  entry.count += 1
  return entry.count > RATE_LIMIT
}

const testCaseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['cases'],
  properties: {
    cases: {
      type: 'array',
      minItems: 3,
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'type', 'priority', 'title', 'module', 'subModule', 'description', 'precondition', 'steps', 'expected'],
        properties: {
          id: { type: 'string' },
          type: { type: 'string' },
          priority: { type: 'string' },
          title: { type: 'string' },
          module: { type: 'string' },
          subModule: { type: 'string' },
          description: { type: 'string' },
          precondition: { type: 'string' },
          steps: { type: 'array', minItems: 2, items: { type: 'string' } },
          expected: { type: 'string' },
        },
      },
    },
  },
}

function normalizeLabel(value, allowed, fallback) {
  const normalized = String(value || '').trim().toLowerCase()
  return allowed.find(label => label.toLowerCase() === normalized) || fallback
}

function normalizeCase(testCase, index, input) {
  const title = String(testCase.title || '').trim() || input.issueTitle
  const negativeFallback = /invalid|reject|prevent|denied|failure|error|missing|unauthori[sz]ed/i.test(title)
  const description = String(testCase.description || '').trim()
  const steps = Array.isArray(testCase.steps)
    ? testCase.steps.map(step => String(step || '').trim()).filter(Boolean)
    : []

  return {
    id: `TC-${String(index + 1).padStart(3, '0')}`,
    type: normalizeLabel(testCase.type, CASE_TYPES, negativeFallback ? 'Negative' : 'Positive'),
    priority: normalizeLabel(testCase.priority, PRIORITIES, 'Medium'),
    title,
    module: input.mainModule,
    subModule: input.subModule,
    description: description || `Verifies "${input.issueTitle}" based on the reported issue: ${input.issueDetails}`,
    precondition: String(testCase.precondition || input.precondition || 'User has access to the application.').trim(),
    steps: steps.length >= 2 ? steps : ['Open the relevant feature', 'Perform the test action', 'Observe the result'],
    expected: String(testCase.expected || 'The result is observable and matches the issue requirements.').trim(),
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' })

  if (!process.env.GROQ_API_KEY || !process.env.AI_ACCESS_CODE) {
    return res.status(503).json({ error: 'AI is not configured yet. Add GROQ_API_KEY and AI_ACCESS_CODE in Vercel.' })
  }

  if (!matchesSecret(req.headers['x-app-access-code'], process.env.AI_ACCESS_CODE)) {
    return res.status(401).json({ error: 'The AI access code is incorrect.' })
  }

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim()
  if (isRateLimited(ip)) return res.status(429).json({ error: 'Too many AI requests. Please wait one minute.' })

  const input = req.body || {}
  const required = ['mainModule', 'subModule', 'issueTitle', 'issueDetails', 'testSteps']
  if (required.some(key => typeof input[key] !== 'string' || !input[key].trim())) {
    return res.status(400).json({ error: 'Required issue details are missing.' })
  }

  const safeInput = Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, String(value).trim().slice(0, 4000)]),
  )
  const desiredCount = safeInput.coverage === 'Thorough' ? 8 : safeInput.coverage === 'Focused' ? 3 : 5

  try {
    const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b'
    const systemPrompt = `You are a senior QA engineer creating practical, real-world manual test cases. Return exactly ${desiredCount} distinct cases. Use the supplied module and sub-module exactly. The type field must be exactly one of: ${CASE_TYPES.join(', ')}. The priority field must be exactly one of: ${PRIORITIES.join(', ')}. Each description must clearly explain the specific scenario being verified and connect it directly to the supplied issue title and issue details. Cover realistic user behavior and the most relevant mix of happy path, invalid data, permissions, boundary values, interrupted workflows, integration failures, security, concurrency, session state, and recovery. Only include categories that genuinely apply. Make every step executable and every expected result observable and specific. Do not invent product requirements as facts; when an assumption is necessary, state it clearly in the description. Keep descriptions concise. Assign sequential IDs starting with TC-001.`

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Create a test suite from this issue context:\n${JSON.stringify(safeInput, null, 2)}` },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'test_case_suite',
            strict: true,
            schema: testCaseSchema,
          },
        },
      }),
    })

    const payload = await response.json()
    if (!response.ok) {
      const providerMessage = String(payload?.error?.message || '')
      const detail = providerMessage.includes('failed_generation') || providerMessage.includes('does not match the expected schema')
        ? 'The AI response could not be formatted correctly. Please generate again.'
        : String(providerMessage || 'Groq request failed.').slice(0, 240)
      return res.status(response.status).json({ error: detail })
    }

    const outputText = payload.choices?.[0]?.message?.content
    if (!outputText) return res.status(502).json({ error: 'The AI returned no test cases. Please try again.' })

    const parsed = JSON.parse(outputText)
    const cases = Array.isArray(parsed.cases)
      ? parsed.cases.map((testCase, index) => normalizeCase(testCase, index, safeInput)).slice(0, 10)
      : []
    if (cases.length < 3) return res.status(502).json({ error: 'The AI returned too few usable test cases. Please try again.' })
    return res.status(200).json({ cases, model })
  } catch (error) {
    console.error('AI generation failed:', error)
    return res.status(500).json({ error: 'AI generation failed unexpectedly. Please try again.' })
  }
}
