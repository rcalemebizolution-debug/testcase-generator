import { timingSafeEqual } from 'node:crypto'
import { createVisionUserContent, validateIssueImage } from '../src/issueImage.js'
import { createGroqResponseFormat } from '../src/groqResponseFormat.js'

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

function conciseRequirement(value, maxWords = 30) {
  const text = String(value || '').trim()
  const firstSentence = text.match(/^(.+?[.!?])(?:\s|$)/)?.[1] || text
  const words = firstSentence.split(/\s+/).filter(Boolean)
  return words.length > maxWords ? `${words.slice(0, maxWords).join(' ')}…` : firstSentence
}

function normalizeCase(testCase, index, input) {
  const featureTitle = input.workspace === 'development' ? input.featureName : input.issueTitle
  const title = String(testCase.title || '').trim() || featureTitle
  const negativeFallback = /invalid|reject|prevent|denied|failure|error|missing|unauthori[sz]ed/i.test(title)
  const description = String(testCase.description || '').trim()
  const steps = Array.isArray(testCase.steps)
    ? testCase.steps.map(step => String(step || '').trim()).filter(Boolean)
    : []
  const issueRequirement = String(input.workspace === 'development' ? input.description : input.issueDetails || '').trim()
  const generatedExpected = String(testCase.expected || '').trim()
  const preventsBypass = ['Negative', 'Validation', 'Boundary', 'Security'].includes(normalizeLabel(testCase.type, CASE_TYPES, 'Positive'))
  const requirementExpected = issueRequirement
    ? `${preventsBypass ? 'The stated rule cannot be bypassed: ' : 'Expected: '}${conciseRequirement(issueRequirement)}`
    : 'The result is observable and matches the stated issue requirements.'
  const isGenericExpected = /^(the result|the workflow|the system|expected behavior).*(requirements|expected result)/i.test(generatedExpected)

  return {
    id: `TC-${String(index + 1).padStart(3, '0')}`,
    type: normalizeLabel(testCase.type, CASE_TYPES, negativeFallback ? 'Negative' : 'Positive'),
    priority: normalizeLabel(testCase.priority, PRIORITIES, 'Medium'),
    title,
    module: input.workspace === 'development' ? input.module : input.mainModule,
    subModule: input.workspace === 'development' ? '' : input.subModule,
    description: description || (input.workspace === 'development'
      ? `Verifies "${input.featureName}" based on the supplied feature description: ${input.description}`
      : `Verifies "${input.issueTitle}" based on the reported issue: ${input.issueDetails}`),
    precondition: String(testCase.precondition || input.precondition || 'User has access to the application.').trim(),
    steps: steps.length >= 2 ? steps : ['Open the relevant feature', 'Perform the test action', 'Observe the result'],
    expected: generatedExpected && !isGenericExpected ? generatedExpected : requirementExpected,
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
  const isDevelopment = input.workspace === 'development'
  const required = isDevelopment ? ['featureName', 'description'] : ['mainModule', 'subModule', 'issueTitle', 'issueDetails', 'testSteps']
  if (required.some(key => typeof input[key] !== 'string' || !input[key].trim())) {
    return res.status(400).json({ error: isDevelopment ? 'Required feature details are missing.' : 'Required issue details are missing.' })
  }

  const imageResult = input.issueImage ? validateIssueImage(input.issueImage) : { ok: true, image: null }
  if (!imageResult.ok) return res.status(400).json({ error: imageResult.error })
  if (imageResult.image && isDevelopment) return res.status(400).json({ error: 'Issue screenshots are available only in the Maintenance workspace.' })
  if (imageResult.image && !process.env.GROQ_VISION_MODEL) {
    return res.status(422).json({ error: 'Screenshot analysis is not configured. Add GROQ_VISION_MODEL before generating with an image.' })
  }

  const safeInput = Object.fromEntries(
    Object.entries(input)
      .filter(([key]) => key !== 'issueImage')
      .map(([key, value]) => [key, String(value).trim().slice(0, 4000)]),
  )
  const desiredCount = safeInput.coverage === 'Thorough' || safeInput.coverage === 'Comprehensive' ? 8 : safeInput.coverage === 'Focused' ? 3 : 5

  try {
    const model = imageResult.image ? process.env.GROQ_VISION_MODEL : (process.env.GROQ_MODEL || 'openai/gpt-oss-120b')
    const contextInstruction = isDevelopment
      ? 'Design tests for a new feature before release. Use the supplied feature name, description, roles, flow, expected behavior, acceptance criteria, dependencies, and edge cases. Use the supplied module when present.'
      : 'Design tests for a maintenance issue. Use the supplied module and sub-module exactly and connect each scenario to the issue title and details.'
    const outputInstruction = imageResult.image
      ? 'Return valid JSON only, as an object with a cases array. Each case must include id, title, type, priority, description, precondition, steps, and expected.'
      : ''
    const systemPrompt = `You are the QA Lead accountable for deciding whether this change is safe to release. Create a concise, risk-based manual test suite—not a generic checklist. ${contextInstruction}

First identify the stated business rules, actors, data conditions, restrictions, integrations, timing rules, and failure risks. Then select the smallest set of distinct scenarios that gives meaningful release confidence. Do not pad the suite with generic cases.

Return exactly ${desiredCount} distinct cases. The type field must be exactly one of: ${CASE_TYPES.join(', ')}. The priority field must be exactly one of: ${PRIORITIES.join(', ')}. Assign Critical or High only when failure could block a core user journey, cause data loss/corruption, expose data, bypass authorization, or break an explicit business rule; otherwise use Medium or Low.

Cover the relevant mix of happy path, validation, permissions, boundary values, state transitions, retries/duplicates, interrupted workflows, integration failures, security, concurrency, session state, and recovery. Include a category only when the supplied issue makes it relevant. Do not invent requirements, limits, roles, messages, or integrations. If a necessary detail is uncertain, state it as an assumption in the description.

For every case: make the title specific to the risk; state a realistic precondition with required role/data/state; write atomic, executable steps with concrete test data when the issue provides it; and make the expected result observable. Each expected result must be one plain, concise sentence of no more than 35 words, focused only on that scenario's outcome. It must directly name the relevant outcome, rule, timing, restriction, or acceptance criterion from the issue description—never write generic text such as "the result matches the requirements." For negative, validation, boundary, and security cases, state exactly how the issue rule remains enforced and what must not be persisted, changed, or exposed. Across the complete suite, cover every relevant scenario and risk stated in the issue; do not try to combine every scenario into one expected result. Ensure cases do not overlap and each has a unique decision or risk focus. Keep wording concise. Assign sequential IDs starting with TC-001. ${outputInstruction}`

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
          { role: 'user', content: createVisionUserContent(`Create a test suite from this ${isDevelopment ? 'feature' : 'issue'} context:\n${JSON.stringify(safeInput, null, 2)}${imageResult.image ? '\n\nInspect the attached screenshot as issue evidence. Derive test scenarios from only visible UI behavior and clearly mark any uncertain interpretation as an assumption.' : ''}`, imageResult.image) },
        ],
        response_format: createGroqResponseFormat(testCaseSchema, Boolean(imageResult.image), model),
        reasoning_effort: imageResult.image && model === 'qwen/qwen3.6-27b' ? 'none' : undefined,
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
