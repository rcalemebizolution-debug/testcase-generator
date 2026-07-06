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

export function canManageUser(actor, targetUser) {
  return getUserRole(actor) === 'admin' && actor?.id !== targetUser?.id
}

export function setUserRole(users, actorId, targetUserId, role) {
  const safeUsers = Array.isArray(users) ? users : []
  const actor = safeUsers.find(user => user.id === actorId)
  const target = safeUsers.find(user => user.id === targetUserId)
  const nextRole = role === 'admin' ? 'admin' : 'user'

  if (!canManageUser(actor, target)) return { ok: false, error: 'Only an admin can update another user role.', users: safeUsers }
  if (!target) return { ok: false, error: 'User not found.', users: safeUsers }

  return {
    ok: true,
    users: safeUsers.map(user => user.id === targetUserId ? { ...user, role: nextRole } : user),
  }
}

export function setUserStatus(users, actorId, targetUserId, status) {
  const safeUsers = Array.isArray(users) ? users : []
  const actor = safeUsers.find(user => user.id === actorId)
  const target = safeUsers.find(user => user.id === targetUserId)
  const nextStatus = status === 'disabled' ? 'disabled' : 'active'

  if (!canManageUser(actor, target)) return { ok: false, error: 'Only an admin can update another user status.', users: safeUsers }
  if (!target) return { ok: false, error: 'User not found.', users: safeUsers }

  return {
    ok: true,
    users: safeUsers.map(user => user.id === targetUserId ? { ...user, status: nextStatus } : user),
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
