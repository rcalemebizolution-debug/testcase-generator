import { supabase, supabaseEnabled } from './supabaseClient.js'

function mapProfile(profile) {
  if (!profile) return null
  return {
    id: profile.id,
    name: profile.name || profile.email || 'User',
    email: profile.email || '',
    role: profile.role === 'admin' ? 'admin' : 'user',
    status: profile.status === 'disabled' ? 'disabled' : 'active',
    createdAt: profile.created_at || profile.createdAt || '',
    lastLoginAt: profile.last_login_at || profile.lastLoginAt || '',
    updatedAt: profile.updated_at || profile.updatedAt || '',
    backend: 'supabase',
  }
}

function toSession(user, profile) {
  if (!user || !profile) return null
  return {
    id: user.id,
    name: profile.name || user.user_metadata?.name || user.email || 'User',
    email: profile.email || user.email || '',
    signedInAt: new Date().toISOString(),
    backend: 'supabase',
  }
}

function validateProfileDetails(details = {}, { requirePassword = false } = {}) {
  const name = String(details.name || '').trim()
  const email = String(details.email || '').trim().toLowerCase()
  const password = String(details.password || '')
  const confirmPassword = String(details.confirmPassword || '')

  if (!name) return 'Enter your name.'
  if (!/^\S+@\S+\.\S+$/.test(email)) return 'Enter a valid email address.'
  if (requirePassword || password || confirmPassword) {
    if (password.length < 6) return 'Password must be at least 6 characters.'
    if (password !== confirmPassword) return 'Passwords do not match.'
  }
  return ''
}

export async function fetchSupabaseProfiles() {
  if (!supabaseEnabled) return []
  const { data, error } = await supabase
    .from('profiles')
    .select('id,name,email,role,status,created_at,last_login_at,updated_at')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data || []).map(mapProfile)
}

export async function fetchSupabaseProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,name,email,role,status,created_at,last_login_at,updated_at')
    .eq('id', userId)
    .single()
  if (error) throw error
  return mapProfile(data)
}

export async function loadSupabaseWorkspace() {
  if (!supabaseEnabled) return null
  const { data: { session: authSession }, error } = await supabase.auth.getSession()
  if (error) throw error
  if (!authSession?.user) return { users: [], session: null }

  const profile = await fetchSupabaseProfile(authSession.user.id)
  const users = profile?.role === 'admin' ? await fetchSupabaseProfiles() : [profile]
  return { users, session: toSession(authSession.user, profile) }
}

export async function registerSupabaseUser(details) {
  if (!supabaseEnabled) return { ok: false, error: 'Supabase is not configured.' }
  const validation = validateProfileDetails(details, { requirePassword: true })
  if (validation) return { ok: false, error: validation }

  const name = String(details.name).trim()
  const email = String(details.email).trim().toLowerCase()
  const password = String(details.password)
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  })
  if (error) return { ok: false, error: error.message }
  if (!data.session) {
    return { ok: false, error: 'Account created. Check your email to confirm, then log in.' }
  }
  const profile = await fetchSupabaseProfile(data.user.id)
  const users = profile.role === 'admin' ? await fetchSupabaseProfiles() : [profile]
  return { ok: true, user: profile, users, session: toSession(data.user, profile) }
}

export async function loginSupabaseUser(details) {
  if (!supabaseEnabled) return { ok: false, error: 'Supabase is not configured.' }
  const email = String(details.email || '').trim().toLowerCase()
  const password = String(details.password || '')
  if (!email || !password) return { ok: false, error: 'Enter your email and password.' }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { ok: false, error: error.message }
  const profile = await fetchSupabaseProfile(data.user.id)
  if (profile.status === 'disabled') {
    await supabase.auth.signOut()
    return { ok: false, error: 'This account is disabled. Contact an admin.' }
  }

  await supabase.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', data.user.id)
  const freshProfile = await fetchSupabaseProfile(data.user.id)
  const users = freshProfile.role === 'admin' ? await fetchSupabaseProfiles() : [freshProfile]
  return { ok: true, user: freshProfile, users, session: toSession(data.user, freshProfile) }
}

export async function logoutSupabaseUser() {
  if (!supabaseEnabled) return
  await supabase.auth.signOut()
}

export async function updateSupabaseProfile(userId, details) {
  if (!supabaseEnabled) return { ok: false, error: 'Supabase is not configured.' }
  const validation = validateProfileDetails(details)
  if (validation) return { ok: false, error: validation }

  const name = String(details.name).trim()
  const email = String(details.email).trim().toLowerCase()
  const password = String(details.password || '')

  const authChanges = { email, data: { name } }
  if (password) authChanges.password = password
  const { data, error } = await supabase.auth.updateUser(authChanges)
  if (error) return { ok: false, error: error.message }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ name, email, updated_at: new Date().toISOString() })
    .eq('id', userId)
  if (profileError) return { ok: false, error: profileError.message }

  const profile = await fetchSupabaseProfile(userId)
  const users = profile.role === 'admin' ? await fetchSupabaseProfiles() : [profile]
  return { ok: true, user: profile, users, session: toSession(data.user, profile) }
}

export async function setSupabaseUserRole(userId, role) {
  const nextRole = role === 'admin' ? 'admin' : 'user'
  const { error } = await supabase.from('profiles').update({ role: nextRole, updated_at: new Date().toISOString() }).eq('id', userId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, users: await fetchSupabaseProfiles() }
}

export async function setSupabaseUserStatus(userId, status) {
  const nextStatus = status === 'disabled' ? 'disabled' : 'active'
  const { error } = await supabase.from('profiles').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('id', userId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, users: await fetchSupabaseProfiles() }
}

export async function deleteSupabaseUser(userId) {
  // Client-side delete only removes the app profile. Deleting auth.users requires a server/Edge Function with service-role credentials.
  const { error } = await supabase.from('profiles').delete().eq('id', userId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, users: await fetchSupabaseProfiles() }
}
