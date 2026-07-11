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

test('My test cases has a Back button to the generator', () => {
  const panelBody = source.slice(source.indexOf('function SavedSuitesPanel'), source.indexOf('function formatDate'))
  assert.match(panelBody, />Back</)
  assert.match(panelBody, /onClick=\{onBack\}/)
})

test('the unauthenticated landing page defaults to login', () => {
  assert.match(source, /useState\('login'\)/)
  assert.doesNotMatch(source, /nextSession \|\| nextUsers\?\.length \? 'login' : 'register'/)
})

test('opening the app starts logged out even when a prior session exists', () => {
  const startupBody = source.slice(source.indexOf('useEffect(() => {'), source.indexOf('const completed'))
  assert.match(startupBody, /await logoutSupabaseUser\(\)/)
  assert.match(startupBody, /nextSession = null/)
})
