import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, fmtNum } from '../../lib/api'
import { Badge, Btn, Card, Field, Icon, Modal, SectionTitle, Spinner, Stat, inputCls, statusTone, useApi } from '../../components/ui'

export default function MedicalDashboard() {
  const personnel = useApi<any[]>('/api/personnel?')
  const inventory = useApi<any[]>('/api/inventory?')
  const emergencies = useApi<any[]>('/api/emergencies?status=open')
  const alerts = useApi<any[]>('/api/alerts?status=active')
  const [caseFor, setCaseFor] = useState<any | null>(null)
  const [note, setNote] = useState('')
  const [health, setHealth] = useState('fit')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState('')

  const people = personnel.data || []
  const notFit = people.filter((p) => (p.health_status || 'fit') !== 'fit')
  const medSupplies = (inventory.data || []).filter((i) => i.category === 'medical')
  const medLow = medSupplies.filter((i) => i.is_low || (i.min_stock != null && Number(i.quantity) <= Number(i.min_stock)))
  const open = emergencies.data || []

  const submitCase = async () => {
    if (!caseFor) return
    setBusy(true)
    try {
      await api(`/api/personnel/${caseFor.id}`, { method: 'PATCH', body: JSON.stringify({ health_status: health, medical_notes: note }) })
      setDone(`Case logged for ${caseFor.name}`)
      setCaseFor(null)
      setNote('')
      setHealth('fit')
      personnel.reload()
      setTimeout(() => setDone(''), 4000)
    } catch (e: any) {
      setDone(`Failed: ${e?.message || e}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-50">Medical & Emergency Center</h1>
          <p className="text-sm text-slate-400">Crew health, sick-bay inventory and clinical response posture</p>
        </div>
        {done ? <Badge tone={done.startsWith('Failed') ? 'red' : 'green'}>{done}</Badge> : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Personnel on station" value={fmtNum(people.length)} sub="in current scope" tone="ice" />
        <Stat label="Not fit / attention" value={fmtNum(notFit.length)} sub="require clinical review" tone={notFit.length ? 'warn' : 'good'} />
        <Stat label="Open emergencies" value={fmtNum(open.length)} sub="active incidents" tone={open.length ? 'warn' : 'good'} />
        <Stat label="Medical SKUs low" value={fmtNum(medLow.length)} sub={`${medSupplies.length} tracked`} tone={medLow.length ? 'bad' : 'good'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Personnel requiring attention */}
        <Card className="p-4">
          <SectionTitle title="Crew health watchlist" sub="personnel not marked fit" right={<Link to="/personnel" className="text-xs text-ice-300">full roster</Link>} />
          {personnel.loading ? <Spinner /> : null}
          {!personnel.loading && !notFit.length ? <p className="text-sm text-slate-400">Every crew member is currently fit.</p> : null}
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {notFit.slice(0, 10).map((p) => (
              <div key={p.id} className="flex items-start gap-2 rounded-lg bg-ink-800/50 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-slate-100">{p.name}</span>
                    <Badge tone={statusTone(p.health_status)}>{p.health_status}</Badge>
                  </div>
                  <div className="truncate text-xs text-slate-500">{p.personnel_id} · {p.role} · {p.station_code || '—'}</div>
                  {p.medical_notes ? <div className="mt-1 rounded bg-ink-900/60 px-2 py-1 text-xs text-slate-400">{p.medical_notes}</div> : null}
                </div>
                <Btn kind="ghost" className="!px-2.5 !py-1.5 text-xs" onClick={() => { setCaseFor(p); setNote(p.medical_notes || ''); setHealth(p.health_status || 'fit') }}>
                  <Icon name="clip" size={14} /> Log case
                </Btn>
              </div>
            ))}
          </div>
          {!notFit.length ? (
            <Btn kind="ghost" className="mt-3 w-full" onClick={() => { setCaseFor(people[0] || null) }}>
              <Icon name="plus" size={15} /> Record medical case
            </Btn>
          ) : null}
        </Card>

        {/* Medical inventory */}
        <Card className="p-4">
          <SectionTitle title="Sick-bay inventory" sub="medical category stock levels" right={<Link to="/medical/inventory" className="text-xs text-ice-300">inventory</Link>} />
          {inventory.loading ? <Spinner /> : null}
          {!inventory.loading && !medSupplies.length ? <p className="text-sm text-slate-400">No medical inventory recorded.</p> : null}
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {medSupplies.slice(0, 12).map((i) => (
              <div key={i.id} className="flex items-center justify-between rounded-lg bg-ink-800/50 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate text-slate-200">{i.item}</div>
                  <div className="text-xs text-slate-500">{Number(i.quantity)} {i.unit} · {i.location || 'sick bay'}</div>
                </div>
                <Badge tone={i.is_low || (i.min_stock != null && Number(i.quantity) <= Number(i.min_stock)) ? 'amber' : 'green'}>
                  {i.is_low || (i.min_stock != null && Number(i.quantity) <= Number(i.min_stock)) ? 'low' : 'ok'}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Emergencies */}
        <Card className="p-4">
          <SectionTitle title="Live emergencies" sub="medical and general incidents" right={<Link to="/emergency" className="text-xs text-ice-300">respond</Link>} />
          {!open.length ? <p className="text-sm text-slate-400">No live incidents.</p> : null}
          <div className="max-h-56 space-y-2 overflow-y-auto">
            {open.slice(0, 8).map((e) => (
              <div key={e.id} className="flex items-start gap-2 rounded-lg bg-ink-800/50 px-2.5 py-2 text-sm">
                <Badge tone={statusTone(e.severity)}>{e.severity}</Badge>
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-200">{e.type} · {e.emergency_id}</div>
                  <div className="truncate text-xs text-slate-400">{e.location || '—'}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-4">
          <SectionTitle title="Clinical alerts" sub="system notices" right={<Link to="/alerts" className="text-xs text-ice-300">all alerts</Link>} />
          {!alerts.data?.length ? <p className="text-sm text-slate-400">No active alerts.</p> : null}
          <div className="max-h-56 space-y-2 overflow-y-auto">
            {(alerts.data || []).slice(0, 8).map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-lg bg-ink-800/50 px-2.5 py-2 text-sm">
                <Badge tone={statusTone(a.severity)}>{a.severity}</Badge>
                <span className="truncate text-slate-300">{a.title}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <QuickAction to="/personnel" icon="personnel" label="Personnel records" />
        <QuickAction to="/medical/cases" icon="heart" label="Medical cases" />
        <QuickAction to="/medical/inventory" icon="clip" label="Medical inventory" />
        <QuickAction to="/map" icon="map" label="Emergency map" />
        <QuickAction to="/alerts" icon="alert" label="Alerts" />
        <QuickAction to="/assistant" icon="ai" label="AI emergency assistant" />
        <QuickAction to="/inventory" icon="inventory" label="All inventory" />
        <QuickAction to="/emergency" icon="sos" label="Report emergency" />
      </div>

      <Modal open={!!caseFor} onClose={() => setCaseFor(null)} title={caseFor ? `Medical case — ${caseFor.name}` : ''}>
        <div className="space-y-3">
          <Field label="Health status">
            <select className={inputCls} value={health} onChange={(e) => setHealth(e.target.value)}>
              {['fit', 'recovering', 'sick', 'injured', 'critical'].map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </Field>
          <Field label="Clinical notes">
            <textarea className={inputCls} rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Assessment, vitals, treatment plan… (visible only to authorized roles)" />
          </Field>
          <div className="flex justify-end gap-2">
            <Btn kind="ghost" onClick={() => setCaseFor(null)}>Cancel</Btn>
            <Btn onClick={submitCase} disabled={busy}>{busy ? 'Saving…' : 'Save case'}</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function QuickAction({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-2 rounded-xl border border-ink-700/60 bg-ink-800/50 px-3 py-3 text-sm text-slate-200 transition-colors hover:border-ice-500 hover:text-ice-200">
      <Icon name={icon} size={17} />
      <span className="truncate">{label}</span>
    </Link>
  )
}