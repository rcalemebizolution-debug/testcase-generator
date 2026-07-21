import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('./App.jsx', import.meta.url), 'utf8')

test('My test cases opens a dedicated suites view', () => {
  assert.match(source, /setActiveView\('suites'\)/)
  assert.match(source, /activeView === 'suites'/)
  assert.match(source, /<SavedSuitesPanel suites=\{mySuites\}/)
})

test('saving a suite keeps the user in the generator and clears the completed work', () => {
  const saveSuiteBody = source.slice(source.indexOf('const saveSuite'), source.indexOf('const loadSuite'))
  assert.doesNotMatch(saveSuiteBody, /setActiveView\('suites'\)/)
  assert.match(saveSuiteBody, /setForm\(blankForm\)/)
  assert.match(saveSuiteBody, /setCases\(\[\]\)/)
  assert.match(saveSuiteBody, /setActiveSuiteId\(''\)/)
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

test('opening the app restores the existing session instead of logging the user out', () => {
  const startupBody = source.slice(source.indexOf('useEffect(() => {'), source.indexOf('const completed'))
  assert.match(startupBody, /let nextSession = data\.session \|\| null/)
  assert.match(startupBody, /await loadSupabaseWorkspace\(\)/)
  assert.doesNotMatch(startupBody, /await logoutSupabaseUser\(\)/)
})

test('My test cases supports search and displays the saved date and time', () => {
  const panelBody = source.slice(source.indexOf('function SavedSuitesPanel'), source.indexOf('function formatDate'))
  assert.match(panelBody, /placeholder="Search saved test cases"/)
  assert.match(panelBody, /filteredSuites/)
  assert.match(panelBody, /formatDate\(suite\.updatedAt \|\| suite\.createdAt\)/)
})

test('My test cases provides an explicit Edit action', () => {
  const panelBody = source.slice(source.indexOf('function SavedSuitesPanel'), source.indexOf('function formatDate'))
  assert.match(panelBody, /className="edit-suite"/)
  assert.match(panelBody, /onClick=\{\(\) => onLoad\(suite\)\}>Edit</)
})

test('authenticated users choose a workspace before entering Casecraft', () => {
  assert.match(source, /const \[workspaceMode, setWorkspaceMode\] = useState\(null\)/)
  assert.match(source, /if \(!workspaceMode\) return <WorkspaceChooser/)
})

test('workspace chooser offers development and maintenance', () => {
  const chooser = source.slice(source.indexOf('function WorkspaceChooser'), source.indexOf('function DevelopmentWorkspace'))
  assert.match(chooser, />Development</)
  assert.match(chooser, />Maintenance</)
  assert.match(chooser, /onSelect\('development'\)/)
  assert.match(chooser, /onSelect\('maintenance'\)/)
})

test('development selection has a separate placeholder', () => {
  assert.match(source, /if \(workspaceMode === 'development'\) return <DevelopmentWorkspace/)
})

test('Development designer provides an Example button', () => {
  const developmentBody = source.slice(source.indexOf('function DevelopmentWorkspace'), source.indexOf('function SavedSuitesPanel'))
  assert.match(developmentBody, />Example</)
  assert.match(developmentBody, /setForm\(developmentExample\)/)
})

test('Development follows Maintenance with AI, Standard, and My test cases', () => {
  const developmentBody = source.slice(source.indexOf('function DevelopmentWorkspace'), source.indexOf('function SavedSuitesPanel'))
  assert.match(developmentBody, /Use AI/)
  assert.match(developmentBody, /Standard rules/)
  assert.match(developmentBody, /My test cases/)
  assert.match(developmentBody, /<SavedSuitesPanel/)
})

test('Development adds BRD requirements and traceability views', () => {
  const developmentBody = source.slice(source.indexOf('function DevelopmentWorkspace'), source.indexOf('function SavedSuitesPanel'))
  assert.match(developmentBody, />Requirements</)
  assert.match(developmentBody, />Coverage</)
  assert.match(developmentBody, /<RequirementsPanel/)
  assert.match(developmentBody, /<RequirementCoveragePanel/)
  assert.match(source, /Upload BRD/)
  assert.match(source, /Source requirements/)
})

test('saving a Development suite clears its source requirement document', () => {
  const developmentBody = source.slice(source.indexOf('function DevelopmentWorkspace'), source.indexOf('function RequirementsPanel'))
  const clearBody = developmentBody.slice(developmentBody.indexOf('const clear ='), developmentBody.indexOf('const downloadDevelopmentCsv'))
  assert.match(clearBody, /setActiveDocumentId\(''\)/)
  assert.match(clearBody, /setForm\(developmentBlankForm\)/)
})

test('Development keeps supplemental BRD context optional and collapsible', () => {
  const developmentBody = source.slice(source.indexOf('function DevelopmentWorkspace'), source.indexOf('function RequirementsPanel'))
  assert.match(developmentBody, /<details className="development-optional-context">/)
  assert.match(developmentBody, /Additional generation context/)
  assert.match(developmentBody, /Optional/)
})

test('Development requirement picker supports selecting and clearing every approved requirement', () => {
  const developmentBody = source.slice(source.indexOf('function DevelopmentWorkspace'), source.indexOf('function RequirementsPanel'))
  assert.match(developmentBody, /Select all/)
  assert.match(developmentBody, /Clear all/)
  assert.match(developmentBody, /approvedRequirements\.map\(requirement => requirement\.id\)/)
})

test('CSV download is available from My test cases instead of generated Development results', () => {
  const developmentBody = source.slice(source.indexOf('function DevelopmentWorkspace'), source.indexOf('function RequirementsPanel'))
  const savedSuitesBody = source.slice(source.indexOf('function SavedSuitesPanel'), source.indexOf('function formatDate'))
  assert.doesNotMatch(developmentBody, /downloadDevelopmentCsv/)
  assert.match(savedSuitesBody, /downloadTestCaseCsv\(suite\.cases/)
  assert.match(savedSuitesBody, /title="Download CSV"/)
})

test('logout clears the selected workspace', () => {
  const logoutStart = source.indexOf('const logout')
  const logoutBody = source.slice(logoutStart, source.indexOf('const update =', logoutStart))
  assert.match(logoutBody, /setWorkspaceMode\(null\)/)
})

test('Maintenance lets testers attach one supported issue screenshot for AI analysis', () => {
  assert.match(source, /label="Issue screenshot"/)
  assert.match(source, /accept="image\/png,image\/jpeg,image\/webp"/)
  assert.match(source, /onChange=\{handleIssueImageUpload\}/)
  assert.match(source, /Screenshot is used only for AI-enhanced generation/)
})
