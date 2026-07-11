export const developmentBlankForm = {
  featureName: '',
  module: '',
  description: '',
  userRoles: '',
  userFlow: '',
  expectedBehavior: '',
  acceptanceCriteria: '',
  dependencies: '',
  edgeCases: '',
  priority: 'Medium',
  coverage: 'Balanced',
}

export const developmentExample = {
  featureName: 'Team member invitation',
  module: 'Workspace management',
  description: 'Workspace owners can invite teammates by email, choose their role, and monitor whether each invitation is pending, accepted, or expired.',
  userRoles: 'Workspace owner\nInvited teammate\nExisting workspace member',
  userFlow: 'Open workspace settings\nSelect Team members\nChoose Invite member\nEnter a valid email address\nSelect a workspace role\nSend the invitation\nOpen the invitation email\nAccept the invitation',
  expectedBehavior: 'A single secure invitation is sent, its status is shown as pending, and the teammate joins the workspace with the selected role after accepting it.',
  acceptanceCriteria: 'Only workspace owners can send invitations\nThe email address must be valid\nAn existing active member cannot be invited again\nInvitation links expire after 72 hours\nThe selected role is applied after acceptance\nThe owner can resend or revoke a pending invitation',
  dependencies: 'Authentication service\nEmail delivery service\nWorkspace membership API\nRole and permission service',
  edgeCases: 'Invitation sent twice rapidly\nInvitation opened after expiration\nInvitation revoked before acceptance\nEmail already belongs to an active member\nUser changes email capitalization\nEmail service is temporarily unavailable',
  priority: 'High',
  coverage: 'Comprehensive',
}

function lines(value) {
  return String(value || '')
    .split('\n')
    .map(item => item.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '').trim())
    .filter(Boolean)
}

export function createDevelopmentAiPayload(form) {
  const safe = { ...developmentBlankForm, ...(form || {}) }
  const issueDetails = [
    safe.description,
    safe.userRoles && `User roles:\n${safe.userRoles}`,
    safe.expectedBehavior && `Expected behavior:\n${safe.expectedBehavior}`,
    safe.acceptanceCriteria && `Acceptance criteria:\n${safe.acceptanceCriteria}`,
    safe.selectedRequirements?.length && `Approved source requirements:\n${safe.selectedRequirements.map(requirement => `${requirement.id}: ${requirement.text}`).join('\n')}`,
    safe.dependencies && `Dependencies:\n${safe.dependencies}`,
    safe.edgeCases && `Edge cases:\n${safe.edgeCases}`,
  ].filter(Boolean).join('\n\n')

  return {
    ...safe,
    workspace: 'development',
    mainModule: safe.module || 'Development',
    subModule: 'Feature delivery',
    issueTitle: safe.featureName,
    issueDetails,
    precondition: safe.userRoles || safe.dependencies || 'User has access to the feature environment.',
    testSteps: safe.userFlow || 'Open the feature\nPerform the primary action\nObserve the result',
    coverage: safe.coverage === 'Comprehensive' ? 'Thorough' : safe.coverage,
  }
}

function baseCase(form, index, type, title) {
  return {
    id: `DTC-${String(index).padStart(3, '0')}`,
    type,
    priority: form.priority,
    module: form.module.trim(),
    title,
    requirementIds: [...(form.selectedRequirementIds || [])],
  }
}

export function createDevelopmentCases(form = developmentBlankForm) {
  const errors = {}
  if (!form.featureName?.trim()) errors.featureName = true
  if (!form.description?.trim()) errors.description = true
  if (Object.keys(errors).length) return { ok: false, errors, cases: [] }

  const name = form.featureName.trim()
  const flow = lines(form.userFlow)
  const roles = lines(form.userRoles)
  const criteria = lines(form.acceptanceCriteria)
  const dependencies = lines(form.dependencies)
  const edgeCases = lines(form.edgeCases)
  const expected = form.expectedBehavior?.trim() || `The ${name} feature behaves as designed and completes without errors.`

  const cases = [{
    ...baseCase(form, 1, 'Positive', `${name} — primary user flow`),
    description: `Verify the main feature workflow: ${form.description.trim()}`,
    precondition: roles.length ? `${roles.join(', ')} can access the feature in a valid environment.` : 'An authorized user can access the feature in a valid environment.',
    steps: flow.length ? flow : [`Open the ${name} feature`, 'Complete the primary user action', 'Observe the result'],
    expected,
  }]

  if (form.coverage === 'Focused') return { ok: true, errors: {}, cases }

  cases.push({
    ...baseCase(form, 2, 'Acceptance', `${name} — acceptance criteria`),
    description: `Verify every documented acceptance criterion for ${name}.`,
    precondition: 'The feature is available in a test environment with valid test data.',
    steps: criteria.length ? criteria.map(item => `Verify: ${item}`) : ['Review the feature requirements', 'Exercise each documented requirement', 'Record any unmet criterion'],
    expected: criteria.length ? `All acceptance criteria are satisfied: ${criteria.join('; ')}.` : expected,
  })

  cases.push({
    ...baseCase(form, 3, 'Access', `${name} — user roles and permissions`),
    description: `Verify access and behavior for the intended roles: ${roles.length ? roles.join(', ') : 'authorized and unauthorized users'}.`,
    precondition: 'Test accounts exist for each relevant role and permission level.',
    steps: roles.length ? roles.map(role => `Sign in as ${role} and verify the available actions`) : ['Sign in as an authorized user', 'Repeat as a user without access'],
    expected: 'Each role can perform only its permitted actions, and restricted actions are blocked clearly.',
  })

  if (form.coverage === 'Comprehensive') {
    cases.push({
      ...baseCase(form, 4, 'Integration', `${name} — dependency failure handling`),
      description: `Verify safe behavior when dependencies are unavailable: ${dependencies.length ? dependencies.join(', ') : 'connected services'}.`,
      precondition: 'The feature is available and a dependency can be delayed, disabled, or made to return an error.',
      steps: dependencies.length ? dependencies.map(item => `Make ${item} unavailable and attempt the feature workflow`) : ['Make a connected service unavailable', 'Attempt the feature workflow', 'Observe recovery behavior'],
      expected: 'The feature fails safely, preserves consistent data, and shows a safe, actionable error with a retry or recovery path.',
    })

    cases.push({
      ...baseCase(form, 5, 'Edge case', `${name} — edge and exceptional scenarios`),
      description: `Verify exceptional conditions for ${name}.`,
      precondition: 'The feature is available with data required to reproduce each edge condition.',
      steps: edgeCases.length ? edgeCases.map(item => `Exercise edge case: ${item}`) : ['Use empty, duplicate, expired, and boundary-value data', 'Complete the workflow for each condition'],
      expected: 'Every edge condition is handled predictably without data loss, duplicate actions, or unhandled errors.',
    })
  }

  return { ok: true, errors: {}, cases }
}
