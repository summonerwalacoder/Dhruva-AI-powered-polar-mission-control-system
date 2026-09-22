import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

interface DHRUVADB extends DBSchema {
  cache: { key: string; value: any; stamp: number }
  outbox: { key: string; value: OutboxItem; stamp: number }
}

export interface OutboxItem {
  key: string
  entity: string
  entity_id: string
  operation: string
  payload: any
  url: string
  created_at: string
}

let dbPromise: Promise<IDBPDatabase<DHRUVADB>> | null = null

function db() {
  if (!dbPromise) {
    dbPromise = openDB<DHRUVADB>('dhruva', 1, {
      upgrade(d) {
        d.createObjectStore('cache', { keyPath: 'key' })
        d.createObjectStore('outbox', { keyPath: 'key' })
      },
    })
  }
  return dbPromise
}

export async function offlineGet(key: string, value: any): Promise<any> {
  try {
    const d = await db()
    await d.put('cache', { key, value, stamp: Date.now() })
    return value
  } catch {
    return value
  }
}

export async function getCachedValue<T = any>(key: string): Promise<T | null> {
  try {
    const d = await db()
    const row = await d.get('cache', key)
    return row ? (row.value as T) : null
  } catch {
    return null
  }
}

export async function enqueueOffline(item: Omit<OutboxItem, 'created_at' | 'key'>): Promise<string> {
  const key = `${item.entity}:${item.entity_id}:${Date.now()}`
  const d = await db()
  await d.put('outbox', { key, ...item, created_at: new Date().toISOString() })
  return key
}

export async function listOutbox(): Promise<OutboxItem[]> {
  try {
    const d = await db()
    const all = await d.getAll('outbox')
    return all.sort((a, b) => a.created_at.localeCompare(b.created_at))
  } catch {
    return []
  }
}

export async function removeOutbox(key: string) {
  try {
    const d = await db()
    await d.delete('outbox', key)
  } catch {
    /* noop */
  }
}

export async function flushOutbox(send: (item: OutboxItem) => Promise<boolean>): Promise<{ ok: number; failed: OutboxItem[] }> {
  const items = await listOutbox()
  let ok = 0
  const failed: OutboxItem[] = []
  for (const it of items) {
    try {
      const sent = await send(it)
      if (sent) {
        await removeOutbox(it.key)
        ok++
      } else failed.push(it)
    } catch {
      failed.push(it)
    }
  }
  return { ok, failed }
}

export const online = () => navigator.onLine
export const isOnline = () => navigator.onLine !== false

export function onNetworkChange(fn: (online: boolean) => void) {
  const h = () => fn(isOnline())
  window.addEventListener('online', h)
  window.addEventListener('offline', h)
  return () => {
    window.removeEventListener('online', h)
    window.removeEventListener('offline', h)
  }
}