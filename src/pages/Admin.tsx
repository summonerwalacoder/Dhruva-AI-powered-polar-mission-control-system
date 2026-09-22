import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { Badge, Btn, Card, Empty, Field, Icon, Modal, Spinner, cx, inputCls, useApi } from '../components/ui'
import type { User } from '../lib/types'

const ROLE_TONES: Record<string, string> = { admin: 'purple', commander: 'green', hq: 'ice', logistics: 'amber', scientist: 'red', medical: 'rose', field: 'slate' }

export default function Admin() {
  const { user: me } = useAuth()
  const [tab, setTab] = useState<'users' | 'audit' | 'config'>('users')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-50">Administration</h1>
          <p className="text-xs text-slate-400">Users, roles, audit trail and system configuration</p>
        </div>
        <div className="flex rounded-full bg-ink-800 p-1">
          {(['users', 'audit', 'config'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cx('rounded-full px-3 py-1 text-xs capitalize', tab === t ? 'bg-ice-500 text-ink-950' : 'text-slate-400 hover:text-slate-200')}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === 'users' ? <UsersTab me={me} /> : null}
      {tab === 'audit' ? <AuditTab /> : null}
      {tab === 'config' ? <ConfigTab /> : null}
    </div>
  )
}

export function UsersTab({ me }: { me: User | null }) {
  const { data, loading, error, reload } = useApi<User[]>('/api/users')
  const [draft, setDraft] = useState(false)

  const toggle = async (u: User) => {
    await api(`/api/users/${u.id}`, { method: 'PATCH', body: JSON.stringify({ active: !u.active }) })
    reload()
  }

  const remove = async (u: User) => {
    if (!window.confirm(`Delete ${u.name}?`)) return
    await api(`/api/users/${u.id}`, { method: 'DELETE' })
    reload()
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-ink-700/50 px-4 py-3">
        <span className="text-sm font-semibold text-slate-100">Users ({data?.length || 0})</span>
        <Btn kind="outline" onClick={() => setDraft(true)}><Icon name="plus" size={15} /> Invite user</Btn>
      </div>
      {loading ? <Spinner /> : null}
      {error ? <div className="p-4 text-sm text-rose-300">{error}</div> : null}
      {!loading && !error && !data?.length ? <Empty label="No users." /> : null}
      <div className="divide-y divide-ink-700/40">
        {(data || []).map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-700 text-sm font-bold text-ice-300">
              {u.name?.split(' ').map((s) => s[0]).join('').slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-100">{u.name}</span>
                {u.id === me?.id ? <Badge tone="ice">you</Badge> : null}
                {!u.active ? <Badge tone="slate">inactive</Badge> : null}
              </div>
              <div className="text-xs text-slate-500">{u.email} · {u.designation || '—'} {u.station_id ? `· station ${u.station_id}` : ''}</div>
            </div>
            <Badge tone={(ROLE_TONES[u.role] as any) || 'slate'}>{u.role}</Badge>
            <div className="flex gap-1.5">
              <Btn kind="ghost" onClick={() => toggle(u)}>{u.active ? 'Disable' : 'Enable'}</Btn>
              {u.id !== me?.id ? <Btn kind="ghost" className="text-rose-300 hover:bg-rose-500/10" onClick={() => remove(u)}>Delete</Btn> : null}
            </div>
          </div>
        ))}
      </div>
      {draft ? <CreateUser onClose={() => setDraft(false)} onCreated={() => reload()} /> : null}
    </Card>
  )
}

