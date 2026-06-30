import { getLicenseByKey, storageConfigured, summarizeQuota } from './_lib/licenses.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' })

  if (!storageConfigured()) {
    return res.status(503).json({ error: 'License storage is not configured yet. Add Upstash Redis credentials in Vercel.' })
  }

  try {
    const licenseKey = String(req.headers['x-license-key'] || req.body?.licenseKey || '').trim()
    if (!licenseKey) return res.status(400).json({ error: 'License key is required.' })

    const license = await getLicenseByKey(licenseKey)
    if (!license || !license.enabled) return res.status(404).json({ error: 'License key was not found.' })

    return res.status(200).json({
      label: license.label,
      quota: summarizeQuota(license),
    })
  } catch (error) {
    console.error('License status request failed:', error)
    return res.status(500).json({ error: 'License status request failed unexpectedly.' })
  }
}
