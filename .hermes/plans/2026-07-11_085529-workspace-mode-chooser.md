# Development / Maintenance Workspace Chooser Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** After a successful Casecraft login, show a dedicated page where the user chooses either the existing Maintenance workspace or a future Development workspace.

**Architecture:** Add a session-scoped `workspaceMode` state to `src/App.jsx`. Authentication remains the first screen. Once authenticated, a new `WorkspaceChooser` becomes the routing gate; Maintenance opens the existing application unchanged, while Development opens a lightweight placeholder that defines the future entry point without building the development generator yet.

**Tech Stack:** React 19, Vite, existing CSS in `src/styles.css`, Node's built-in test runner.

---

## Product flow

1. Opening the production URL always shows the existing login page.
2. Successful login opens the new **Choose your workspace** page.
3. The page presents two clear cards:
   - **Development** — “Create test cases for new features before release.”
   - **Maintenance** — “Create regression and issue-based test cases for an existing application.”
4. Choosing **Maintenance** opens the current Casecraft generator and all existing Maintenance features.
5. Choosing **Development** opens a simple “Development workspace is ready for the next phase” placeholder; it must not reuse or accidentally expose the Maintenance generator.
6. Both destinations provide **Switch workspace**, returning to the chooser without logging out.
7. Logging out clears the selected workspace.
8. Refreshing or reopening the URL preserves the current security behavior: the user returns to login, then chooses a workspace again.

## Non-goals for this phase

- Do not build the Development test-case form or generator.
- Do not change Supabase tables or authentication.
- Do not persist workspace preference locally or in Supabase.
- Do not change Maintenance suite storage, search, editing, timestamps, or creator privacy.

---

### Task 1: Add failing view-routing tests

**Objective:** Specify the login → chooser → workspace flow before changing production code.

**Files:**
- Modify: `src/appViews.test.mjs`
- Test: `src/appViews.test.mjs`

**Step 1: Add source-level routing assertions**

Add tests that require:

```js
test('authenticated users choose a workspace before entering Casecraft', () => {
  assert.match(source, /useState\(null\).*workspaceMode|workspaceMode.*useState\(null\)/s)
  assert.match(source, /if \(!workspaceMode\) return <WorkspaceChooser/)
})

test('workspace chooser offers development and maintenance', () => {
  const chooser = source.slice(
    source.indexOf('function WorkspaceChooser'),
    source.indexOf('function DevelopmentWorkspace'),
  )
  assert.match(chooser, />Development</)
  assert.match(chooser, />Maintenance</)
  assert.match(chooser, /onSelect\('development'\)/)
  assert.match(chooser, /onSelect\('maintenance'\)/)
})

test('development selection has a placeholder instead of the maintenance generator', () => {
  assert.match(source, /workspaceMode === 'development' \? <DevelopmentWorkspace/)
})

test('logout clears the selected workspace', () => {
  const logoutBody = source.slice(source.indexOf('const logout'), source.indexOf('const updateProfileField'))
  assert.match(logoutBody, /setWorkspaceMode\(null\)/)
})
```

Adjust slice boundaries to the final component order if necessary, but keep assertions focused on user-visible routing behavior.

**Step 2: Run the test to verify failure**

Run:

```bash
node --test src/appViews.test.mjs
```

Expected: FAIL because `workspaceMode`, `WorkspaceChooser`, and `DevelopmentWorkspace` do not exist.

**Step 3: Commit the failing tests**

```bash
git add src/appViews.test.mjs
git commit -m "test: define workspace chooser flow"
```

---

### Task 2: Build the workspace chooser component

**Objective:** Add the post-login selection page with Development and Maintenance options.

**Files:**
- Modify: `src/App.jsx` near `AuthScreen`
- Modify: `src/styles.css`
- Test: `src/appViews.test.mjs`

**Step 1: Add `WorkspaceChooser` in `src/App.jsx`**

Use a focused component API:

```jsx
function WorkspaceChooser({ user, onSelect, onLogout }) {
  return <main className="workspace-choice-shell">
    <section className="workspace-choice-card">
      <div className="auth-brand">
        <div>{icons.spark}</div>
        <span>casecraft<small>QA workspace</small></span>
      </div>
      <div className="workspace-choice-heading">
        <span>Welcome, {user.name}</span>
        <h1>Choose your workspace</h1>
        <p>Select how you want to create and manage test cases.</p>
      </div>
      <div className="workspace-choice-grid">
        <button onClick={() => onSelect('development')}>
          <strong>Development</strong>
          <span>Create test cases for new features before release.</span>
        </button>
        <button onClick={() => onSelect('maintenance')}>
          <strong>Maintenance</strong>
          <span>Create regression and issue-based tests for an existing application.</span>
        </button>
      </div>
      <button className="workspace-choice-logout" onClick={onLogout}>Logout</button>
    </section>
  </main>
}
```

