import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { Badge, Btn, Card, Field, SectionTitle, inputCls, useApi } from '../components/ui'

export default function Profile() {
  const { user } = useAuth()
  const settings = useApi<any>('/api/settings')
  const [language, setLanguage] = useState(user?.language || 'en')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    setMsg('')
    try {
      await api('/api/settings', { method: 'PATCH', body: JSON.stringify({ language }) })
      setMsg('Saved.')
      setTimeout(() => setMsg(''), 3000)
    } catch (e: any) {
      setMsg(e?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  const fields: [string, string | number | null | undefined][] = [
    ['Name', user?.name],
    ['Email', user?.email],
    ['Designation', user?.designation],
    ['Role', user?.role],
    ['Station', user?.station_name],
    ['Mission', user?.mission_id],
  ]

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-50">My Profile</h1>
        <p className="text-xs text-slate-400">Personal details, role identity and field assignment</p>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-4 border-b border-ink-700/50 bg-ink-800/40 px-5 py-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-ice-500 to-ink-700 text-lg font-black text-ink-950">
            {user?.name?.split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="text-lg font-bold text-slate-50">{user?.name}</div>
            <div className="text-sm text-slate-400">{user?.designation || user?.role}</div>
          </div>
        </div>
        <div className="grid gap-2.5 px-5 py-4 sm:grid-cols-2">
          {fields.map(([k, v]) => (
            <Field key={k} label={k}>
              <input className={inputCls} value={String(v ?? '') || '—'} disabled />
            </Field>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle title="Preferences" sub="interface language (Hindi labels apply across the app)" />
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-300">Language</label>
            <select
              className="w-full rounded-lg border border-ink-700 bg-ink-800/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-ice-500"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="en">English</option>
              <option value="hi">हिंदी / Hindi</option>
            </select>
          </div>
          <Btn onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save preferences'}</Btn>
        </div>
        {msg ? <p className="mt-2 text-sm text-ice-300">{msg}</p> : null}
        <div className="mt-3 text-xs text-slate-500">
          Account language syncs at your next sign-in. Role, mission and station are managed by the administrator.
        </div>
        {settings.data?.settings ? <div className="mt-2 text-xs text-slate-500">sync status: {String((settings.data.settings as any).sync_enabled ?? false)}</div> : null}
      </Card>

      <div className="flex flex-wrap gap-2">
        <Badge tone="ice">offline profile</Badge>
        <Badge tone="slate">field bundle</Badge>
        <Badge tone="slate">role: {user?.role}</Badge>
      </div>
    </div>
  )
}