function CreateUser({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { data: stations } = useApi<any[]>('/api/stations')
  const { data: missions } = useApi<any[]>('/api/missions')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [f, setF] = useState({ name: '', email: '', password: 'Dhruva@2026', role: 'field', designation: '', phone: '', language: 'en', active: true, station_id: undefined as number | undefined, mission_id: undefined as number | undefined })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await api('/api/users', { method: 'POST', body: JSON.stringify(f) })
      onCreated()
      onClose()
    } catch (e: any) {
      setErr(e?.detail || e?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Invite user">
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="Full name"><input className={inputCls} required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Email"><input className={inputCls} type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Role">
          <select className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            <option>admin</option><option>commander</option><option>hq</option><option>logistics</option><option>scientist</option><option>medical</option><option>field</option>
          </select>
        </Field>
        <Field label="Designation"><input className={inputCls} value={f.designation} onChange={(e) => setF({ ...f, designation: e.target.value })} /></Field>
        <Field label="Password"><input className={inputCls} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <Field label="Language">
          <select className={inputCls} value={f.language} onChange={(e) => setF({ ...f, language: e.target.value })}>
            <option value="en">English</option><option value="hi">Hindi</option>
          </select>
        </Field>
        <Field label="Station">
          <select className={inputCls} value={f.station_id ?? ''} onChange={(e) => setF({ ...f, station_id: e.target.value ? Number(e.target.value) : undefined })}>
            <option value="">—</option>
            {(stations || []).map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}
          </select>
        </Field>
        <Field label="Mission">
          <select className={inputCls} value={f.mission_id ?? ''} onChange={(e) => setF({ ...f, mission_id: e.target.value ? Number(e.target.value) : undefined })}>
            <option value="">—</option>
            {(missions || []).map((m) => <option key={m.id} value={m.id}>{m.mission_id}</option>)}
          </select>
        </Field>
        {err ? <div className="rounded-lg bg-rose-500/15 p-2.5 text-sm text-rose-300 sm:col-span-2">{err}</div> : null}
        <div className="flex gap-2 sm:col-span-2">
          <Btn type="submit" disabled={busy} className="flex-1">{busy ? 'Creating…' : 'Create user'}</Btn>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </form>
    </Modal>
  )
}

export function AuditTab() {
  const [action, setAction] = useState('')
  const path = `/api/audit?action=${action}`
  const { data, loading } = useApi<any[]>(path)
  const stats = useApi<any>('/api/audit/stats')

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-700/50 px-4 py-3">
        <span className="text-sm font-semibold text-slate-100">Audit trail ({stats.data?.total || 0})</span>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(stats.data?.by_action || {}).slice(0, 8).map(([a, n]) => (
            <button key={a} onClick={() => setAction(action === a ? '' : a)} className={cx('rounded-full px-2.5 py-1 text-[11px]', action === a ? 'bg-ice-500 text-ink-950' : 'bg-ink-800 text-slate-300')}>
              {a} ×{String(n)}
            </button>
          ))}
        </div>
      </div>
      {loading ? <Spinner /> : null}
      {!loading && !data?.length ? <Empty label="No audit entries." /> : null}
      <div className="max-h-[560px] divide-y divide-ink-700/40 overflow-auto">
        {(data || []).map((a) => (
          <div key={a.id} className="px-4 py-2.5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="slate">{a.action}</Badge>
              <span className="font-medium text-slate-200">{a.entity} {a.entity_id}</span>
              <span className="ml-auto text-[11px] text-slate-500">{String(a.timestamp).slice(0, 19)}</span>
            </div>
            <div className="text-[11px] text-slate-500">by {a.user_email || 'system'}</div>
          </div>
        ))}
      </div>
    </Card>
  )
}

export function ConfigTab() {
  const { data, loading, error, reload } = useApi<any[]>('/api/config')
  const [vals, setVals] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState('')

  const save = async (key: string, value: string) => {
    setMsg('')
    try {
      await api(`/api/config/${key}`, { method: 'PUT', body: JSON.stringify({ value }) })
      setMsg(`Saved ${key}`)
      reload()
    } catch (e: any) {
      setMsg(e?.detail || e?.message || 'Failed')
    }
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-100">System configuration</span>
        {msg ? <span className="text-xs text-ice-300">{msg}</span> : null}
      </div>
      {loading ? <Spinner /> : null}
      {error ? <div className="text-sm text-rose-300">{error}</div> : null}
      <div className="space-y-2">
        {(data || []).map((c) => (
          <div key={c.key} className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-700/50 bg-ink-800/40 p-2.5">
            <code className="w-40 shrink-0 text-xs text-ice-300">{c.key}</code>
            <input
              className={inputCls + ' min-w-0 flex-1 font-mono text-xs'}
              defaultValue={c.value}
              value={vals[c.key] ?? c.value}
              onChange={(e) => setVals((v) => ({ ...v, [c.key]: e.target.value }))}
              placeholder="value"
            />
            <Btn kind="ghost" onClick={() => save(c.key, vals[c.key] ?? c.value)}>Save</Btn>
          </div>
        ))}
      </div>
    </Card>
  )
}