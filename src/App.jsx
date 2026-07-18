import { useEffect, useMemo, useState } from 'react'
import { downloadTestCaseCsv } from './testCaseCsv.js'
import { applyRequirementDocumentDefaults, buildRequirementCoverage, createRequirementDocument, loadRequirementDocuments, readRequirementFile, saveRequirementDocuments } from './requirementDocuments.js'
import { developmentBlankForm, developmentExample, createDevelopmentAiPayload, createDevelopmentCases } from './developmentTestDesign.js'
import { assignUnownedSuites, createSuiteSnapshot, getSuitesForUser, getSuitesForWorkspace, persistSavedSuite, updateCaseField, updateCaseSteps } from './suiteStorage.js'
import { isEffectiveAdmin, loginUser, registerUser, setUserRole, setUserStatus, updateUserProfile } from './authStorage.js'
import { loadAppData, saveDraftToDatabase, saveSessionToDatabase, saveSuitesToDatabase, saveUsersToDatabase } from './appDatabase.js'
import { supabaseEnabled } from './supabaseClient.js'
import { deleteSupabaseUser, loginSupabaseUser, logoutSupabaseUser, registerSupabaseUser, setSupabaseUserRole, setSupabaseUserStatus, updateSupabaseProfile } from './supabaseAuth.js'
import { buildReleaseReadiness, validateGeneratedCases } from './qualityGovernance.js'

const icons = {
  spark: <svg viewBox="0 0 24 24"><path d="m12 3 .8 4.2a5 5 0 0 0 4 4l4.2.8-4.2.8a5 5 0 0 0-4 4L12 21l-.8-4.2a5 5 0 0 0-4-4L3 12l4.2-.8a5 5 0 0 0 4-4L12 3Z"/></svg>,
  file: <svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>,
  clock: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,
  settings: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19 13.5v-3l-2-.7-.5-1.2.9-1.9-2.1-2.1-1.9.9-1.2-.5-.7-2h-3l-.7 2-1.2.5-1.9-.9-2.1 2.1.9 1.9-.5 1.2-2 .7v3l2 .7.5 1.2-.9 1.9 2.1 2.1 1.9-.9 1.2.5.7 2h3l.7-2 1.2-.5 1.9.9 2.1-2.1-.9-1.9.5-1.2z"/></svg>,
  plus: <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>,
  wand: <svg viewBox="0 0 24 24"><path d="m15 4 5 5L8 21H3v-5zM12 7l5 5M5 3v3M3.5 4.5h3M19 16v4M17 18h4"/></svg>,
  copy: <svg viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>,
  download: <svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M4 20h16"/></svg>,
  chevron: <svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>,
  check: <svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>,
  trash: <svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>,
}

const blankForm = {
  mainModule: '', subModule: '', issueTitle: '', issueDetails: '',
  precondition: '', testSteps: '', priority: 'Medium', coverage: 'Balanced',
}

const example = {
  mainModule: 'Authentication',
  subModule: 'Password recovery',
  issueTitle: 'Reset password using a registered email address',
  issueDetails: 'A registered user should receive a secure password reset link. The link expires after 30 minutes and can only be used once.',
  precondition: 'User has an active account and access to the registered email inbox.',
  testSteps: 'Open the sign-in page\nSelect “Forgot password”\nEnter a registered email address\nOpen the reset email\nFollow the secure link\nEnter and confirm a new password\nSign in with the new password',
  priority: 'High', coverage: 'Balanced',
}

function cleanStep(step) {
  return step.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '').trim()
}

function generateCases(data) {
  const rawSteps = data.testSteps.split('\n').map(cleanStep).filter(Boolean)
  const steps = rawSteps.length ? rawSteps : ['Open the relevant feature', 'Perform the action described in the issue', 'Observe the result']
  const title = data.issueTitle.trim() || 'Verify requested functionality'
  const base = data.precondition.trim() || 'User has access to the application.'
  const expected = data.issueDetails.trim()
    ? `The workflow completes successfully and behaves as specified: ${data.issueDetails.trim()}`
    : `The ${title.toLowerCase()} workflow completes successfully with the expected result.`
  const issueContext = data.issueDetails.trim() || title
  const describe = purpose => `${purpose} for "${title}" based on the reported issue: ${issueContext}`
  const caseContext = {
    module: data.mainModule.trim(),
    subModule: data.subModule.trim(),
  }

  const cases = [{
    id: 'TC-001', type: 'Positive', priority: data.priority, title: `${title} — happy path`, ...caseContext,
    description: describe('Verifies that the complete valid user workflow succeeds'),
    precondition: base, steps, expected,
  }]

  if (data.coverage !== 'Focused') {
    cases.push({
      id: 'TC-002', type: 'Negative', priority: data.priority === 'Low' ? 'Medium' : data.priority,
      title: `${title} — reject invalid input`, ...caseContext,
      description: describe('Verifies that missing, malformed, or invalid input is rejected safely'),
      precondition: base,
      steps: [...steps.slice(0, Math.max(1, steps.length - 1)), 'Provide missing, malformed, or invalid input', 'Submit the request'],
      expected: 'The request is not completed. A clear, actionable validation message is shown and no invalid data is saved.',
    })
    cases.push({
      id: 'TC-003', type: 'Validation', priority: 'Medium', title: `${title} — required-field validation`, ...caseContext,
      description: describe('Verifies that required-field rules provide clear and consistent feedback'),
      precondition: base,
      steps: [steps[0], 'Leave all required fields empty', 'Attempt to continue or submit'],
      expected: 'Required fields are identified consistently, focus moves to the first error, and the user remains on the current screen.',
    })
  }

  if (data.coverage === 'Thorough') {
    cases.push({
      id: 'TC-004', type: 'Boundary', priority: 'Medium', title: `${title} — boundary values`, ...caseContext,
      description: describe('Verifies behavior at and immediately beyond the supported input limits'),
      precondition: base,
      steps: [...steps.slice(0, 1), 'Enter minimum and maximum accepted values', 'Repeat with values just outside the accepted limits'],
      expected: 'Values at valid boundaries are accepted; values beyond the limits are rejected with a precise validation message.',
    }, {
      id: 'TC-005', type: 'Resilience', priority: 'Low', title: `${title} — repeated submission`, ...caseContext,
      description: describe('Verifies that repeating the final action does not create duplicate or inconsistent results'),
      precondition: base,
      steps: [...steps, 'Immediately repeat the final action'],
      expected: 'The application handles the repeated action safely without duplicate records, inconsistent state, or unexpected errors.',
    })
  }
  return cases
}

function Field({ label, required, hint, children, wide }) {
  return <label className={`field ${wide ? 'wide' : ''}`}>
    <span className="field-label">{label}{required && <b>*</b>}{hint && <em>{hint}</em>}</span>
    {children}
  </label>
}

function EmptyState() {
  return <div className="empty-state">
    <div className="empty-illustration">
      <span className="paper p1"/><span className="paper p2"/><span className="paper p3"/>
      <span className="magic">{icons.spark}</span>
    </div>
    <h2>Your test cases will appear here</h2>
    <p>Fill in the issue details, then select <strong>Generate test cases</strong> to create a structured QA suite.</p>
    <div className="empty-tags"><span>Positive</span><span>Negative</span><span>Validation</span></div>
  </div>
}

