import assert from 'node:assert/strict'
import test from 'node:test'

import { createSession, createUser, loginUser, registerUser } from './authStorage.js'

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
  assert.equal(result.users.length, 1)
  assert.ok(result.user.id)
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
})

test('createSession excludes password from persisted session data', () => {
  const user = createUser({ name: 'Isaac', email: 'isaac@example.com', password: 'secret123' })
  const session = createSession(user)

  assert.equal(session.password, undefined)
  assert.equal(session.passwordHash, undefined)
  assert.equal(session.email, 'isaac@example.com')
})
