export const DB_NAME = 'casecraft-db'
export const DB_VERSION = 2
export const STORE_NAMES = ['users', 'session', 'suites', 'draft']
export const LOCAL_KEYS = {
  users: 'casecraft-users',
  session: 'casecraft-session',
  suites: 'casecraft-suites',
  draft: 'casecraft-form',
}

const SINGLETON_ID = 'current'

export function createSessionRecord(session) {
  return session ? { ...session, id: SINGLETON_ID, userId: session.id } : null
}

export function createDraftRecord(form) {
  return { id: SINGLETON_ID, form }
}

export function stripRecordId(record) {
  if (!record) return null
  const { id, ...rest } = record
  return rest
}

function hasIndexedDb() {
  return typeof indexedDB !== 'undefined'
}

function readLocalJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null')
    return value ?? fallback
  } catch {
    return fallback
  }
}

function writeLocalJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function openCasecraftDb() {
  if (!hasIndexedDb()) return Promise.reject(new Error('IndexedDB is not available.'))

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      for (const storeName of STORE_NAMES) {
        if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function withStore(storeName, mode, operation) {
  return openCasecraftDb().then(db => new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode)
    const store = transaction.objectStore(storeName)
    const request = operation(store)

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => db.close()
    transaction.onerror = () => {
      db.close()
      reject(transaction.error)
    }
  }))
}

export function getAllRecords(storeName) {
  return withStore(storeName, 'readonly', store => store.getAll())
}

export function getRecord(storeName, id) {
  return withStore(storeName, 'readonly', store => store.get(id))
}

export function putRecord(storeName, record) {
  return withStore(storeName, 'readwrite', store => store.put(record))
}

export function deleteRecord(storeName, id) {
  return withStore(storeName, 'readwrite', store => store.delete(id))
}

export function clearStore(storeName) {
  return withStore(storeName, 'readwrite', store => store.clear())
}

async function loadFromIndexedDb() {
  const [users, suites, sessionRecord, draftRecord] = await Promise.all([
    getAllRecords('users'),
    getAllRecords('suites'),
    getRecord('session', SINGLETON_ID),
    getRecord('draft', SINGLETON_ID),
  ])

  return {
    users,
    suites,
    session: sessionRecord ? stripRecordId(sessionRecord) : null,
    draft: draftRecord?.form || null,
  }
}

function loadFromLocalStorage() {
  return {
    users: readLocalJson(LOCAL_KEYS.users, []),
    suites: readLocalJson(LOCAL_KEYS.suites, []),
    session: readLocalJson(LOCAL_KEYS.session, null),
    draft: readLocalJson(LOCAL_KEYS.draft, null),
  }
}

export async function migrateLocalStorageToDatabase() {
  if (!hasIndexedDb()) return loadFromLocalStorage()

  const localData = loadFromLocalStorage()
  const current = await loadFromIndexedDb()

  if (!current.users.length && localData.users.length) {
    await Promise.all(localData.users.map(user => putRecord('users', user)))
  }
  if (!current.suites.length && localData.suites.length) {
    await Promise.all(localData.suites.map(suite => putRecord('suites', suite)))
  }
  if (!current.session && localData.session) await putRecord('session', createSessionRecord(localData.session))
  if (!current.draft && localData.draft) await putRecord('draft', createDraftRecord(localData.draft))

  return loadFromIndexedDb()
}

export async function loadAppData() {
  if (!hasIndexedDb()) return loadFromLocalStorage()
  return migrateLocalStorageToDatabase()
}

export async function saveUsersToDatabase(users) {
  if (!hasIndexedDb()) return writeLocalJson(LOCAL_KEYS.users, users)
  await clearStore('users')
  await Promise.all((users || []).map(user => putRecord('users', user)))
}

export async function saveSuitesToDatabase(suites) {
  if (!hasIndexedDb()) return writeLocalJson(LOCAL_KEYS.suites, suites)
  await clearStore('suites')
  await Promise.all((suites || []).map(suite => putRecord('suites', suite)))
}

export async function saveDraftToDatabase(form) {
  if (!hasIndexedDb()) return writeLocalJson(LOCAL_KEYS.draft, form)
  await putRecord('draft', createDraftRecord(form))
}

export async function saveSessionToDatabase(session) {
  if (!hasIndexedDb()) {
    if (session) writeLocalJson(LOCAL_KEYS.session, session)
    else localStorage.removeItem(LOCAL_KEYS.session)
    return
  }
  if (session) await putRecord('session', createSessionRecord(session))
  else await deleteRecord('session', SINGLETON_ID)
}