function TestCase({ item, open, onToggle, editing, onEditToggle, onFieldChange, onStepsChange }) {
  return <article className={`test-case ${open ? 'open' : ''}`}>
    <button className="case-head" onClick={onToggle} aria-expanded={open}>
      <span className={`case-type ${item.type.toLowerCase()}`}>{item.type}</span>
      <span className="case-heading"><small>{item.id} · {[item.module, item.subModule].filter(Boolean).join(' / ')}</small><strong>{item.title}</strong></span>
      <span className={`priority ${item.priority.toLowerCase()}`}>{item.priority}</span>
      <span className="case-chevron">{icons.chevron}</span>
    </button>
    {open && <div className="case-body">
      <div className="case-tools"><button onClick={onEditToggle}>{editing ? 'Done editing' : 'Edit case'}</button></div>
      {editing ? <div className="case-edit-grid">
        <Field label="Title" wide><input value={item.title} onChange={e => onFieldChange('title', e.target.value)} /></Field>
        <Field label="Type"><select value={item.type} onChange={e => onFieldChange('type', e.target.value)}><option>Positive</option><option>Negative</option><option>Validation</option><option>Boundary</option><option>Security</option><option>Usability</option><option>Resilience</option><option>Integration</option></select></Field>
        <Field label="Priority"><select value={item.priority} onChange={e => onFieldChange('priority', e.target.value)}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></Field>
        <Field label="QA review"><select value={item.reviewStatus || 'Draft'} onChange={e => onFieldChange('reviewStatus', e.target.value)}><option>Draft</option><option>Reviewed</option><option>Approved</option></select></Field>
        <Field label="Execution status"><select value={item.executionStatus || 'Not Run'} onChange={e => onFieldChange('executionStatus', e.target.value)}><option>Not Run</option><option>Passed</option><option>Failed</option><option>Blocked</option><option>Skipped</option></select></Field>
        <Field label="Description" wide><textarea rows="3" value={item.description} onChange={e => onFieldChange('description', e.target.value)} /></Field>
        <Field label="Precondition" wide><textarea rows="2" value={item.precondition} onChange={e => onFieldChange('precondition', e.target.value)} /></Field>
        <Field label="Steps" wide hint="One step per line"><textarea rows="5" value={item.steps.join('\n')} onChange={e => onStepsChange(e.target.value)} /></Field>
        <Field label="Expected result" wide><textarea rows="3" value={item.expected} onChange={e => onFieldChange('expected', e.target.value)} /></Field>
        <Field label="Actual result" wide><textarea rows="2" value={item.actualResult || ''} onChange={e => onFieldChange('actualResult', e.target.value)} /></Field>
        <Field label="Bug / ticket link"><input value={item.bugLink || ''} onChange={e => onFieldChange('bugLink', e.target.value)} placeholder="e.g. JIRA-123" /></Field>
        <Field label="Tester"><input value={item.tester || ''} onChange={e => onFieldChange('tester', e.target.value)} /></Field>
      </div> : <>
        <section><h4>Description</h4><p>{item.description}</p></section>
        <section><h4>Precondition</h4><p>{item.precondition}</p></section>
        <section><h4>Test steps</h4><ol>{item.steps.map((step, i) => <li key={i}><span>{i + 1}</span><p>{step}</p></li>)}</ol></section>
        <section className="expected"><h4>Expected result</h4><p><i>{icons.check}</i>{item.expected}</p></section>
        <section><h4>QA status</h4><p>{item.reviewStatus || 'Draft'} review · {item.executionStatus || 'Not Run'} execution{item.bugLink ? ` · ${item.bugLink}` : ''}</p></section>
      </>}
    </div>}
  </article>
}

const STORAGE_KEY = 'casecraft-form'
const SAVED_SUITES_KEY = 'casecraft-suites'
const USERS_KEY = 'casecraft-users'
const SESSION_KEY = 'casecraft-session'

function loadDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    return saved && typeof saved === 'object' ? { ...blankForm, ...saved } : blankForm
  } catch {
    return blankForm
  }
}

function normalizeCases(inputCases) {
  return Array.isArray(inputCases) ? inputCases.filter(item => item && Array.isArray(item.steps)) : []
}

function loadSavedSuites() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_SUITES_KEY) || '[]')
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

function loadUsers() {
  try {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]')
    return Array.isArray(users) ? users : []
  } catch {
    return []
  }
}

function loadSession() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
    return session && typeof session === 'object' ? session : null
  } catch {
    return null
  }
}

const blankAuthForm = { name: '', email: '', password: '', confirmPassword: '' }
const blankProfileForm = { name: '', email: '', password: '', confirmPassword: '' }

function AuthScreen({ mode, form, error, onModeChange, onUpdate, onSubmit }) {
  const isRegister = mode === 'register'
  return <main className="auth-shell">
    <section className="auth-card">
      <div className="auth-brand"><div>{icons.spark}</div><span>casecraft<small>QA workspace</small></span></div>
      <div className="auth-intro">
        <span>{isRegister ? 'Create account' : 'Welcome back'}</span>
        <h1>{isRegister ? 'Register your QA workspace' : 'Log in to Casecraft'}</h1>
        <p>{isRegister
          ? (supabaseEnabled ? 'Create a secure Supabase account to access the generator.' : 'Create a local account to access the generator and keep saved suites on this browser.')
          : (supabaseEnabled ? 'Use your Supabase account to continue managing saved test suites.' : 'Use your local account to continue managing saved test suites.')}
        </p>
      </div>
      <form className="auth-form" onSubmit={onSubmit}>
        {isRegister && <Field label="Full name" required><input value={form.name} onChange={e => onUpdate('name', e.target.value)} placeholder="e.g. Isaac Admin" autoComplete="name" /></Field>}
        <Field label="Email" required><input type="email" value={form.email} onChange={e => onUpdate('email', e.target.value)} placeholder="you@example.com" autoComplete="email" /></Field>
        <Field label="Password" required hint="Min 6 chars"><input type="password" value={form.password} onChange={e => onUpdate('password', e.target.value)} placeholder="Enter password" autoComplete={isRegister ? 'new-password' : 'current-password'} /></Field>
        {isRegister && <Field label="Confirm password" required><input type="password" value={form.confirmPassword} onChange={e => onUpdate('confirmPassword', e.target.value)} placeholder="Repeat password" autoComplete="new-password" /></Field>}
        {error && <p className="auth-error">{error}</p>}
        <button className="auth-submit" type="submit">{isRegister ? 'Create account' : 'Log in'}</button>
      </form>
      <p className="auth-switch">
        {isRegister ? 'Already have an account?' : 'Need an account?'}{' '}
        <button type="button" onClick={() => onModeChange(isRegister ? 'login' : 'register')}>{isRegister ? 'Log in' : 'Register'}</button>
      </p>
      <p className="auth-note">Local demo authentication only. Do not use this as production password storage.</p>
    </section>
  </main>
}


function ProfilePanel({ form, error, onUpdate, onSubmit, onCancel }) {
  return <section className="profile-panel">
    <div className="profile-card-large">
      <div className="saved-head"><strong>Profile settings</strong><span>Update your account details</span></div>
      <form className="auth-form profile-form" onSubmit={onSubmit}>
        <Field label="Full name" required><input value={form.name} onChange={e => onUpdate('name', e.target.value)} placeholder="e.g. Isaac Rhobert Calem" autoComplete="name" /></Field>
        <Field label="Email" required><input type="email" value={form.email} onChange={e => onUpdate('email', e.target.value)} placeholder="you@example.com" autoComplete="email" /></Field>
        <Field label="New password" hint="Optional"><input type="password" value={form.password} onChange={e => onUpdate('password', e.target.value)} placeholder="Leave blank to keep current password" autoComplete="new-password" /></Field>
        <Field label="Confirm new password" hint="Optional"><input type="password" value={form.confirmPassword} onChange={e => onUpdate('confirmPassword', e.target.value)} placeholder="Repeat new password" autoComplete="new-password" /></Field>
        {error && <p className="auth-error">{error}</p>}
        <div className="profile-actions">
          <button type="button" className="example" onClick={onCancel}>Cancel</button>
          <button className="auth-submit" type="submit">Save profile</button>
        </div>
      </form>
    </div>
  </section>
}

function WorkspaceChooser({ user, onSelect, onLogout }) {
  return <main className="workspace-choice-shell">
    <section className="workspace-choice-card">
      <div className="auth-brand"><div>{icons.spark}</div><span>casecraft<small>QA workspace</small></span></div>
      <div className="workspace-choice-heading"><span>Welcome, {user.name}</span><h1>Choose your workspace</h1><p>Select how you want to create and manage test cases.</p></div>
      <div className="workspace-choice-grid">
        <button className="development-choice" onClick={() => onSelect('development')}><i>{icons.plus}</i><strong>Development</strong><span>Create test cases for new features before release.</span></button>
        <button className="maintenance-choice" onClick={() => onSelect('maintenance')}><i>{icons.settings}</i><strong>Maintenance</strong><span>Create regression and issue-based test cases for an existing application.</span></button>
      </div>
      <button className="workspace-choice-logout" onClick={onLogout}>Logout</button>
    </section>
  </main>
}

