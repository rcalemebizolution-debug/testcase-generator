import { useEffect, useMemo, useState } from 'react'

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

function TestCase({ item, open, onToggle }) {
  return <article className={`test-case ${open ? 'open' : ''}`}>
    <button className="case-head" onClick={onToggle} aria-expanded={open}>
      <span className={`case-type ${item.type.toLowerCase()}`}>{item.type}</span>
      <span className="case-heading"><small>{item.id} · {[item.module, item.subModule].filter(Boolean).join(' / ')}</small><strong>{item.title}</strong></span>
      <span className={`priority ${item.priority.toLowerCase()}`}>{item.priority}</span>
      <span className="case-chevron">{icons.chevron}</span>
    </button>
    {open && <div className="case-body">
      <section><h4>Description</h4><p>{item.description}</p></section>
      <section><h4>Precondition</h4><p>{item.precondition}</p></section>
      <section><h4>Test steps</h4><ol>{item.steps.map((step, i) => <li key={i}><span>{i + 1}</span><p>{step}</p></li>)}</ol></section>
      <section className="expected"><h4>Expected result</h4><p><i>{icons.check}</i>{item.expected}</p></section>
    </div>}
  </article>
}

export default function App() {
  const [form, setForm] = useState(() => JSON.parse(localStorage.getItem('casecraft-form') || 'null') || blankForm)
  const [cases, setCases] = useState([])
  const [openCases, setOpenCases] = useState([0])
  const [notice, setNotice] = useState('')
  const [errors, setErrors] = useState({})
  const [generating, setGenerating] = useState(false)
  const [aiEnabled, setAiEnabled] = useState(true)
  const [licenseKey, setLicenseKey] = useState('')
  const [caseSource, setCaseSource] = useState('standard')
  const [quota, setQuota] = useState(null)
  const [licenseLabel, setLicenseLabel] = useState('')

  useEffect(() => { localStorage.setItem('casecraft-form', JSON.stringify(form)) }, [form])
  const completed = useMemo(() => ['mainModule','subModule','issueTitle','issueDetails','precondition','testSteps'].filter(k => form[k].trim()).length, [form])

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
    if (aiEnabled && !licenseKey.trim()) {
      setNotice('Enter your license key, or choose Standard rules.')
      setTimeout(() => setNotice(''), 3000)
      return
    }
    setGenerating(true)

    if (!aiEnabled) {
      const next = generateCases(form)
      setCases(next); setOpenCases([0]); setGenerating(false); setCaseSource('standard')
      setQuota(null)
      setLicenseLabel('')
      setNotice(`${next.length} test cases generated`)
      setTimeout(() => setNotice(''), 2400)
      return
    }

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-license-key': licenseKey.trim() },
        body: JSON.stringify(form),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'AI generation failed.')
      setCases(payload.cases); setOpenCases([0]); setCaseSource('ai')
      setQuota(payload.quota || null)
      setLicenseLabel(payload.license?.label || '')
      setNotice(`${payload.cases.length} AI test cases generated${payload.quota ? ` • ${payload.quota.remainingGenerations} runs left this month` : ''}`)
    } catch (error) {
      const fallback = generateCases(form)
      setCases(fallback); setOpenCases([0]); setCaseSource('standard')
      setQuota(null)
      setLicenseLabel('')
      setNotice(`AI unavailable: ${error.message} Standard cases generated instead.`)
    } finally {
      setGenerating(false)
      setTimeout(() => setNotice(''), 5200)
    }
  }

  const suiteText = () => cases.map(c => `${c.id}: ${c.title}\nModule: ${c.module}\nSub-Module: ${c.subModule}\nType: ${c.type} | Priority: ${c.priority}\nDescription: ${c.description}\nPrecondition: ${c.precondition}\nSteps:\n${c.steps.map((s,i) => `${i+1}. ${s}`).join('\n')}\nExpected: ${c.expected}`).join('\n\n---\n\n')
  const copy = async () => { await navigator.clipboard.writeText(suiteText()); setNotice('Copied to clipboard'); setTimeout(() => setNotice(''), 2000) }
  const download = () => {
    const headers = ['Test Cases #', 'Priority', 'Module', 'Sub-Module', 'Test Scenario', 'Description', 'Pre-Condition', 'Steps / Test Data', 'Expected Result', 'Actual Result', 'Status', 'Bug Link/ID', 'Tester', 'Date Tested', 'Remarks']
    const escapeCsv = value => `"${String(value ?? '').replace(/"/g, '""')}"`
    const rows = cases.map(item => [
      item.id,
      item.priority,
      item.module,
      item.subModule,
      item.title,
      item.description,
      item.precondition,
      item.steps.map((step, index) => `${index + 1}. ${step}`).join('\n'),
      item.expected,
      '', '', '', '', '', '',
    ])
    const csv = [headers, ...rows].map(row => row.map(escapeCsv).join(',')).join('\r\n')
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = 'test-case-suite.csv'; a.click(); URL.revokeObjectURL(a.href)
    setNotice('CSV downloaded'); setTimeout(() => setNotice(''), 2000)
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div>{icons.spark}</div><span>casecraft<small>QA workspace</small></span></div>
      <nav>
        <button className="active"><i>{icons.plus}</i><span>New suite</span></button>
        <button><i>{icons.file}</i><span>My test cases</span><b>12</b></button>
        <button><i>{icons.clock}</i><span>Recent</span></button>
      </nav>
      <div className="sidebar-bottom">
        <div className="tip"><i>{icons.spark}</i><strong>Quick tip</strong><p>Add clear steps for more precise test cases.</p></div>
        <button className="settings"><i>{icons.settings}</i><span>Settings</span></button>
        <div className="profile"><span>IA</span><p><strong>Isaac</strong><small>QA Engineer</small></p><b>•••</b></div>
      </div>
    </aside>

    <main>
      <header className="topbar">
        <div><p>Workspace <span>/</span> New test suite</p><h1>Test case generator</h1></div>
        <div className="status"><span>Draft saved</span><i>{icons.check}</i></div>
      </header>

      <div className="workspace">
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
            {aiEnabled && <Field label="License key" hint="Not saved"><input type="password" value={licenseKey} onChange={e => setLicenseKey(e.target.value)} placeholder="Enter the paid AI license key" autoComplete="off" /></Field>}
          </div>
          {aiEnabled && quota && <div className="tip">
            <i>{icons.spark}</i>
            <strong>{licenseLabel || 'Active license'}</strong>
            <p>{quota.remainingGenerations} AI runs left in {quota.periodKey}. {quota.remainingTokens.toLocaleString()} tokens remaining.</p>
          </div>}

          <div className="form-actions">
            <button className="clear" onClick={() => { setForm(blankForm); setCases([]); setErrors({}); setQuota(null); setLicenseLabel('') }}>{icons.trash}<span>Clear</span></button>
            <button className="example" onClick={() => { setForm(example); setErrors({}); setQuota(null); setLicenseLabel('') }}>Use example</button>
            <button className="generate" onClick={generate} disabled={generating}>{generating ? <span className="spinner"/> : icons.wand}<span>{generating ? 'Analyzing real-world scenarios…' : aiEnabled ? 'Generate with AI' : 'Generate test cases'}</span></button>
          </div>
        </section>

        <section className="result-panel">
          <div className="result-head"><div><span>02</span><div><h2>{cases.length && caseSource === 'ai' ? 'AI-generated suite' : 'Generated suite'}</h2><p>{cases.length ? `${cases.length} test cases · ${form.mainModule}` : 'Ready when you are'}</p></div></div>
            {cases.length > 0 && <aside><button onClick={copy} title="Copy suite">{icons.copy}</button><button onClick={download} title="Download suite">{icons.download}</button></aside>}
          </div>
          {cases.length === 0 ? <EmptyState /> : <div className="cases-list">
            <div className="suite-summary"><div><span>{cases.length}</span><p><strong>Total cases</strong><small>{form.coverage} coverage</small></p></div><div className="summary-types">{[...new Set(cases.map(c => c.type))].map(t => <span key={t}>{t}</span>)}</div></div>
            {cases.map((item, i) => <TestCase key={item.id} item={item} open={openCases.includes(i)} onToggle={() => setOpenCases(o => o.includes(i) ? [] : [i])}/>) }
          </div>}
        </section>
      </div>
    </main>
    {notice && <div className="toast"><i>{icons.check}</i>{notice}</div>}
  </div>
}
