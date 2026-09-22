import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { listOutbox, flushOutbox, type OutboxItem } from '../lib/offline'
import { Badge, Btn, Card, SectionTitle, Spinner, inputCls, useApi } from '../components/ui'

export default function Settings() {
  const { user } = useAuth()
  const { data, loading, error } = useApi<any>('/api/settings')
  const [prefs, setPrefs] = useState<Record<string, boolean>>({})
  const [lang, setLang] = useState('en')
  const [saved, setSaved] = useState('')
  const [outbox, setOutbox] = useState<OutboxItem[]>([])
  const [flushing, setFlushing] = useState(false)
  const [onlineNow] = useState(navigator.onLine)

  useEffect(() => {
    if (data?.settings) {
      setPrefs(data.settings)
      setLang(data.settings.language || 'en')
    }
  }, [data])

  const refreshOutbox = () => listOutbox().then(setOutbox)
  useEffect(() => { refreshOutbox(); const t = setInterval(refreshOutbox, 4000); return () => clearInterval(t) }, [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    await api('/api/settings', { method: 'PATCH', body: JSON.stringify({ ...prefs, language: lang }) })
    setSaved('Saved — preferences updated')
  }

  const flush = async () => {
    setFlushing(true)
    const res = await flushOutbox(async (item) => {
      try {
        if (item.operation === 'delete') {
          await api(item.url, { method: 'DELETE' })
        } else {
          await api(item.url, { method: item.operation === 'create' ? 'POST' : 'PATCH', body: JSON.stringify(item.payload) })
        }
        return true
      } catch { return false }
    })
    setFlushing(false)
    if (res.ok) setSaved(`Pushed ${res.ok} queued item(s) to server`)
    else setSaved(`${res.ok} pushed, ${res.failed.length} still pending`)
    refreshOutbox()
  }

  if (loading) return <Spinner label="Loading settings…" />
  if (error) return <div className="rounded-lg bg-rose-500/15 p-3 text-sm text-rose-300">{error}</div>

  const boolKeys = Object.keys(prefs).filter((k) => k !== 'language' && k !== 'id')

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-50">Settings</h1>
        <p className="text-xs text-slate-400">Preferences, notification and offline sync status</p>
      </div>

      {saved ? <div className="fade-up rounded-lg bg-emerald-500/15 p-2.5 text-sm text-emerald-200">{saved}</div> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle title="Profile" />
          <div className="space-y-2 text-sm">
            <Row k="Name" v={user?.name || '—'} />
            <Row k="Email" v={user?.email || '—'} />
            <Row k="Role" v={<Badge tone="ice">{user?.role || '—'}</Badge>} />
            <Row k="Designation" v={user?.designation || '—'} />
          </div>

          <form onSubmit={save} className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Assistant language</label>
              <select className={inputCls} value={lang} onChange={(e) => setLang(e.target.value)}>
                <option value="en">English</option>
                <option value="hi">हिन्दी (Hindi)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <div className="text-xs text-slate-400">Notification preferences</div>
              {boolKeys.map((k) => (
                <label key={k} className="flex cursor-pointer items-center justify-between rounded-lg bg-ink-800/50 px-3 py-2 text-sm text-slate-200">
                  <span className="capitalize">{k.replaceAll('_', ' ')}</span>
                  <input type="checkbox" checked={!!prefs[k]} onChange={(e) => setPrefs({ ...prefs, [k]: e.target.checked })} className="h-4 w-4 accent-[#2fa3b8]" />
                </label>
              ))}
            </div>
            <Btn type="submit" disabled={loading}>Save preferences</Btn>
          </form>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <SectionTitle title="Offline sync" />
              <Badge tone={onlineNow ? 'green' : 'amber'}>{onlineNow ? 'online' : 'offline'}</Badge>
            </div>
            <p className="text-xs text-slate-400">Writes made while offline are queued locally and pushed to the server when connectivity returns.</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="text-3xl font-bold tabular-nums text-slate-100">{outbox.length}</div>
              <span className="text-sm text-slate-400">queued item(s)</span>
              <Btn kind="outline" onClick={flush} disabled={flushing || !outbox.length} className="ml-auto">
                {flushing ? 'Pushing…' : 'Push now'}
              </Btn>
            </div>
            {outbox.length ? (
              <div className="mt-3 max-h-44 space-y-1 overflow-auto">
                {outbox.map((o) => (
                  <div key={o.key} className="rounded bg-ink-800/60 px-2.5 py-1.5 text-xs text-slate-400">
                    <b className="text-slate-300">{o.entity}</b> {o.operation} · {o.url}
                    <div className="text-[10px] text-slate-600">{o.created_at}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </Card>

          <Card className="p-4">
            <SectionTitle title="Data & privacy" />
            <div className="space-y-2 text-sm text-slate-300">
              <p>• Medical notes are masked from non-medical roles.</p>
              <p>• All changes are written to the server audit trail.</p>
              <p>• Cached data is stored locally in IndexedDB and expires automatically.</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded bg-ink-800/50 px-3 py-2">
      <span className="text-slate-400">{k}</span>
      <span className="font-medium text-slate-100">{v}</span>
    </div>
  )
}