function DevelopmentWorkspace({ user, onSwitch, onLogout, suites, savedSuites, onSuitesChange, onDelete }) {
  const [form, setForm] = useState(developmentBlankForm)
  const [errors, setErrors] = useState({})
  const [cases, setCases] = useState([])
  const [openCase, setOpenCase] = useState('')
  const [activeView, setActiveView] = useState('generator')
  const [aiEnabled, setAiEnabled] = useState(true)
  const [accessCode, setAccessCode] = useState('')
  const [generating, setGenerating] = useState(false)
  const [caseSource, setCaseSource] = useState('standard')
  const [activeSuiteId, setActiveSuiteId] = useState('')
  const [notice, setNotice] = useState('')
  const [requirementDocuments, setRequirementDocuments] = useState(() => loadRequirementDocuments(user.id))
  const [activeDocumentId, setActiveDocumentId] = useState('')

  useEffect(() => { saveRequirementDocuments(user.id, requirementDocuments) }, [requirementDocuments, user.id])

  const activeRequirementDocument = requirementDocuments.find(document => document.id === activeDocumentId)
  const approvedRequirements = activeRequirementDocument?.requirements.filter(requirement => requirement.approved) || []
  const releaseReadiness = useMemo(() => buildReleaseReadiness(requirementDocuments.flatMap(document => document.requirements.filter(requirement => requirement.approved)), suites), [requirementDocuments, suites])
  const requirementCoverage = releaseReadiness.items

  useEffect(() => {
    if (!activeRequirementDocument || approvedRequirements.length === 0) return
    setForm(current => applyRequirementDocumentDefaults(current, activeRequirementDocument))
  }, [activeRequirementDocument, approvedRequirements.length])

  const update = (key, value) => {
    setForm(current => ({ ...current, [key]: value }))
    setErrors(current => ({ ...current, [key]: false }))
  }

  const generate = async event => {
    event.preventDefault()
    const standard = createDevelopmentCases(form)
    setErrors(standard.errors)
    if (!standard.ok) {
      setNotice('Please complete the highlighted fields.')
      return
    }
    if (aiEnabled && !accessCode.trim()) {
      setNotice('Enter your AI access code, or choose Standard rules.')
      return
    }
    setGenerating(true)
    if (!aiEnabled) {
      setCases(standard.cases)
      setOpenCase(standard.cases[0]?.id || '')
      setCaseSource('standard')
      setActiveSuiteId('')
      setNotice(`${standard.cases.length} standard development test cases generated`)
      setGenerating(false)
      return
    }
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-app-access-code': accessCode.trim() },
        body: JSON.stringify(createDevelopmentAiPayload({
          ...form,
          selectedRequirements: approvedRequirements.filter(requirement => (form.selectedRequirementIds || []).includes(requirement.id)),
        })),
      })
      const responseText = await response.text()
      let payload = {}
      try { payload = responseText ? JSON.parse(responseText) : {} } catch { throw new Error('AI endpoint did not return JSON.') }
      if (!response.ok) throw new Error(payload.error || 'AI generation failed.')
      const aiCases = normalizeCases(payload.cases).map((item, index) => ({ ...item, id: `DTC-${String(index + 1).padStart(3, '0')}`, requirementIds: [...(form.selectedRequirementIds || [])] }))
      if (!aiCases.length) throw new Error('AI returned an empty test suite.')
      setCases(aiCases)
      setOpenCase(aiCases[0]?.id || '')
      setCaseSource('ai')
      setActiveSuiteId('')
      setNotice(`${aiCases.length} AI development test cases generated`)
    } catch (error) {
      setCases(standard.cases)
      setOpenCase(standard.cases[0]?.id || '')
      setCaseSource('standard')
      setActiveSuiteId('')
      setNotice(`AI unavailable: ${error.message} Standard cases generated instead.`)
    } finally {
      setGenerating(false)
    }
  }

  const clear = () => {
    setForm(developmentBlankForm)
    setActiveDocumentId('')
    setErrors({})
    setCases([])
    setOpenCase('')
    setActiveSuiteId('')
    setCaseSource('standard')
  }

  const saveDevelopmentSuite = async () => {
    if (!cases.length) {
      setNotice('Generate test cases before saving the suite.')
      return
    }
    const validation = validateGeneratedCases(cases)
    if (!validation.ok) {
      setNotice(validation.errors[0])
      return
    }
    const snapshot = createSuiteSnapshot({ form, cases, source: caseSource, existingId: activeSuiteId, ownerId: user.id, workspace: 'development' })
    const nextSuites = await persistSavedSuite({ savedSuites, snapshot, save: saveSuitesToDatabase })
    onSuitesChange(nextSuites)
    clear()
    setNotice(activeSuiteId ? 'Development suite updated and generator cleared' : 'Development suite saved in My test cases and generator cleared')
  }

  const loadDevelopmentSuite = suite => {
    setForm({ ...developmentBlankForm, ...(suite.form || {}) })
    setActiveDocumentId(suite.form?.requirementDocumentId || '')
    setCases((suite.cases || []).map(item => ({ ...item, steps: [...(item.steps || [])] })))
    setOpenCase(suite.cases?.[0]?.id || '')
    setCaseSource(suite.source || 'standard')
    setActiveSuiteId(suite.id)
    setActiveView('generator')
    setNotice('Development suite loaded for editing')
  }

  const viewTitle = {
    generator: 'Development test designer',
    requirements: 'Requirement documents',
    suites: 'My Development Test Cases',
    coverage: 'Requirement coverage',
  }[activeView]

  return <div className="app-shell development-shell">
    <aside className="sidebar">
      <div className="brand"><div>{icons.spark}</div><span>casecraft<small>Development</small></span></div>
      <nav>
        <button className={activeView === 'generator' ? 'active' : ''} onClick={() => setActiveView('generator')}><i>{icons.plus}</i><span>New suite</span></button>
        <button className={activeView === 'requirements' ? 'active' : ''} onClick={() => setActiveView('requirements')}><i>{icons.file}</i><span>Requirements</span><b>{requirementDocuments.length}</b></button>
        <button className={activeView === 'suites' ? 'active' : ''} onClick={() => setActiveView('suites')}><i>{icons.file}</i><span>My test cases</span><b>{suites.length}</b></button>
        <button className={activeView === 'coverage' ? 'active' : ''} onClick={() => setActiveView('coverage')}><i>{icons.check}</i><span>Coverage</span><b>{requirementCoverage.filter(item => item.status === 'Uncovered').length}</b></button>
      </nav>
      <div className="sidebar-bottom"><button className="settings" onClick={onSwitch}><i>{icons.settings}</i><span>Switch workspace</span></button><div className="profile"><span>{user.name?.slice(0, 2).toUpperCase() || 'QA'}</span><p><strong>{user.name}</strong><small>{user.email}</small></p><button onClick={onLogout}>Logout</button></div></div>
    </aside>
    <main className="development-workspace">
      <header className="development-topbar">
        <div><p>Development <span>/</span> {viewTitle}</p><h1>{viewTitle}</h1></div>
        <div><button onClick={onSwitch}>Switch workspace</button><button className="secondary" onClick={onLogout}>Logout</button></div>
      </header>
      {notice && <div className="toast">{icons.check}{notice}</div>}
      {activeView === 'suites' ? <SavedSuitesPanel suites={suites} activeSuiteId={activeSuiteId} onLoad={loadDevelopmentSuite} onDelete={onDelete} onBack={() => setActiveView('generator')} />
        : activeView === 'requirements' ? <RequirementsPanel user={user} documents={requirementDocuments} onChange={setRequirementDocuments} activeDocumentId={activeDocumentId} onSelectDocument={setActiveDocumentId} />
        : activeView === 'coverage' ? <RequirementCoveragePanel coverage={requirementCoverage} readiness={releaseReadiness} documents={requirementDocuments} onBack={() => setActiveView('generator')} />
        : <div className="development-layout">
      <section className="development-form-panel">
        <div className="development-heading"><span>Feature-based manual design</span><h1>Development test designer</h1><p>Describe a new feature and create structured manual test coverage before release.</p></div>
        <form onSubmit={generate}>
          <div className="development-source-options">
            <div><button type="button" className={aiEnabled ? 'active' : ''} onClick={() => setAiEnabled(true)}>{icons.spark} Use AI</button><button type="button" className={!aiEnabled ? 'active' : ''} onClick={() => setAiEnabled(false)}>Standard rules</button></div>
            {aiEnabled && <input type="password" value={accessCode} onChange={event => setAccessCode(event.target.value)} placeholder="AI access code" aria-label="AI access code" />}
          </div>
          <section className="requirement-picker">
            <div className="requirement-picker-head"><div><strong>Source requirements</strong><small>Select approved BRD requirements for traceability.</small></div><select value={activeDocumentId} onChange={event => { setActiveDocumentId(event.target.value); setForm(current => ({ ...current, requirementDocumentId: event.target.value, selectedRequirementIds: [] })) }}><option value="">No requirement document</option>{requirementDocuments.map(document => <option key={document.id} value={document.id}>{document.name} · v{document.version}</option>)}</select></div>
            {!activeRequirementDocument ? <p className="requirement-picker-empty">Upload and approve requirements from the Requirements page, or continue without a document.</p> : approvedRequirements.length === 0 ? <p className="requirement-picker-empty">This document has no approved requirements yet.</p> : <><div className="requirement-options-toolbar"><span><strong>{(form.selectedRequirementIds || []).filter(id => approvedRequirements.some(requirement => requirement.id === id)).length}</strong> of {approvedRequirements.length} selected</span><div><button type="button" onClick={() => setForm(current => ({ ...current, requirementDocumentId: activeDocumentId, selectedRequirementIds: approvedRequirements.map(requirement => requirement.id) }))}>Select all</button><button type="button" disabled={(form.selectedRequirementIds || []).length === 0} onClick={() => setForm(current => ({ ...current, selectedRequirementIds: [] }))}>Clear all</button></div></div><div className="requirement-options">{approvedRequirements.map(requirement => <label key={requirement.id}><input type="checkbox" checked={(form.selectedRequirementIds || []).includes(requirement.id)} onChange={() => setForm(current => ({ ...current, requirementDocumentId: activeDocumentId, selectedRequirementIds: (current.selectedRequirementIds || []).includes(requirement.id) ? current.selectedRequirementIds.filter(id => id !== requirement.id) : [...(current.selectedRequirementIds || []), requirement.id] }))} /><span><strong>{requirement.id}</strong>{requirement.text}</span></label>)}</div></>}
          </section>
          <div className="development-form-grid development-core-fields">
            {approvedRequirements.length > 0 && <div className="brd-autofill-note">{icons.check}<span><strong>BRD scope ready</strong> Feature details and all {approvedRequirements.length} approved requirements were filled automatically. You can edit them before generation.</span></div>}
            <Field label="Feature name" required><input className={errors.featureName ? 'invalid' : ''} value={form.featureName} onChange={event => update('featureName', event.target.value)} placeholder="e.g. Team invitations" /></Field>
            <Field label="Module"><input value={form.module} onChange={event => update('module', event.target.value)} placeholder="e.g. Workspace members" /></Field>
            <Field label="Feature description" required wide><textarea className={errors.description ? 'invalid' : ''} rows="4" value={form.description} onChange={event => update('description', event.target.value)} placeholder="What is being built and what problem does it solve?" /></Field>
            <Field label="Priority"><select value={form.priority} onChange={event => update('priority', event.target.value)}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></Field>
            <Field label="Coverage"><select value={form.coverage} onChange={event => update('coverage', event.target.value)}><option>Focused</option><option>Balanced</option><option>Comprehensive</option></select></Field>
          </div>
          <details className="development-optional-context">
            <summary><span><strong>Additional generation context</strong><small>Use these fields only when the selected requirements need more detail.</small></span><b>Optional</b></summary>
            <div className="development-form-grid">
              <Field label="Project"><input value={form.projectName} onChange={event => update('projectName', event.target.value)} placeholder="e.g. Customer portal" /></Field>
              <Field label="Release"><input value={form.releaseName} onChange={event => update('releaseName', event.target.value)} placeholder="e.g. v2.4 Password recovery" /></Field>
              <Field label="User roles" hint="One role per line"><textarea rows="3" value={form.userRoles} onChange={event => update('userRoles', event.target.value)} placeholder={'Workspace owner\nInvited teammate'} /></Field>
              <Field label="Primary user flow" hint="One step per line"><textarea rows="5" value={form.userFlow} onChange={event => update('userFlow', event.target.value)} placeholder={'Open the feature\nComplete the main action\nConfirm the result'} /></Field>
              <Field label="Expected behavior" wide><textarea rows="3" value={form.expectedBehavior} onChange={event => update('expectedBehavior', event.target.value)} placeholder="What should happen when the feature succeeds?" /></Field>
              <Field label="Acceptance criteria" hint="One criterion per line"><textarea rows="5" value={form.acceptanceCriteria} onChange={event => update('acceptanceCriteria', event.target.value)} placeholder={'Authorized users can complete the action\nA confirmation is displayed'} /></Field>
              <Field label="Dependencies" hint="One dependency per line"><textarea rows="4" value={form.dependencies} onChange={event => update('dependencies', event.target.value)} placeholder={'Authentication service\nNotification service'} /></Field>
              <Field label="Edge cases" hint="One scenario per line"><textarea rows="4" value={form.edgeCases} onChange={event => update('edgeCases', event.target.value)} placeholder={'Duplicate request\nExpired data\nMaximum-length input'} /></Field>
            </div>
          </details>
          <div className="development-actions"><button type="button" className="example" onClick={() => { setForm(developmentExample); setErrors({}); setCases([]); setOpenCase('') }}>Example</button><button type="button" className="secondary" onClick={clear}>Clear</button>{cases.length > 0 && <button type="button" className="save-suite" onClick={saveDevelopmentSuite}>{icons.save} {activeSuiteId ? 'Update suite' : 'Save suite'}</button>}<button type="submit" className="generate" disabled={generating}>{icons.wand} {generating ? 'Generating...' : aiEnabled ? 'Generate with AI' : 'Generate standard cases'}</button></div>
        </form>
      </section>
      <section className="development-results">
        <div className="development-results-head"><div><span>Generated coverage</span><h2>{cases.length ? `${cases.length} test cases` : 'Ready to design'}</h2></div>{cases.length > 0 && <div className="summary-types"><span>Feature</span><span>Roles</span><span>Dependencies</span></div>}</div>
        {cases.length === 0 ? <div className="development-empty"><i>{icons.wand}</i><h3>Your development test cases will appear here</h3><p>Complete the feature brief and generate coverage for the primary flow, acceptance criteria, roles, dependencies, and edge cases.</p></div> : <div className="development-case-list">{cases.map(item => <article key={item.id} className={openCase === item.id ? 'open' : ''}>
          <button className="development-case-head" onClick={() => setOpenCase(openCase === item.id ? '' : item.id)}><span>{item.type}</span><div><small>{item.id} · {item.module || 'Development'}</small><strong>{item.title}</strong></div><b>{item.priority}</b></button>
          {openCase === item.id && <div className="development-case-body">{item.requirementIds?.length > 0 && <section className="case-requirements"><h4>Source requirements</h4><div>{item.requirementIds.map(id => <span key={id}>{id}</span>)}</div></section>}<section><h4>Description</h4><p>{item.description}</p></section><section><h4>Precondition</h4><p>{item.precondition}</p></section><section><h4>Test steps</h4><ol>{item.steps.map((step, index) => <li key={index}><span>{index + 1}</span><p>{step}</p></li>)}</ol></section><section className="expected"><h4>Expected result</h4><p>{item.expected}</p></section></div>}
        </article>)}</div>}
      </section>
    </div>}
    </main>
  </div>
}

