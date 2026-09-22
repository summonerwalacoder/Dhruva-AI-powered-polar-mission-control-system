import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useMission } from '../context/MissionContext'
import { api } from '../lib/api'
import { Badge, Btn, Card, Empty, ErrorBox, Field, Icon, Modal, Spinner, cx, inputCls, statusTone, useApi } from '../components/ui'
import type { Personnel } from '../lib/types'
import { ROLE_NAMES } from '../lib/perms'

export default function Personnel() {
  const { can } = useAuth()
  const { selectedId } = useMission()
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const [mv, setMv] = useState('')
  const [detail, setDetail] = useState<Personnel | null>(null)
  const [create, setCreate] = useState(false)

  const path = `/api/personnel?mission_id=${selectedId || ''}&role=${role}&movement_status=${mv}&q=${encodeURIComponent(q)}`
  const { data, loading, error, reload } = useApi<Personnel[]>(path)

  const viewMedical = can('medical:read')
  const write = can('personnel:write')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-50">Personnel</h1>
          <p className="text-xs text-slate-400">Crew, roles and field movement status</p>
        </div>
        {write ? (
          <Btn onClick={() => setCreate(true)}><Icon name="plus" size={16} /> Add member</Btn>
        ) : null}
      </div>

      <Card className="flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-40 flex-1">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500">
            <Icon name="search" size={14} />
          </span>
          <input
            className={inputCls + ' pl-8'}
            placeholder="Search name / ID…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className={inputCls + ' w-36'} value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">All roles</option>
          {Object.entries(ROLE_NAMES).map(([code, name]) => (
            <option key={code} value={code}>{name}</option>
          ))}
        </select>
        <select className={inputCls + ' w-40'} value={mv} onChange={(e) => setMv(e.target.value)}>
          <option value="">All movement</option>
          <option>station</option>
          <option>field_camp</option>
          <option>transit</option>
          <option>return</option>
        </select>
      </Card>

      {loading ? <Spinner /> : null}
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      {!loading && !error && data?.length === 0 ? <Empty label="No personnel found." /> : null}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {(data || []).map((p) => (
          <Card key={p.id} className="p-3.5">
            <button className="w-full text-left" onClick={() => setDetail(p)}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-100">{p.name}</div>
                  <div className="text-[11px] text-slate-400">
                    {p.personnel_id} · {ROLE_NAMES[p.role] || p.role}
                  </div>
                </div>
                <Badge tone={statusTone(p.movement_status)}>{p.movement_status.replace('_', ' ')}</Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-slate-400">
                <span className="rounded bg-ink-800 px-1.5 py-0.5">📍 {p.current_location || '—'}</span>
                {p.health_status ? (
                  <span className={cx('rounded px-1.5 py-0.5', p.health_status === 'fit' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300')}>
                    {p.health_status}
                  </span>
                ) : null}
                {p.team ? <span className="rounded bg-ink-800 px-1.5 py-0.5">{p.team}</span> : null}
              </div>
              {viewMedical && p.medical_notes ? (
                <div className="mt-2 rounded bg-ink-800/70 px-2 py-1.5 text-[11px] text-slate-400">⚕ {p.medical_notes}</div>
              ) : null}
            </button>
          </Card>
        ))}
      </div>

      {detail ? (
        <PersonnelDetail
          p={detail}
          viewMedical={viewMedical}
          write={write}
          onClose={() => setDetail(null)}
          onUpdated={() => reload()}
        />
      ) : null}
      {create ? (
        <CreatePersonnel onClose={() => setCreate(false)} onCreated={() => reload()} />
      ) : null}
    </div>
  )
}

function PersonnelDetail({ p, viewMedical, write, onClose, onUpdated }: { p: Personnel; viewMedical: boolean; write: boolean; onClose: () => void; onUpdated: () => void }) {
  const detail = useApi<Personnel>(`/api/personnel/${p.id}`)
  const [mv, setMv] = useState('')
  const [loc, setLoc] = useState('')
  const [busy, setBusy] = useState(false)
  const per = detail.data || p

  const advance = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mv) return
    setBusy(true)
    try {
      await api(`/api/personnel/${p.id}/movement`, {
        method: 'POST',
        body: JSON.stringify({ to_status: mv, location: loc || undefined }),
      })
      onUpdated()
      detail.reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`${per.name} — ${per.personnel_id}`}>
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2 text-slate-300">
          <InfoRow k="Role" v={ROLE_NAMES[per.role] || per.role} />
          <InfoRow k="Status" v={per.status || '—'} />
          <InfoRow k="Movement" v={per.movement_status || '—'} />
          <InfoRow k="Location" v={per.current_location || '—'} />
          <InfoRow k="Health" v={per.health_status || '—'} />
          <InfoRow k="Contact" v={per.contact || '—'} />
        </div>
        {viewMedical ? (
          <div className="rounded-lg bg-ink-800/70 p-2.5 text-slate-300">
            <span className="text-[11px] uppercase tracking-wide text-slate-500">Medical notes</span>
            <div>{per.medical_notes || '—'}</div>
          </div>
        ) : null}

        {(per as any).movements?.length ? (
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">Movement history</div>
            <div className="max-h-32 space-y-1 overflow-y-auto">
              {(per as any).movements.map((m: any, i: number) => (
                <div key={i} className="rounded bg-ink-800/50 px-2 py-1 text-xs text-slate-400">
                  {m.from_status || '—'} → <b className="text-slate-200">{m.to_status}</b> · {m.location} · {m.note ? m.note : ''} · {m.timestamp?.slice(0, 10)}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {write ? (
          <form onSubmit={advance} className="grid grid-cols-2 gap-2 border-t border-ink-700/60 pt-3">
            <select className={inputCls} value={mv} onChange={(e) => setMv(e.target.value)}>
              <option value="">Update status…</option>
              <option>departure</option>
              <option>transit</option>
              <option>station</option>
              <option>field_camp</option>
              <option>return</option>
            </select>
            <input className={inputCls} placeholder="Location" value={loc} onChange={(e) => setLoc(e.target.value)} />
            <Btn type="submit" disabled={busy || !mv} className="col-span-2">
              {busy ? 'Updating…' : 'Record movement'}
            </Btn>
          </form>
        ) : null}
      </div>
    </Modal>
  )
}

function InfoRow({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{k}</div>
      <div className="truncate">{v}</div>
    </div>
  )
}

function CreatePersonnel({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { selectedId } = useMission()
  const mission = useApi<any[]>('/api/missions')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [f, setF] = useState({
    personnel_id: '',
    name: '',
    role: 'scientist' as string,
    team: '',
    mission_id: selectedId || (undefined as number | undefined),
    current_location: '',
    movement_status: 'station',
    health_status: 'fit',
    contact: '--',
    medical_notes: '',
    assignment: '',
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await api('/api/personnel', { method: 'POST', body: JSON.stringify(f) })
      onCreated()
      onClose()
    } catch (e: any) {
      setErr(e?.detail || e?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Add personnel" wide>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="Personnel ID">
          <input className={inputCls} required value={f.personnel_id} onChange={(e) => setF({ ...f, personnel_id: e.target.value.toUpperCase() })} />
        </Field>
        <Field label="Full name">
          <input className={inputCls} required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Role">
          <select className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            {Object.entries(ROLE_NAMES).map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
        </Field>
        <Field label="Team">
          <input className={inputCls} value={f.team} onChange={(e) => setF({ ...f, team: e.target.value })} />
        </Field>
        <Field label="Mission">
          <select className={inputCls} value={f.mission_id || ''} onChange={(e) => setF({ ...f, mission_id: Number(e.target.value) || undefined })}>
            <option value="">— none —</option>
            {mission.data?.map((m) => (
              <option key={m.id} value={m.id}>{m.mission_id} · {m.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Current location">
          <input className={inputCls} value={f.current_location} onChange={(e) => setF({ ...f, current_location: e.target.value })} />
        </Field>
        <Field label="Assignment">
          <input className={inputCls} value={f.assignment} onChange={(e) => setF({ ...f, assignment: e.target.value })} />
        </Field>
        <Field label="Medical notes" hint="Only seen by roles with medical read access">
          <input className={inputCls} value={f.medical_notes} onChange={(e) => setF({ ...f, medical_notes: e.target.value })} />
        </Field>
        {err ? <div className="rounded-lg bg-rose-500/15 p-2.5 text-sm text-rose-300 sm:col-span-2">{err}</div> : null}
        <div className="flex gap-2 sm:col-span-2">
          <Btn type="submit" disabled={busy} className="flex-1">{busy ? 'Saving…' : 'Add member'}</Btn>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </form>
    </Modal>
  )
}