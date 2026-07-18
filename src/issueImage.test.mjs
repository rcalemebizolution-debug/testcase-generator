import assert from 'node:assert/strict'
import test from 'node:test'

import { MAX_ISSUE_IMAGE_BYTES, createVisionUserContent, validateIssueImage } from './issueImage.js'

const pngDataUrl = 'data:image/png;base64,aGVsbG8='

test('validateIssueImage accepts a supported screenshot within the payload limit', () => {
  const result = validateIssueImage({
    name: 'duplicate-email.png',
    type: 'image/png',
    size: 1024,
    dataUrl: pngDataUrl,
  })

  assert.deepEqual(result, {
    ok: true,
    image: { name: 'duplicate-email.png', type: 'image/png', size: 1024, dataUrl: pngDataUrl },
  })
})

test('validateIssueImage rejects unsupported file types and oversized screenshots', () => {
  assert.match(validateIssueImage({ name: 'issue.gif', type: 'image/gif', size: 10, dataUrl: 'data:image/gif;base64,AA==' }).error, /PNG, JPEG, or WebP/)
  assert.match(validateIssueImage({ name: 'issue.png', type: 'image/png', size: MAX_ISSUE_IMAGE_BYTES + 1, dataUrl: pngDataUrl }).error, /2 MB/)
})

test('createVisionUserContent sends the issue context and screenshot as separate vision parts', () => {
  const content = createVisionUserContent('Issue context', { type: 'image/png', dataUrl: pngDataUrl })

  assert.deepEqual(content, [
    { type: 'text', text: 'Issue context' },
    { type: 'image_url', image_url: { url: pngDataUrl } },
  ])
})