function RequirementsPanel({ user, documents, onChange, activeDocumentId, onSelectDocument }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [pasteName, setPasteName] = useState('Registration requirements')
  const [pastedText, setPastedText] = useState('')
  const activeDocument = documents.find(item => item.id === activeDocumentId) || documents[0]

  const addDocument = (requirementDocument) => {
    onChange(current => [requirementDocument, ...current])
    onSelectDocument(requirementDocument.id)
    setMessage(`${requirementDocument.requirements.length} requirement statements extracted. Review and approve them below.`)
  }

  const upload = async event => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) {
      setMessage('The document is larger than the 8 MB local prototype limit.')
      return
    }
    setBusy(true)
    setMessage('Reading document locally...')
    try {
      const text = await readRequirementFile(file)
      addDocument(createRequirementDocument({ name: file.name, type: file.type, text }, user.id))
    } catch (error) {
      setMessage(error.message || 'The document could not be read.')
    } finally {
      event.target.value = ''
      setBusy(false)
    }
  }

  const addPasted = () => {
    if (!pastedText.trim()) return setMessage('Paste requirement text before adding the document.')
    addDocument(createRequirementDocument({ name: pasteName.trim() || 'Pasted requirements', type: 'text/plain', text: pastedText }, user.id))
    setPastedText('')
  }

  const updateActive = updater => onChange(current => current.map(item => item.id === activeDocument.id ? { ...updater(item), updatedAt: new Date().toISOString() } : item))
  const updateRequirement = (index, patchValue) => updateActive(item => ({ ...item, requirements: item.requirements.map((requirement, position) => position === index ? { ...requirement, ...patchValue } : requirement) }))
  const deleteRequirement = index => updateActive(item => ({ ...item, requirements: item.requirements.filter((_, position) => position !== index) }))
  const removeDocument = () => {
    if (!activeDocument) return
    onChange(current => current.filter(item => item.id !== activeDocument.id))
    onSelectDocument('')
  }

  return <section className="requirements-page">
    <div className="requirements-intro"><div><span>Local requirements library</span><h2>Upload and review the source requirements</h2><p>Documents stay in this browser. Casecraft extracts candidate requirements, but QA decides which requirements are approved for test generation.</p></div><label className="upload-requirements"><input type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={upload} disabled={busy} />{icons.file}<strong>{busy ? 'Reading...' : 'Upload BRD'}</strong><small>PDF, DOCX or TXT · up to 8 MB</small></label></div>
    {message && <div className="requirements-message">{message}</div>}
    <div className="requirements-paste"><input value={pasteName} onChange={event => setPasteName(event.target.value)} placeholder="Document title" /><textarea value={pastedText} onChange={event => setPastedText(event.target.value)} rows="3" placeholder="Or paste BRD requirements here..." /><button onClick={addPasted}>Add pasted requirements</button></div>
    <div className="requirements-workspace">
      <aside><h3>Documents <span>{documents.length}</span></h3>{documents.length === 0 ? <p>No documents uploaded yet.</p> : documents.map(item => <button key={item.id} className={item.id === activeDocument?.id ? 'active' : ''} onClick={() => onSelectDocument(item.id)}><strong>{item.name}</strong><small>v{item.version} · {item.requirements.length} requirements</small></button>)}</aside>
      <div className="requirement-review">
        {!activeDocument ? <div className="requirements-empty"><h3>Start with a BRD</h3><p>Upload a document or paste requirement text. Extracted requirements will appear here for QA review.</p></div> : <>
          <header><div><input value={activeDocument.name} onChange={event => updateActive(item => ({ ...item, name: event.target.value }))} /><label>Version <input value={activeDocument.version} onChange={event => updateActive(item => ({ ...item, version: event.target.value }))} /></label></div><button className="delete-document" onClick={removeDocument}>Delete document</button></header>
          <div className="review-summary"><span><strong>{activeDocument.requirements.filter(item => item.approved).length}</strong> approved</span><span><strong>{activeDocument.requirements.length}</strong> extracted</span><button onClick={() => updateActive(item => ({ ...item, requirements: item.requirements.map(requirement => ({ ...requirement, approved: true })) }))}>Approve all</button></div>
          <div className="requirement-review-list">{activeDocument.requirements.length === 0 ? <p>No requirement-like statements were detected. Paste clearer statements containing “must” or “shall,” or add one manually.</p> : activeDocument.requirements.map((requirement, index) => <article key={`${requirement.id}-${index}`} className={requirement.approved ? 'approved' : ''}><label className="approve-check"><input type="checkbox" checked={requirement.approved} onChange={event => updateRequirement(index, { approved: event.target.checked })} /><span>{requirement.approved ? 'Approved' : 'Review'}</span></label><input className="requirement-id" value={requirement.id} onChange={event => updateRequirement(index, { id: event.target.value.toUpperCase() })} /><textarea rows="2" value={requirement.text} onChange={event => updateRequirement(index, { text: event.target.value })} /><button onClick={() => deleteRequirement(index)}>Remove</button></article>)}</div>
          <button className="add-requirement" onClick={() => updateActive(item => ({ ...item, requirements: [...item.requirements, { id: `REQ-${String(item.requirements.length + 1).padStart(3, '0')}`, text: '', approved: false }] }))}>+ Add requirement</button>
        </>}
      </div>
    </div>
  </section>
}

