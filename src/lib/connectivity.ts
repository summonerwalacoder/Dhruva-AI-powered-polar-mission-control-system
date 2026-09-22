import { useEffect, useState } from 'react'
import { api, ApiError } from './api'
import { flushOutbox, isOnline, listOutbox, onNetworkChange, type OutboxItem } from './offline'

export type ConnMode = 'online' | 'weak' | 'offline' | 'syncing'

export interface ConnState {
  mode: ConnMode
  lastSync: string | null
  pending: number
}

const LS_KEY = 'dhruva_last_sync'

let state: ConnState = { mode: isOnline() ? 'online' : 'offline', lastSync: readTs(), pending: 0 }
const listeners = new Set<(s: ConnState) => void>()
let started = false

function readTs(): string | null {
  try {
    return localStorage.getItem(LS_KEY)
  } catch {
    return null
  }
}

function writeTs(iso: string) {
  try {
    localStorage.setItem(LS_KEY, iso)
  } catch {
    /* noop */
  }
}

function emit(next: ConnState) {
  state = next
  ;(window as unknown as { __SYNC_PENDING__?: number }).__SYNC_PENDING__ = next.pending
  listeners.forEach((l) => l(state))
}

export function subscribe(fn: (s: ConnState) => void) {
  listeners.add(fn)
  fn(state)
  return () => {
    listeners.delete(fn)
  }
}

function weakSignal(): boolean {
  const c = (navigator as any).connection
  if (!c) return false
  try {
    return c.effectiveType === 'slow-2g' || c.effectiveType === '2g'
  } catch {
    return false
  }
}

function baseMode(): ConnMode {
  if (!isOnline()) return 'offline'
  return weakSignal() ? 'weak' : 'online'
}

async function reflect() {
  const items = await listOutbox()
  emit({ ...state, mode: baseMode(), pending: items.length })
}

async function sendItem(it: OutboxItem): Promise<boolean> {
  try {
    const res: any = await api('/api/sync/push', {
      method: 'POST',
      useCache: false,
      body: JSON.stringify({
        items: [{ entity: it.entity, entity_id: it.entity_id, operation: it.operation, payload: it.payload, url: it.url }],
      }),
    })
    const errs: any[] = res?.errors || []
    return errs.length === 0
  } catch (e) {
    if (e instanceof ApiError && (e.status === 0 || e.status >= 500)) return false
    return true
  }
}

export async function syncNow(): Promise<void> {
  if (!isOnline()) {
    await reflect()
    return
  }
  const total = (await listOutbox()).length
  if (!total) {
    await reflect()
    return
  }
  emit({ ...state, mode: 'syncing' })
  const res = await flushOutbox(sendItem)
  if (res.ok > 0) writeTs(new Date().toISOString())
  await reflect()
}

function ensureStarted() {
  if (started) return
  started = true
  onNetworkChange((online) => {
    if (online) {
      emit({ ...state, mode: weakSignal() ? 'weak' : 'online' })
      syncNow()
    } else {
      emit({ ...state, mode: 'offline' })
    }
  })
  const conn = (navigator as any).connection
  try {
    conn?.addEventListener?.('change', () => {
      if (isOnline()) emit({ ...state, mode: weakSignal() ? 'weak' : 'online' })
    })
  } catch {
    /* noop */
  }
  window.setInterval(() => {
    if (isOnline()) syncNow()
  }, 60000)
  reflect()
  syncNow()
}

export function useConnectivity(): ConnState & { flush: () => Promise<void> } {
  ensureStarted()
  const [s, setS] = useState(state)
  useEffect(() => {
    const un = subscribe(setS)
    return un
  }, [])
  return { ...s, flush: syncNow }
}