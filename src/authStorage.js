export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

export function createUser({ name, email, password, role = 'user' }) {
  const normalizedEmail = normalizeEmail(email)
  return {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: String(name || '').trim(),
    email: normalizedEmail,
    role,
    status: 'active',
    // Local-only demo auth. Do not use this storage model for production passwords.
    passwordHash: btoa(unescape(encodeURIComponent(String(password || '')))),
    createdAt: new Date().toISOString(),
  }
}

export function createSession(user, signedInAt = new Date().toISOString()) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    signedInAt,
  }
}

export function markUserLogin(users, userId, signedInAt = new Date().toISOString()) {
  return (Array.isArray(users) ? users : []).map(user => user.id === userId ? { ...user, lastLoginAt: signedInAt } : user)
}

export function getUserRole(user) {
  return user?.role === 'admin' ? 'admin' : 'user'
}

export function getOldestUser(users) {
  return (Array.isArray(users) ? users : [])
    .filter(Boolean)
    .slice()
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))[0] || null
}

export function isEffectiveAdmin(users, actorId) {
  const safeUsers = Array.isArray(users) ? users : []
  const actor = safeUsers.find(user => user.id === actorId)
  if (getUserRole(actor) === 'admin') return true
  return getOldestUser(safeUsers)?.id === actorId
}

export function canManageUser(users, actorId, targetUserId) {
  return isEffectiveAdmin(users, actorId) && actorId !== targetUserId
}

export function setUserRole(users, actorId, targetUserId, role) {
  const safeUsers = Array.isArray(users) ? users : []
  const target = safeUsers.find(user => user.id === targetUserId)
  const nextRole = role === 'admin' ? 'admin' : 'user'

  if (!target) return { ok: false, error: 'User not found.', users: safeUsers }
  if (!canManageUser(safeUsers, actorId, targetUserId)) return { ok: false, error: 'Only an admin can update another user role.', users: safeUsers }

  return {
    ok: true,
    users: safeUsers.map(user => user.id === targetUserId ? { ...user, role: nextRole } : user),
  }
}

export function setUserStatus(users, actorId, targetUserId, status) {
  const safeUsers = Array.isArray(users) ? users : []
  const target = safeUsers.find(user => user.id === targetUserId)
  const nextStatus = status === 'disabled' ? 'disabled' : 'active'

  if (!target) return { ok: false, error: 'User not found.', users: safeUsers }
  if (!canManageUser(safeUsers, actorId, targetUserId)) return { ok: false, error: 'Only an admin can update another user status.', users: safeUsers }

  return {
    ok: true,
    users: safeUsers.map(user => user.id === targetUserId ? { ...user, status: nextStatus } : user),
  }
}


export function updateUserProfile(users, userId, details = {}) {
  const safeUsers = Array.isArray(users) ? users : []
  const current = safeUsers.find(user => user.id === userId)
  if (!current) return { ok: false, error: 'User not found.', users: safeUsers }

  const name = String(details.name ?? current.name ?? '').trim()
  const email = normalizeEmail(details.email ?? current.email)
  const password = String(details.password || '')
  const confirmPassword = String(details.confirmPassword || '')

  if (!name) return { ok: false, error: 'Enter your name.', users: safeUsers }
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: 'Enter a valid email address.', users: safeUsers }
  if (safeUsers.some(user => user.id !== userId && normalizeEmail(user.email) === email)) {
    return { ok: false, error: 'An account with this email already exists.', users: safeUsers }
  }
  if (password || confirmPassword) {
    if (password.length < 6) return { ok: false, error: 'Password must be at least 6 characters.', users: safeUsers }
    if (password !== confirmPassword) return { ok: false, error: 'Passwords do not match.', users: safeUsers }
  }

  const updated = {
    ...current,
    name,
    email,
    ...(password ? { passwordHash: btoa(unescape(encodeURIComponent(password))) } : {}),
    updatedAt: new Date().toISOString(),
  }

  return {
    ok: true,
    user: updated,
    session: createSession(updated, new Date().toISOString()),
    users: safeUsers.map(user => user.id === userId ? updated : user),
  }
}

function validateRegistration(users, details) {
  const name = String(details.name || '').trim()
  const email = normalizeEmail(details.email)
  const password = String(details.password || '')
  const confirmPassword = String(details.confirmPassword || '')

  if (!name) return 'Enter your name.'
  if (!/^\S+@\S+\.\S+$/.test(email)) return 'Enter a valid email address.'
  if (password.length < 6) return 'Password must be at least 6 characters.'
  if (password !== confirmPassword) return 'Passwords do not match.'
  if (users.some(user => normalizeEmail(user.email) === email)) return 'An account with this email already exists.'
  return ''
}

export function registerUser(users, details) {
  const safeUsers = Array.isArray(users) ? users : []
  const error = validateRegistration(safeUsers, details)
  if (error) return { ok: false, error, users: safeUsers }

  const signedInAt = new Date().toISOString()
  const user = { ...createUser({ ...details, role: safeUsers.length === 0 ? 'admin' : 'user' }), lastLoginAt: signedInAt }
  return {
    ok: true,
    user,
    session: createSession(user, signedInAt),
    users: [...safeUsers, user],
  }
}

export function loginUser(users, details) {
  const email = normalizeEmail(details.email)
  const password = String(details.password || '')
  if (!email || !password) return { ok: false, error: 'Enter your email and password.' }

  const encodedPassword = btoa(unescape(encodeURIComponent(password)))
  const user = (Array.isArray(users) ? users : []).find(item => normalizeEmail(item.email) === email && item.passwordHash === encodedPassword)
  if (!user) return { ok: false, error: 'Email or password is incorrect.' }
  if (user.status === 'disabled') return { ok: false, error: 'This account is disabled. Contact an admin.' }

  const signedInAt = new Date().toISOString()
  return { ok: true, user: { ...user, lastLoginAt: signedInAt }, session: createSession(user, signedInAt), users: markUserLogin(users, user.id, signedInAt) }
}
