import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('./App.jsx', import.meta.url), 'utf8')

test('My test cases opens a dedicated suites view', () => {
  assert.match(source, /setActiveView\('suites'\)/)
  assert.match(source, /activeView === 'suites'/)
  assert.match(source, /<SavedSuitesPanel suites=\{mySuites\}/)
})

test('saving a suite opens the My test cases view', () => {
  const saveSuiteBody = source.slice(source.indexOf('const saveSuite'), source.indexOf('const loadSuite'))
  assert.match(saveSuiteBody, /setActiveView\('suites'\)/)
})
