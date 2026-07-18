import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8')

test('local Vite development serves the generation handler instead of proxying secret checks to production', () => {
  assert.match(source, /import generateHandler from '\.\/api\/generate\.js'/)
  assert.match(source, /server\.middlewares\.use\('\/api\/generate'/)
  assert.match(source, /req\.body = JSON\.parse/)
  assert.match(source, /res\.status = statusCode =>/)
  assert.doesNotMatch(source, /testcase-generator-six\.vercel\.app/)
})