**Step 2: Add chooser styling in `src/styles.css`**

Create dedicated selectors rather than coupling the chooser to `.app-shell`:

```css
.workspace-choice-shell { min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #f4f2ec; }
.workspace-choice-card { width: min(900px, 100%); background: #fbfaf7; border: 1px solid #e3e1da; border-radius: 18px; padding: 34px; box-shadow: 0 18px 55px rgba(37,35,29,.1); }
.workspace-choice-heading { margin: 34px 0 24px; }
.workspace-choice-heading > span { color: #6f6c64; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .7px; }
.workspace-choice-heading h1 { margin: 9px 0; font: 800 32px/1.1 'Manrope'; }
.workspace-choice-heading p { margin: 0; color: #85827a; }
.workspace-choice-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.workspace-choice-grid button { min-height: 180px; border: 1px solid #ddd9cf; border-radius: 14px; padding: 24px; background: #fff; text-align: left; display: flex; flex-direction: column; justify-content: flex-end; gap: 8px; }
.workspace-choice-grid button:hover { border-color: #9ab85d; box-shadow: 0 8px 24px rgba(87,108,47,.12); transform: translateY(-2px); }
.workspace-choice-grid strong { font: 800 20px/1 'Manrope'; }
.workspace-choice-grid span { color: #77746d; line-height: 1.5; }
.workspace-choice-logout { margin-top: 20px; border: 0; background: transparent; color: #77746d; font-weight: 700; }
```

Add a mobile rule making `.workspace-choice-grid` one column below `760px`.

**Step 3: Run the targeted tests**

```bash
node --test src/appViews.test.mjs
```

Expected: chooser content assertions pass; routing tests may still fail until Task 4.

**Step 4: Commit**

```bash
git add src/App.jsx src/styles.css src/appViews.test.mjs
git commit -m "feat: add Casecraft workspace chooser"
```

---

### Task 3: Add the Development placeholder

**Objective:** Give Development a safe destination without building its generator in this phase.

**Files:**
- Modify: `src/App.jsx` near `WorkspaceChooser`
- Modify: `src/styles.css`
- Test: `src/appViews.test.mjs`

**Step 1: Add `DevelopmentWorkspace`**

```jsx
function DevelopmentWorkspace({ user, onSwitch, onLogout }) {
  return <main className="development-placeholder">
    <section>
      <div className="auth-brand"><div>{icons.spark}</div><span>casecraft<small>Development</small></span></div>
      <span>Development workspace</span>
      <h1>Build test coverage for new features</h1>
      <p>The Development test-case workflow will be designed in the next phase.</p>
      <div className="development-placeholder-actions">
        <button onClick={onSwitch}>Switch workspace</button>
        <button onClick={onLogout}>Logout {user.name}</button>
      </div>
    </section>
  </main>
}
```

The placeholder must not expose New Suite, My Test Cases, Recent, or Maintenance data.

**Step 2: Add minimal responsive styling**

Reuse Casecraft tokens and typography, but keep `.development-placeholder` isolated from the Maintenance workspace layout.

**Step 3: Run the targeted tests**

```bash
node --test src/appViews.test.mjs
```

Expected: Development placeholder assertions pass.

**Step 4: Commit**

```bash
git add src/App.jsx src/styles.css src/appViews.test.mjs
git commit -m "feat: add development workspace placeholder"
```

---

### Task 4: Gate the existing app behind workspace selection

**Objective:** Connect the chooser to login while preserving the Maintenance application.

**Files:**
- Modify: `src/App.jsx:320-670` (state, login/logout, and render gates)
- Test: `src/appViews.test.mjs`

**Step 1: Add session-scoped state**

Inside `App`:

```jsx
const [workspaceMode, setWorkspaceMode] = useState(null)
```

Do not store this in IndexedDB or Supabase during this phase.

**Step 2: Keep authentication as the first gate**

Preserve:

```jsx
if (!databaseReady) return <LoadingScreen />
if (!session) return <AuthScreen ... />
```