function RequirementCoveragePanel({ coverage, readiness, documents, onBack }) {
  const covered = coverage.filter(item => item.status !== 'Uncovered').length
  return <section className="coverage-page">
    <div className="coverage-heading"><div><span>Traceability matrix</span><h2>Requirement coverage</h2><p>Coverage is calculated from approved requirements referenced by saved Development test cases.</p></div><button onClick={onBack}>Back to generator</button></div>
    <div className="coverage-stats"><article><strong>{documents.length}</strong><span>Documents</span></article><article><strong>{coverage.length}</strong><span>Approved requirements</span></article><article><strong>{covered}</strong><span>With test evidence</span></article><article className="uncovered"><strong>{readiness.summary.atRisk + readiness.summary.uncovered}</strong><span>At risk / uncovered</span></article></div>
    {coverage.length > 0 && <div className={readiness.ready ? 'release-readiness ready' : 'release-readiness'}><strong>{readiness.ready ? 'Ready for release' : 'Not ready for release'}</strong><span>{readiness.ready ? 'Every approved requirement has passed test evidence.' : `${readiness.summary.uncovered} uncovered and ${readiness.summary.atRisk} at-risk requirement${readiness.summary.uncovered + readiness.summary.atRisk === 1 ? '' : 's'} need attention.`}</span></div>}
    {coverage.length === 0 ? <div className="coverage-empty"><h3>No approved requirements yet</h3><p>Upload a BRD, approve its requirements, select them during generation, and save the resulting suite.</p></div> : <div className="coverage-table"><div className="coverage-row heading"><span>Requirement</span><span>Requirement text</span><span>Test cases</span><span>Status</span></div>{coverage.map(item => <div className="coverage-row" key={item.id}><strong>{item.id}</strong><p>{item.text}</p><div>{item.caseIds.length ? item.caseIds.map(caseId => <span key={caseId}>{caseId}</span>) : '—'}</div><b className={item.status.toLowerCase()}>{item.status}</b></div>)}</div>}
  </section>
}

