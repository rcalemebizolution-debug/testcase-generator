import { createOrUpdateLicense, listLicenses, storageConfigured } from '../_lib/licenses.js'

function isAuthorized(req) {
  const headerValue = String(req.headers['x-admin-api-key'] || '').trim()
  return Boolean(process.env.ADMIN_API_KEY) && headerValue === process.env.ADMIN_API_KEY
}

export default async function handler(req, res) {
  if (!process.env.ADMIN_API_KEY) {
    return res.status(503).json({ error: 'Admin API is not configured yet. Add ADMIN_API_KEY in Vercel.' })
  }

  if (!storageConfigured()) {
    return res.status(503).json({ error: 'License storage is not configured yet. Add Upstash Redis credentials in Vercel.' })
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'The admin API key is incorrect.' })
  }

  try {
    if (req.method === 'GET') {
      const licenses = await listLicenses()
      return res.status(200).json({
        licenses: licenses.map(item => ({
          label: item.label,
          enabled: item.enabled,
          keyHash: item.keyHash,
          monthlyGenerationLimit: item.monthlyGenerationLimit,
          monthlyTokenLimit: item.monthlyTokenLimit,
          maxCompletionTokens: item.maxCompletionTokens,
          quota: item.quota,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          lastUsedAt: item.lastUsedAt,
        })),
      })
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' })

    const payload = req.body || {}
    const result = await createOrUpdateLicense({
      licenseKey: payload.licenseKey,
      label: payload.label,
      monthlyGenerationLimit: payload.monthlyGenerationLimit,
      monthlyTokenLimit: payload.monthlyTokenLimit,
      maxCompletionTokens: payload.maxCompletionTokens,
      enabled: payload.enabled,
    })

    return res.status(result.created ? 201 : 200).json({
      created: result.created,
      licenseKey: result.licenseKey,
      license: {
        label: result.license.label,
        enabled: result.license.enabled,
        keyHash: result.license.keyHash,
        monthlyGenerationLimit: result.license.monthlyGenerationLimit,
        monthlyTokenLimit: result.license.monthlyTokenLimit,
        maxCompletionTokens: result.license.maxCompletionTokens,
      },
      quota: result.quota,
    })
  } catch (error) {
    console.error('License admin request failed:', error)
    return res.status(500).json({ error: 'License admin request failed unexpectedly.' })
  }
}
