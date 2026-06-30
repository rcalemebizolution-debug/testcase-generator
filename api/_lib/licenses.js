import crypto from 'node:crypto'
import { Redis } from '@upstash/redis'

const LICENSE_KEY_PREFIX = 'casecraft:license'
const LICENSE_INDEX_KEY = 'casecraft:licenses'
const DEFAULT_TIMEZONE = process.env.QUOTA_TIMEZONE || 'Asia/Manila'
const DEFAULT_MONTHLY_GENERATIONS = 100
const DEFAULT_MONTHLY_TOKENS = 120_000
const DEFAULT_MAX_COMPLETION_TOKENS = 900

let redisClient

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function toBoolean(value, fallback = true) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true
    if (value.toLowerCase() === 'false') return false
  }
  return fallback
}

function getPeriodKey(date = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date)

  const year = parts.find(part => part.type === 'year')?.value || '1970'
  const month = parts.find(part => part.type === 'month')?.value || '01'
  return `${year}-${month}`
}

function getRedis() {
  if (redisClient) return redisClient
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null
  redisClient = Redis.fromEnv()
  return redisClient
}

function makeRedisKey(keyHash) {
  return `${LICENSE_KEY_PREFIX}:${keyHash}`
}

function normalizeLicenseRecord(record, keyHash) {
  if (!record || Object.keys(record).length === 0) return null

  return {
    keyHash,
    label: String(record.label || 'Casecraft License').trim(),
    enabled: toBoolean(record.enabled, true),
    monthlyGenerationLimit: toPositiveInt(record.monthlyGenerationLimit, DEFAULT_MONTHLY_GENERATIONS),
    monthlyTokenLimit: toPositiveInt(record.monthlyTokenLimit, DEFAULT_MONTHLY_TOKENS),
    maxCompletionTokens: toPositiveInt(record.maxCompletionTokens, DEFAULT_MAX_COMPLETION_TOKENS),
    usedGenerations: Math.max(0, Number.parseInt(String(record.usedGenerations || '0'), 10) || 0),
    usedTokens: Math.max(0, Number.parseInt(String(record.usedTokens || '0'), 10) || 0),
    periodKey: String(record.periodKey || getPeriodKey()).trim(),
    createdAt: String(record.createdAt || new Date().toISOString()),
    updatedAt: String(record.updatedAt || new Date().toISOString()),
    lastUsedAt: record.lastUsedAt ? String(record.lastUsedAt) : '',
  }
}

function resetUsageIfNeeded(license) {
  const periodKey = getPeriodKey()
  if (license.periodKey === periodKey) return license
  return {
    ...license,
    periodKey,
    usedGenerations: 0,
    usedTokens: 0,
  }
}

export function hashLicenseKey(licenseKey) {
  return crypto.createHash('sha256').update(String(licenseKey || '').trim()).digest('hex')
}

export function createLicenseKey() {
  return `cc-${crypto.randomBytes(12).toString('base64url')}`
}

export function storageConfigured() {
  return Boolean(getRedis())
}

export function estimateInputTokens(input, extraText = '') {
  const payload = JSON.stringify(input || {})
  const characters = payload.length + String(extraText || '').length
  return Math.max(200, Math.ceil(characters / 4))
}

export function summarizeQuota(license) {
  const current = resetUsageIfNeeded(license)
  return {
    periodKey: current.periodKey,
    monthlyGenerationLimit: current.monthlyGenerationLimit,
    monthlyTokenLimit: current.monthlyTokenLimit,
    usedGenerations: current.usedGenerations,
    usedTokens: current.usedTokens,
    remainingGenerations: Math.max(0, current.monthlyGenerationLimit - current.usedGenerations),
    remainingTokens: Math.max(0, current.monthlyTokenLimit - current.usedTokens),
    maxCompletionTokens: current.maxCompletionTokens,
  }
}