function SavedSuitesPanel({ suites, activeSuiteId, onLoad, onDelete, onBack }) {
  const [query, setQuery] = useState('')
  const filteredSuites = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return suites
    return suites.filter(suite => [
      suite.title,
      suite.module,
      suite.form?.subModule,
      ...(suite.cases || []).map(item => item.title),
    ].filter(Boolean).join(' ').toLowerCase().includes(normalized))
  }, [query, suites])

  return <section className="cms-panel suites-panel">
    <div className="suite-toolbar"><button className="example" onClick={onBack}>Back</button></div>
    <div className="cms-hero">
      <div><span>Private</span><h2>My test cases</h2><p>Your saved test suites are collected here and are visible only to your account.</p></div>
      <strong>{suites.length} saved suite{suites.length === 1 ? '' : 's'}</strong>
    </div>
    <div className="cms-list suite-library">
      <div className="saved-head"><strong>Saved suites</strong><span>Select a suite to open it in the generator</span></div>
      <div className="suite-search"><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search saved test cases" aria-label="Search saved test cases" /></div>
      <div className="saved-suites">
        {suites.length === 0 ? <p>No saved suites yet. Generate test cases, then select Save suite.</p> : filteredSuites.length === 0 ? <p>No saved test cases match “{query}”.</p> : filteredSuites.map(suite => <article key={suite.id} className={suite.id === activeSuiteId ? 'active' : ''}>
          <button onClick={() => onLoad(suite)}><strong>{suite.title}</strong><span>{suite.caseCount} cases · {suite.module || 'No module'}</span><small>Saved {formatDate(suite.updatedAt || suite.createdAt)}</small></button>
          <button className="edit-suite" onClick={() => onLoad(suite)}>Edit</button>
          <button className="download-suite" onClick={() => downloadTestCaseCsv(suite.cases || [], `${String(suite.title || 'test-suite').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'test-suite'}-test-cases.csv`)} title="Download CSV">{icons.download}<span>CSV</span></button>
          <button className="delete-suite" onClick={() => onDelete(suite.id)} title="Delete saved suite">{icons.trash}</button>
        </article>)}
      </div>
    </div>
  </section>
}

function formatDate(value) {
  if (!value) return 'Not recorded'
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return value
  }
}

function AdminPanel({ users, session, onDeleteUser, onRoleChange, onStatusChange }) {
  const latestUser = users.slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0]
  const activeUser = users.find(user => user.id === session?.id)

  return <section className="cms-panel admin-panel">
    <div className="cms-hero">
      <div><span>Admin</span><h2>User management</h2><p>Role-based admin area for tracking registered accounts, current sessions, and user activity. Normal users can only access the test case generator.</p></div>
      <strong>{users.length} registered user{users.length === 1 ? '' : 's'}</strong>
    </div>
    <div className="user-stats">
      <article><span>Total users</span><strong>{users.length}</strong><p>Accounts created from registration</p></article>
      <article><span>Current session</span><strong>{activeUser ? activeUser.name.slice(0, 18) : 'None'}</strong><p>{session?.email || 'No active user'}</p></article>
      <article><span>Newest user</span><strong>{latestUser ? latestUser.name.slice(0, 18) : 'None'}</strong><p>{latestUser ? formatDate(latestUser.createdAt) : 'No registrations yet'}</p></article>
    </div>
    <div className="cms-list users-table-card">
      <div className="saved-head"><strong>Registered users</strong><span>Role-based account database</span></div>
      {users.length === 0 ? <p className="cms-empty">No registered users yet. New accounts appear here after registration.</p> : <div className="users-table">
        <div className="users-row users-head"><span>Name</span><span>Email</span><span>Role</span><span>Last login</span><span>Status</span><span>Action</span></div>
        {users.map(user => <div className="users-row" key={user.id}>
          <span><b className="user-avatar">{user.name?.slice(0, 2).toUpperCase() || 'QA'}</b>{user.name}</span>
          <span>{user.email}</span>
          <span><select value={user.role === 'admin' ? 'admin' : 'user'} disabled={user.id === session?.id} onChange={event => onRoleChange(user.id, event.target.value)}><option value="user">User</option><option value="admin">Admin</option></select></span>
          <span>{formatDate(user.lastLoginAt)}</span>
          <span><select value={user.status === 'disabled' ? 'disabled' : 'active'} disabled={user.id === session?.id} onChange={event => onStatusChange(user.id, event.target.value)}><option value="active">Active</option><option value="disabled">Disabled</option></select></span>
          <span><button className="danger" disabled={user.id === session?.id} onClick={() => onDeleteUser(user.id)}>{user.id === session?.id ? 'Current' : 'Delete'}</button></span>
        </div>)}
      </div>}
    </div>
  </section>
}

