export const MAX_ISSUE_IMAGE_BYTES = 2 * 1024 * 1024

const supportedTypes = new Set(['image/png', 'image/jpeg', 'image/webp'])
const dataUrlPattern = /^data:(image\/(?:png|jpeg|webp));base64,[A-Za-z0-9+/=]+$/

export function validateIssueImage(candidate) {
  if (!candidate || typeof candidate !== 'object') return { ok: false, error: 'Choose a PNG, JPEG, or WebP screenshot.' }

  const name = String(candidate.name || '').trim()
  const type = String(candidate.type || '').toLowerCase()
  const size = Number(candidate.size)
  const dataUrl = String(candidate.dataUrl || '')

  if (!supportedTypes.has(type)) return { ok: false, error: 'Use a PNG, JPEG, or WebP screenshot.' }
  if (!Number.isFinite(size) || size <= 0 || size > MAX_ISSUE_IMAGE_BYTES) return { ok: false, error: 'Screenshot must be no larger than 2 MB.' }
  if (!dataUrlPattern.test(dataUrl) || !dataUrl.startsWith(`data:${type};base64,`)) return { ok: false, error: 'The screenshot could not be read safely. Choose the image again.' }

  return { ok: true, image: { name: name || 'issue-screenshot', type, size, dataUrl } }
}

export function createVisionUserContent(text, image) {
  if (!image) return text
  return [
    { type: 'text', text },
    { type: 'image_url', image_url: { url: image.dataUrl } },
  ]
}
