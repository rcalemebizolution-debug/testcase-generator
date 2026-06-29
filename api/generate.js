import { timingSafeEqual } from 'node:crypto'

const RATE_WINDOW_MS = 60_000
const RATE_LIMIT = 8
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
          type: { type: 'string', enum: ['Positive', 'Negative', 'Validation', 'Boundary', 'Security', 'Usability', 'Resilience', 'Integration'] },
          priority: { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'] },
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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' })

  if (!process.env.OPENAI_API_KEY || !process.env.AI_ACCESS_CODE) {
    return res.status(503).json({ error: 'AI is not configured yet. Add OPENAI_API_KEY and AI_ACCESS_CODE in Vercel.' })
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

  const safeInput = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, String(value).slice(0, 4000)]))
  const desiredCount = safeInput.coverage === 'Thorough' ? 8 : safeInput.coverage === 'Focused' ? 3 : 5

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5.4-mini',
        store: false,
        max_output_tokens: 7000,
        instructions: `You are a senior QA engineer creating practical, real-world manual test cases. Return exactly ${desiredCount} distinct cases. Use the supplied module and sub-module exactly. Cover realistic user behavior and the most relevant mix of happy path, invalid data, permissions, boundary values, interrupted workflows, integration failures, security, concurrency, session state, and recovery. Only include categories that genuinely apply. Make every step executable and every expected result observable and specific. Do not invent product requirements as facts; when an assumption is necessary, state it clearly in the description. Keep descriptions concise. Assign sequential IDs starting with TC-001.`,
        input: `Create a test suite from this issue context:\n${JSON.stringify(safeInput, null, 2)}`,
        text: {
          format: {
            type: 'json_schema',
            name: 'test_case_suite',
            strict: true,
            schema: testCaseSchema,
          },
        },
      }),
    })

    const payload = await response.json()
    if (!response.ok) {
      const detail = String(payload?.error?.message || 'OpenAI request failed.').slice(0, 240)
      return res.status(response.status).json({ error: detail })
    }

    const outputText = payload.output
      ?.flatMap(item => item.content || [])
      .find(content => content.type === 'output_text')?.text

    if (!outputText) return res.status(502).json({ error: 'The AI returned no test cases. Please try again.' })

    const parsed = JSON.parse(outputText)
    return res.status(200).json({ cases: parsed.cases, model: process.env.OPENAI_MODEL || 'gpt-5.4-mini' })
  } catch (error) {
    console.error('AI generation failed:', error)
    return res.status(500).json({ error: 'AI generation failed unexpectedly. Please try again.' })
  }
}