export default function App() {
  const [form, setForm] = useState(blankForm)
  const [cases, setCases] = useState([])
  const [openCases, setOpenCases] = useState([0])
  const [notice, setNotice] = useState('')
  const [errors, setErrors] = useState({})
  const [generating, setGenerating] = useState(false)
  const [aiEnabled, setAiEnabled] = useState(true)
  const [accessCode, setAccessCode] = useState('')
  const [caseSource, setCaseSource] = useState('standard')
  const [savedSuites, setSavedSuites] = useState([])
  const [activeSuiteId, setActiveSuiteId] = useState('')
  const [editingCaseId, setEditingCaseId] = useState('')
  const [users, setUsers] = useState([])
  const [session, setSession] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState(blankAuthForm)
  const [authError, setAuthError] = useState('')
  const [databaseReady, setDatabaseReady] = useState(false)
  const [workspaceMode, setWorkspaceMode] = useState(null)
  const [activeView, setActiveView] = useState('generator')
  const [profileForm, setProfileForm] = useState(blankProfileForm)
  const [profileError, setProfileError] = useState('')

  const adminAllowed = isEffectiveAdmin(users, session?.id)

  useEffect(() => {
    let active = true
    loadAppData()
      .then(async data => {
        if (!active) return
        setForm({ ...blankForm, ...(data.draft || {}) })
        let nextUsers = data.users || []
        const nextSession = null
        if (supabaseEnabled) {
          await logoutSupabaseUser()
          nextUsers = []
        }
        setSavedSuites(assignUnownedSuites(data.suites || [], nextSession?.id))
        setUsers(nextUsers)
        setSession(nextSession)
        setAuthMode('login')
      })
      .catch(() => setNotice('Database unavailable. Using a blank local workspace.'))
      .finally(() => { if (active) setDatabaseReady(true) })
    return () => { active = false }
  }, [])

  useEffect(() => { if (databaseReady) saveDraftToDatabase(form) }, [form, databaseReady])
  useEffect(() => { if (databaseReady) saveSuitesToDatabase(savedSuites) }, [savedSuites, databaseReady])
  useEffect(() => { if (databaseReady && !supabaseEnabled) saveUsersToDatabase(users) }, [users, databaseReady])
  useEffect(() => { if (databaseReady && !supabaseEnabled) saveSessionToDatabase(session) }, [session, databaseReady])
  const completed = useMemo(() => ['mainModule','subModule','issueTitle','issueDetails','precondition','testSteps'].filter(k => form[k].trim()).length, [form])
  const ownedSuites = useMemo(() => getSuitesForUser(savedSuites, session?.id), [savedSuites, session?.id])
  const mySuites = useMemo(() => getSuitesForWorkspace(ownedSuites, 'maintenance'), [ownedSuites])
  const developmentSuites = useMemo(() => getSuitesForWorkspace(ownedSuites, 'development'), [ownedSuites])

  const updateAuth = (key, value) => {
    setAuthForm(form => ({ ...form, [key]: value }))
    setAuthError('')
  }


  const openProfile = () => {
    setProfileForm({
      ...blankProfileForm,
      name: session?.name || '',
      email: session?.email || '',
    })
    setProfileError('')
    setActiveView('profile')
  }

  const updateProfileField = (key, value) => {
    setProfileForm(form => ({ ...form, [key]: value }))
    setProfileError('')
  }

  const submitProfile = async event => {
    event.preventDefault()
    const result = supabaseEnabled
      ? await updateSupabaseProfile(session?.id, profileForm)
      : updateUserProfile(users, session?.id, profileForm)
    if (!result.ok) {
      setProfileError(result.error)
      return
    }
    setUsers(result.users)
    setSession(result.session)
    setProfileForm({ ...blankProfileForm, name: result.user.name, email: result.user.email })
    setNotice('Profile updated')
    setTimeout(() => setNotice(''), 2200)
  }

  const submitAuth = async event => {
    event.preventDefault()
    const result = supabaseEnabled
      ? (authMode === 'register' ? await registerSupabaseUser(authForm) : await loginSupabaseUser(authForm))
      : (authMode === 'register' ? registerUser(users, authForm) : loginUser(users, authForm))
    if (!result.ok) {
      setAuthError(result.error)
      return
    }
    if (result.users) setUsers(result.users)
    setSession(result.session)
    setSavedSuites(list => assignUnownedSuites(list, result.session?.id))
    setAuthForm(blankAuthForm)
    setAuthError('')
    setNotice(authMode === 'register' ? (supabaseEnabled ? 'Account created in Supabase. Welcome to Casecraft.' : 'Account created. Welcome to Casecraft.') : 'Logged in successfully.')
    setTimeout(() => setNotice(''), 2200)
  }

  const logout = async () => {
    setWorkspaceMode(null)
    if (supabaseEnabled) await logoutSupabaseUser()
    setSession(null)
    setAccessCode('')
    setAuthMode('login')
    setAuthError('')
    setNotice('Logged out')
    setTimeout(() => setNotice(''), 1800)
  }

  const update = (key, value) => {
    setForm(f => ({ ...f, [key]: value }))
    setErrors(e => ({ ...e, [key]: false }))
  }

  const generate = async () => {
    const nextErrors = Object.fromEntries(['mainModule','subModule','issueTitle','issueDetails','testSteps'].map(k => [k, !form[k].trim()]))
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) {
      setNotice('Please complete the highlighted fields.')
      setTimeout(() => setNotice(''), 2400)
      return
    }
    if (aiEnabled && !accessCode.trim()) {
      setNotice('Enter your AI access code, or choose Standard rules.')
      setTimeout(() => setNotice(''), 3000)
      return
    }
    setGenerating(true)

    if (!aiEnabled) {
      const next = generateCases(form)
      setCases(next); setOpenCases([0]); setGenerating(false); setCaseSource('standard'); setActiveSuiteId(''); setEditingCaseId('')
      setNotice(`${next.length} test cases generated`)
      setTimeout(() => setNotice(''), 2400)
      return
    }

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-app-access-code': accessCode.trim() },
        body: JSON.stringify(form),
      })
      const responseText = await response.text()
      let payload = {}
      try {
        payload = responseText ? JSON.parse(responseText) : {}
      } catch {
        throw new Error('AI endpoint did not return JSON.')
      }
      if (!response.ok) throw new Error(payload.error || 'AI generation failed.')
      const aiCases = normalizeCases(payload.cases)
      if (!aiCases.length) throw new Error('AI returned an empty test suite.')
      setCases(aiCases); setOpenCases([0]); setCaseSource('ai'); setActiveSuiteId(''); setEditingCaseId('')
      setNotice(`${aiCases.length} real-world AI test cases generated`)
    } catch (error) {
      const fallback = generateCases(form)
      setCases(fallback); setOpenCases([0]); setCaseSource('standard'); setActiveSuiteId(''); setEditingCaseId('')
      setNotice(`AI unavailable: ${error.message} Standard cases generated instead.`)
    } finally {
      setGenerating(false)
      setTimeout(() => setNotice(''), 5200)
    }
  }

  const saveSuite = async () => {
    if (!cases.length) {
      setNotice('Generate cases before saving a suite.')
      setTimeout(() => setNotice(''), 2200)
      return
    }
    const validation = validateGeneratedCases(cases)
    if (!validation.ok) {
      setNotice(validation.errors[0])
      setTimeout(() => setNotice(''), 2200)
      return
    }
    const snapshot = createSuiteSnapshot({ form, cases, source: caseSource, existingId: activeSuiteId, ownerId: session.id })
    try {
      const nextSuites = await persistSavedSuite({ savedSuites, snapshot, save: saveSuitesToDatabase })
      setSavedSuites(nextSuites)
      setForm(blankForm)
      setCases([])
      setActiveSuiteId('')
      setOpenCase('')
      setEditingCaseId('')
      setCaseSource('standard')
      setNotice(activeSuiteId ? 'Saved suite updated and generator cleared' : 'Suite saved in My test cases and generator cleared')
    } catch {
      setNotice('Suite could not be saved. Check browser storage permissions and try again.')
    }
    setTimeout(() => setNotice(''), 2200)
  }

  const loadSuite = suite => {
    setForm({ ...blankForm, ...suite.form })
    setCases(suite.cases)
    setCaseSource(suite.source || 'standard')
    setActiveSuiteId(suite.id)
    setOpenCases([0])
    setEditingCaseId('')
    setNotice('Saved suite loaded')
    setTimeout(() => setNotice(''), 1800)
  }

  const deleteSuite = suiteId => {
    setSavedSuites(list => list.filter(item => item.id !== suiteId))
    if (activeSuiteId === suiteId) setActiveSuiteId('')
    setNotice('Saved suite deleted')
    setTimeout(() => setNotice(''), 1800)
  }

  const updateCase = (caseId, field, value) => {
    setCases(list => updateCaseField(list, caseId, field, value))
  }

  const updateSteps = (caseId, value) => {
    setCases(list => updateCaseSteps(list, caseId, value))
  }

  const deleteUser = async userId => {
    if (userId === session?.id) {
      setNotice('You cannot delete the currently signed-in user.')
      setTimeout(() => setNotice(''), 2200)
      return
    }
    if (supabaseEnabled) {
      const result = await deleteSupabaseUser(userId)
      if (!result.ok) {
        setNotice(result.error)
        setTimeout(() => setNotice(''), 2400)
        return
      }
      setUsers(result.users)
    } else {
      setUsers(list => list.filter(user => user.id !== userId))
    }
    setNotice(supabaseEnabled ? 'Supabase profile deleted' : 'User registration deleted')
    setTimeout(() => setNotice(''), 1800)
  }

  const changeUserRole = async (userId, role) => {
    const result = supabaseEnabled ? await setSupabaseUserRole(userId, role) : setUserRole(users, session?.id, userId, role)
    if (!result.ok) {
      setNotice(result.error)
      setTimeout(() => setNotice(''), 2400)
      return
    }
    setUsers(result.users)
    setNotice('User role updated')
    setTimeout(() => setNotice(''), 1800)
  }

  const changeUserStatus = async (userId, status) => {
    const result = supabaseEnabled ? await setSupabaseUserStatus(userId, status) : setUserStatus(users, session?.id, userId, status)
    if (!result.ok) {
      setNotice(result.error)
      setTimeout(() => setNotice(''), 2400)
      return
    }
    setUsers(result.users)
    setNotice(status === 'disabled' ? 'User disabled' : 'User activated')
    setTimeout(() => setNotice(''), 1800)
  }

  const suiteText = () => cases.map(c => `${c.id}: ${c.title}\nModule: ${c.module}\nSub-Module: ${c.subModule}\nType: ${c.type} | Priority: ${c.priority}\nDescription: ${c.description}\nPrecondition: ${c.precondition}\nSteps:\n${c.steps.map((s,i) => `${i+1}. ${s}`).join('\n')}\nExpected: ${c.expected}`).join('\n\n---\n\n')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(suiteText())
      setNotice('Copied to clipboard')
    } catch {
      setNotice('Copy failed. Download the CSV instead.')
    }
    setTimeout(() => setNotice(''), 2000)
  }
  const download = () => {
    downloadTestCaseCsv(cases)
    setNotice('CSV downloaded'); setTimeout(() => setNotice(''), 2000)
  }

  if (!databaseReady) return <main className="auth-shell"><section className="auth-card"><div className="auth-brand"><div>{icons.spark}</div><span>casecraft<small>QA workspace</small></span></div><div className="auth-intro"><span>Loading</span><h1>Opening workspace database</h1><p>Preparing your local Casecraft data.</p></div></section></main>

  if (!session) return <AuthScreen mode={authMode} form={authForm} error={authError} onModeChange={mode => { setAuthMode(mode); setAuthError('') }} onUpdate={updateAuth} onSubmit={submitAuth} />

  if (!workspaceMode) return <WorkspaceChooser user={session} onSelect={setWorkspaceMode} onLogout={logout} />

  if (workspaceMode === 'development') return <DevelopmentWorkspace user={session} onSwitch={() => setWorkspaceMode(null)} onLogout={logout} suites={developmentSuites} savedSuites={savedSuites} onSuitesChange={setSavedSuites} onDelete={deleteSuite} />

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div>{icons.spark}</div><span>casecraft<small>QA workspace</small></span></div>
      <nav>
        <button className={activeView === 'generator' ? 'active' : ''} onClick={() => setActiveView('generator')}><i>{icons.plus}</i><span>New suite</span></button>
        <button className={activeView === 'suites' ? 'active' : ''} onClick={() => setActiveView('suites')}><i>{icons.file}</i><span>My test cases</span><b>{mySuites.length}</b></button>
        <button onClick={() => setActiveView('suites')}><i>{icons.clock}</i><span>Recent</span></button>
        {adminAllowed && <button className={activeView === 'admin' ? 'active' : ''} onClick={() => setActiveView('admin')}><i>{icons.settings}</i><span>Admin</span><b>{users.length}</b></button>}
      </nav>
      <div className="sidebar-bottom">
        <div className="tip"><i>{icons.spark}</i><strong>Quick tip</strong><p>Add clear steps for more precise test cases.</p></div>
        <button className="settings" onClick={openProfile}><i>{icons.settings}</i><span>Profile</span></button>
        <div className="profile"><span>{session.name?.slice(0, 2).toUpperCase() || 'QA'}</span><p><strong>{session.name}</strong><small>{session.email}</small></p><button onClick={logout}>Logout</button></div>
      </div>
    </aside>

    <main>
      <header className="topbar">
        <div><p>Workspace <span>/</span> {activeView === 'profile' ? 'Profile settings' : activeView === 'suites' ? 'My test cases' : activeView === 'admin' && adminAllowed ? 'Admin / Users' : 'New test suite'}</p><h1>{activeView === 'profile' ? 'Profile Settings' : activeView === 'suites' ? 'My Test Cases' : activeView === 'admin' && adminAllowed ? 'User Management' : 'Test case generator'}</h1></div>
        <div className="status"><span>Signed in as {session.name}</span><button className="switch-workspace" onClick={() => setWorkspaceMode(null)}>Switch workspace</button><button className="logout-top" onClick={logout}>Logout</button><i>{icons.check}</i></div>
      </header>

      {activeView === 'profile' ? <ProfilePanel form={profileForm} error={profileError} onUpdate={updateProfileField} onSubmit={submitProfile} onCancel={() => setActiveView('generator')} /> : activeView === 'suites' ? <SavedSuitesPanel suites={mySuites} activeSuiteId={activeSuiteId} onLoad={suite => { loadSuite(suite); setActiveView('generator') }} onDelete={deleteSuite} onBack={() => setActiveView('generator')} /> : activeView === 'admin' && adminAllowed ? <AdminPanel users={users} session={session} onDeleteUser={deleteUser} onRoleChange={changeUserRole} onStatusChange={changeUserStatus} /> : <div className="workspace">
        <section className="form-panel">
          <div className="panel-intro"><span>01</span><div><h2>Describe the issue</h2><p>Give us the context. The clearer the details, the sharper the tests.</p></div><b>{completed}/6</b></div>
          <div className="form-grid">
            <Field label="Main module" required><input className={errors.mainModule ? 'error' : ''} value={form.mainModule} onChange={e => update('mainModule', e.target.value)} placeholder="e.g. Authentication" /></Field>
            <Field label="Sub module" required><input className={errors.subModule ? 'error' : ''} value={form.subModule} onChange={e => update('subModule', e.target.value)} placeholder="e.g. Password recovery" /></Field>
            <Field label="Issue title" required wide><input className={errors.issueTitle ? 'error' : ''} value={form.issueTitle} onChange={e => update('issueTitle', e.target.value)} placeholder="What should be tested?" /></Field>
            <Field label="Issue details" required wide hint={`${form.issueDetails.length}/600`}><textarea className={errors.issueDetails ? 'error' : ''} maxLength="600" rows="4" value={form.issueDetails} onChange={e => update('issueDetails', e.target.value)} placeholder="Describe the feature, expected behavior, rules, and constraints..." /></Field>
            <Field label="Precondition" wide hint="Optional"><textarea rows="2" value={form.precondition} onChange={e => update('precondition', e.target.value)} placeholder="What must already be true before testing begins?" /></Field>
            <Field label="Test steps" required wide hint="One step per line"><textarea className={errors.testSteps ? 'error' : ''} rows="6" value={form.testSteps} onChange={e => update('testSteps', e.target.value)} placeholder={'Open the sign-in page\nEnter a registered email\nSelect Continue'} /></Field>
          </div>

          <div className="options-row">
            <Field label="Priority"><select value={form.priority} onChange={e => update('priority', e.target.value)}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></Field>
            <Field label="Coverage"><select value={form.coverage} onChange={e => update('coverage', e.target.value)}><option>Focused</option><option>Balanced</option><option>Thorough</option></select></Field>
            <Field label="Generation mode"><select value={aiEnabled ? 'AI enhanced' : 'Standard rules'} onChange={e => setAiEnabled(e.target.value === 'AI enhanced')}><option>AI enhanced</option><option>Standard rules</option></select></Field>
            {aiEnabled && <Field label="AI access code" hint="Not saved"><input type="password" value={accessCode} onChange={e => setAccessCode(e.target.value)} placeholder="Enter your private code" autoComplete="off" /></Field>}
          </div>

          <div className="form-actions">
            <button className="clear" onClick={() => { setForm(blankForm); setCases([]); setErrors({}); setAccessCode(''); setActiveSuiteId(''); setEditingCaseId(''); setNotice('Draft cleared'); setTimeout(() => setNotice(''), 1600) }}>{icons.trash}<span>Clear</span></button>
            <button className="example" onClick={() => { setForm(example); setErrors({}) }}>Use example</button>
            {cases.length > 0 && <button className="save-suite" onClick={saveSuite}>{icons.file}<span>{activeSuiteId ? 'Update saved suite' : 'Save suite'}</span></button>}
            <button className="generate" onClick={generate} disabled={generating}>{generating ? <span className="spinner"/> : icons.wand}<span>{generating ? 'Analyzing real-world scenarios…' : aiEnabled ? 'Generate with AI' : 'Generate test cases'}</span></button>
          </div>
        </section>

        <section className="result-panel">
          <div className="result-head"><div><span>02</span><div><h2>{cases.length && caseSource === 'ai' ? 'AI-generated suite' : 'Generated suite'}</h2><p>{cases.length ? `${cases.length} test cases · ${form.mainModule}` : 'Ready when you are'}</p></div></div>
            {cases.length > 0 && <aside><button onClick={copy} title="Copy suite">{icons.copy}</button><button onClick={download} title="Download suite">{icons.download}</button></aside>}
          </div>
          {cases.length === 0 ? <EmptyState /> : <div className="cases-list">
            <div className="suite-summary"><div><span>{cases.length}</span><p><strong>Total cases</strong><small>{form.coverage} coverage</small></p></div><div className="summary-types">{[...new Set(cases.map(c => c.type))].map(t => <span key={t}>{t}</span>)}</div></div>
            {cases.map((item, i) => <TestCase key={item.id} item={item} open={openCases.includes(i)} editing={editingCaseId === item.id} onEditToggle={() => setEditingCaseId(id => id === item.id ? '' : item.id)} onFieldChange={(field, value) => updateCase(item.id, field, value)} onStepsChange={value => updateSteps(item.id, value)} onToggle={() => setOpenCases(o => o.includes(i) ? [] : [i])}/>) }
          </div>}
        </section>
      </div>}
    </main>
    {notice && <div className="toast"><i>{icons.check}</i>{notice}</div>}
  </div>
}