export async function getLicenseByKey(licenseKey) {
  const redis = getRedis()
  if (!redis) throw new Error('License storage is not configured.')

  const normalizedKey = String(licenseKey || '').trim()
  if (!normalizedKey) return null

  const keyHash = hashLicenseKey(normalizedKey)
  const record = await redis.hgetall(makeRedisKey(keyHash))
  const license = normalizeLicenseRecord(record, keyHash)
  if (!license) return null

  const resetLicense = resetUsageIfNeeded(license)
  if (
    resetLicense.periodKey !== license.periodKey ||
    resetLicense.usedGenerations !== license.usedGenerations ||
    resetLicense.usedTokens !== license.usedTokens
  ) {
    await saveLicense(resetLicense)
  }

  return resetLicense
}

export async function saveLicense(license) {
  const redis = getRedis()
  if (!redis) throw new Error('License storage is not configured.')

  const normalized = normalizeLicenseRecord(license, license.keyHash)
  const key = makeRedisKey(normalized.keyHash)

  await redis.hset(key, {
    keyHash: normalized.keyHash,
    label: normalized.label,
    enabled: normalized.enabled ? 'true' : 'false',
    monthlyGenerationLimit: String(normalized.monthlyGenerationLimit),
    monthlyTokenLimit: String(normalized.monthlyTokenLimit),
    maxCompletionTokens: String(normalized.maxCompletionTokens),
    usedGenerations: String(normalized.usedGenerations),
    usedTokens: String(normalized.usedTokens),
    periodKey: normalized.periodKey,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt,
    lastUsedAt: normalized.lastUsedAt,
  })

  await redis.sadd(LICENSE_INDEX_KEY, normalized.keyHash)
  return normalized
}

export async function createOrUpdateLicense({
  licenseKey,
  label,
  monthlyGenerationLimit,
  monthlyTokenLimit,
  maxCompletionTokens,
  enabled,
}) {
  const normalizedLicenseKey = String(licenseKey || '').trim() || createLicenseKey()
  const existing = await getLicenseByKey(normalizedLicenseKey)
  const now = new Date().toISOString()
  const periodKey = getPeriodKey()

  const license = {
    keyHash: hashLicenseKey(normalizedLicenseKey),
    label: String(label || existing?.label || 'Casecraft License').trim(),
    enabled: toBoolean(enabled, existing?.enabled ?? true),
    monthlyGenerationLimit: toPositiveInt(monthlyGenerationLimit, existing?.monthlyGenerationLimit || DEFAULT_MONTHLY_GENERATIONS),
    monthlyTokenLimit: toPositiveInt(monthlyTokenLimit, existing?.monthlyTokenLimit || DEFAULT_MONTHLY_TOKENS),
    maxCompletionTokens: toPositiveInt(maxCompletionTokens, existing?.maxCompletionTokens || DEFAULT_MAX_COMPLETION_TOKENS),
    usedGenerations: existing?.periodKey === periodKey ? existing.usedGenerations : 0,
    usedTokens: existing?.periodKey === periodKey ? existing.usedTokens : 0,
    periodKey,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    lastUsedAt: existing?.lastUsedAt || '',
  }

  const saved = await saveLicense(license)
  return { licenseKey: normalizedLicenseKey, license: saved, quota: summarizeQuota(saved), created: !existing }
}

export async function recordLicenseUsage(license, usage) {
  const now = new Date().toISOString()
  const current = resetUsageIfNeeded(license)
  const next = {
    ...current,
    usedGenerations: current.usedGenerations + Math.max(0, Number.parseInt(String(usage.generations || 0), 10) || 0),
    usedTokens: current.usedTokens + Math.max(0, Number.parseInt(String(usage.tokens || 0), 10) || 0),
    updatedAt: now,
    lastUsedAt: now,
  }

  const saved = await saveLicense(next)
  return { license: saved, quota: summarizeQuota(saved) }
}

export async function listLicenses() {
  const redis = getRedis()
  if (!redis) throw new Error('License storage is not configured.')

  const hashes = await redis.smembers(LICENSE_INDEX_KEY)
  const licenses = await Promise.all(
    (hashes || []).map(async keyHash => {
      const record = await redis.hgetall(makeRedisKey(String(keyHash)))
      return normalizeLicenseRecord(record, String(keyHash))
    }),
  )

  return licenses
    .filter(Boolean)
    .map(license => ({ ...license, quota: summarizeQuota(license) }))
    .sort((a, b) => a.label.localeCompare(b.label))
}