Immediately after the session gate, add:

```jsx
if (!workspaceMode) {
  return <WorkspaceChooser
    user={session}
    onSelect={setWorkspaceMode}
    onLogout={logout}
  />
}

if (workspaceMode === 'development') {
  return <DevelopmentWorkspace
    user={session}
    onSwitch={() => setWorkspaceMode(null)}
    onLogout={logout}
  />
}
```

The existing `<div className="app-shell">` then becomes the Maintenance destination without rewriting its internals.

**Step 3: Clear mode on logout**

At the beginning of `logout`:

```jsx
setWorkspaceMode(null)
```

Keep the existing Supabase sign-out and login-page behavior.

**Step 4: Add Switch workspace to Maintenance**

Add a small button near the existing Logout action:

```jsx
<button className="switch-workspace" onClick={() => setWorkspaceMode(null)}>
  Switch workspace
</button>
```

Do not clear the generator or saved suites when switching; it is navigation within the authenticated session.

**Step 5: Run targeted and full tests**

```bash
node --test src/appViews.test.mjs
npm test
npm run build
```

Expected:
- Targeted tests pass.
- Full suite passes with no regressions.
- Vite production build succeeds.

**Step 6: Commit**

```bash
git add src/App.jsx src/styles.css src/appViews.test.mjs
git commit -m "feat: route users through workspace selection"
```

---

### Task 5: Browser validation

**Objective:** Prove the complete flow works in a real browser before deployment.

**Files:** None unless a defect is found.

**Step 1: Start or reuse the local Vite server**

```bash
npm run dev -- --host 127.0.0.1
```

**Step 2: Validate the flow manually**

1. Open the local URL.
2. Confirm login is the first page.
3. Log in with a valid Supabase account.
4. Confirm the chooser appears before any generator UI.
5. Choose Maintenance and confirm all existing features remain available.
6. Select Switch workspace and confirm the chooser returns without logging out.
7. Choose Development and confirm only the placeholder appears.
8. Switch back to Maintenance and confirm existing browser-local suites remain available to their creator.
9. Logout and confirm the login page appears.
10. Refresh and confirm login remains the first page.

**Step 3: Run final automated verification**

```bash
npm test
npm run build
git diff --check
git status --short
```

Expected:
- All tests pass.
- Build succeeds.
- No whitespace errors.
- Only intended files are modified.

---

### Task 6: Deploy and verify production

**Objective:** Release the chooser safely and confirm the Vercel bundle contains it.

**Files:** None beyond prior tasks.

**Step 1: Push reviewed commits**

```bash
git push origin main
```

**Step 2: Wait for Vercel success**

Verify the GitHub commit status reports `success`.

**Step 3: Verify production**

Open:

```text
https://testcase-generator-six.vercel.app/
```

Confirm:
- Login appears first.
- Successful login opens Choose your workspace.
- Maintenance opens the current app.
- Development opens only the placeholder.
- Switch workspace works from both destinations.
- Logout returns to login.

## Files likely to change

- `src/App.jsx` — chooser, placeholder, mode state, render gates, switch actions.
- `src/styles.css` — chooser and placeholder styling, responsive rules.
- `src/appViews.test.mjs` — routing and visible-content regression tests.

## Risks and mitigations

- **Risk:** Existing Maintenance UI accidentally renders before selection. **Mitigation:** place the chooser gate before the current `app-shell` return and cover it with a test.
- **Risk:** Switching workspaces clears generated or saved Maintenance data. **Mitigation:** mode switching changes only `workspaceMode`; do not reset `form`, `cases`, or `savedSuites`.
- **Risk:** Development accidentally exposes Maintenance suites. **Mitigation:** use a separate placeholder component and do not pass suite state into it.
- **Risk:** Workspace choice persists unexpectedly. **Mitigation:** keep it in React state only and clear it on logout.
- **Risk:** Scope expands into a Development generator prematurely. **Mitigation:** keep the Development destination explicitly placeholder-only in this phase.

## Acceptance criteria

- Login remains the initial URL landing page.
- No authenticated user enters Maintenance automatically.
- Both Development and Maintenance choices are visible and keyboard-accessible.
- Maintenance preserves all existing behavior.
- Development does not display Maintenance features or suites.
- Switch workspace works without logging out or deleting data.
- Logout clears the workspace selection.
- Automated tests and production build pass.
