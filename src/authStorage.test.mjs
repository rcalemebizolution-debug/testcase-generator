import assert from 'node:assert/strict'
import test from 'node:test'

import { createSession, createUser, isEffectiveAdmin, loginUser, markUserLogin, registerUser, setUserRole, setUserStatus } from './authStorage.js'

const emptyUsers = []

test('registerUser creates a local user and trims profile fields', () => {
  const result = registerUser(emptyUsers, {
    name: '  Isaac Admin  ',
    email: ' ISAAC@example.com ',
    password: 'secret123',
    confirmPassword: 'secret123',
  })

  assert.equal(result.ok, true)
  assert.equal(result.user.name, 'Isaac Admin')
  assert.equal(result.user.email, 'isaac@example.com')
  assert.equal(result.user.role, 'admin')
  assert.equal(result.user.status, 'active')
  assert.equal(result.users.length, 1)
  assert.ok(result.user.id)
  assert.ok(result.user.createdAt)
  assert.ok(result.user.lastLoginAt)
})

test('registerUser makes later users regular users', () => {
  const admin = createUser({ name: 'Admin', email: 'admin@example.com', password: 'secret123', role: 'admin' })
  const result = registerUser([admin], {
    name: 'Member',
    email: 'member@example.com',
    password: 'secret123',
    confirmPassword: 'secret123',
  })

  assert.equal(result.ok, true)
  assert.equal(result.user.role, 'user')
})

test('registerUser rejects duplicate emails', () => {
  const user = createUser({ name: 'Isaac', email: 'isaac@example.com', password: 'secret123' })
  const result = registerUser([user], {
    name: 'Other',
    email: 'ISAAC@example.com',
    password: 'secret123',
    confirmPassword: 'secret123',
  })

  assert.equal(result.ok, false)
  assert.equal(result.error, 'An account with this email already exists.')
})

test('loginUser returns a session for valid credentials only', () => {
  const user = createUser({ name: 'Isaac', email: 'isaac@example.com', password: 'secret123' })

  const bad = loginUser([user], { email: 'isaac@example.com', password: 'wrong' })
  assert.equal(bad.ok, false)

  const good = loginUser([user], { email: ' ISAAC@example.com ', password: 'secret123' })
  assert.equal(good.ok, true)
  assert.equal(good.session.email, 'isaac@example.com')
  assert.equal(good.session.name, 'Isaac')
  assert.equal(good.users[0].id, user.id)
  assert.ok(good.users[0].lastLoginAt)
})

test('markUserLogin updates only the matching user login timestamp', () => {
  const users = [{ id: 'user-1', name: 'One' }, { id: 'user-2', name: 'Two' }]
  const updated = markUserLogin(users, 'user-2', '2026-07-01T00:00:00.000Z')

  assert.equal(updated[0].lastLoginAt, undefined)
  assert.equal(updated[1].lastLoginAt, '2026-07-01T00:00:00.000Z')
})



test('admin can change another user role and status', () => {
  const users = [
    { id: 'admin-1', name: 'Admin', role: 'admin', status: 'active' },
    { id: 'user-1', name: 'Member', role: 'user', status: 'active' },
  ]

  const promoted = setUserRole(users, 'admin-1', 'user-1', 'admin')
  assert.equal(promoted.ok, true)
  assert.equal(promoted.users[1].role, 'admin')

  const disabled = setUserStatus(promoted.users, 'admin-1', 'user-1', 'disabled')
  assert.equal(disabled.ok, true)
  assert.equal(disabled.users[1].status, 'disabled')
})

test('regular users cannot change roles and disabled users cannot log in', () => {
  const users = [
    createUser({ name: 'Admin', email: 'admin@example.com', password: 'secret123', role: 'admin' }),
    { ...createUser({ name: 'Member', email: 'member@example.com', password: 'secret123' }), status: 'disabled' },
  ]

  const roleChange = setUserRole(users, users[1].id, users[0].id, 'user')
  assert.equal(roleChange.ok, false)

  const login = loginUser(users, { email: 'member@example.com', password: 'secret123' })
  assert.equal(login.ok, false)
  assert.equal(login.error, 'This account is disabled. Contact an admin.')
})



test('oldest legacy user is treated as effective admin even without an admin role', () => {
  const users = [
    { id: 'legacy-admin', name: 'Legacy', email: 'legacy@example.com', role: 'user', status: 'active', createdAt: '2026-07-01T00:00:00.000Z' },
    { id: 'member-1', name: 'Member', email: 'member@example.com', role: 'user', status: 'active', createdAt: '2026-07-02T00:00:00.000Z' },
  ]

  assert.equal(isEffectiveAdmin(users, 'legacy-admin'), true)
  const disabled = setUserStatus(users, 'legacy-admin', 'member-1', 'disabled')
  assert.equal(disabled.ok, true)
  assert.equal(disabled.users[1].status, 'disabled')
})

test('createSession excludes password from persisted session data', () => {
  const user = createUser({ name: 'Isaac', email: 'isaac@example.com', password: 'secret123' })
  const session = createSession(user)

  assert.equal(session.password, undefined)
  assert.equal(session.passwordHash, undefined)
  assert.equal(session.email, 'isaac@example.com')
})
