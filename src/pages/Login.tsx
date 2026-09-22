import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Btn, Field, inputCls } from '../components/ui'
import type { User } from '../lib/types'
import { roleDashboardPath } from '../lib/roleConfig'

const DEMO_USERS = [
  { role: 'Administrator', email: 'admin@dhruva.gov.in', userName: 'Admin – full access' },
  { role: 'Commander', email: 'commander@dhruva.gov.in', userName: 'Expedition Commander' },
  { role: 'HQ', email: 'hq@dhruva.gov.in', userName: 'HQ / Government Official' },
  { role: 'Logistics', email: 'logistics@dhruva.gov.in', userName: 'Logistics Officer' },
  { role: 'Scientist', email: 'scientist@dhruva.gov.in', userName: 'Scientist / Researcher' },
  { role: 'Medical', email: 'medical@dhruva.gov.in', userName: 'Medical Officer' },
  { role: 'Field', email: 'field@dhruva.gov.in', userName: 'Field Operator' },
]

export default function Login() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('commander@dhruva.gov.in')
  const [password, setPassword] = useState('Dhruva@2026')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      const u: User = await login(email, password)
      nav(roleDashboardPath(u.role), { replace: true })
    } catch (e: any) {
      setErr(e?.detail || e?.message || 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-ice-400 to-ice-600 shadow-lg">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" className="text-ink-950">
            <path d="M12 2 8 20c2 1.5 4 1.5 6 0L12 2z" />
            <circle cx="12" cy="12" r="2" fill="#060d16" />
          </svg>
        </div>
        <h1 className="mt-3 text-2xl font-black tracking-widest text-slate-50">
          DH<span className="text-ice-300">RUVA</span>
        </h1>
        <p className="mt-1 text-xs uppercase tracking-widest text-slate-400">AI-Powered Polar Mission Control</p>
      </div>

      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-ink-700/60 bg-ink-900/70 p-6 backdrop-blur">
        <Field label="Email">
          <input type="email" required className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <input type="password" required className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {err ? <div className="rounded-lg bg-rose-500/15 p-2.5 text-sm text-rose-300">{err}</div> : null}
        <Btn type="submit" disabled={busy} className="w-full">
          {busy ? 'Signing in…' : 'Sign in'}
        </Btn>
        <div className="text-center text-[11px] text-slate-500">Demo password for all roles: Dhruva@2026</div>
      </form>

      <div className="mt-5 grid w-full max-w-sm grid-cols-2 gap-2">
        {DEMO_USERS.map((u) => (
          <button
            key={u.email}
            onClick={() => {
              setEmail(u.email)
              setPassword('Dhruva@2026')
            }}
            className="rounded-lg border border-ink-700/60 bg-ink-900/50 px-2 py-2 text-left text-xs text-slate-300 transition-colors hover:border-ice-500 hover:text-ice-200"
          >
            <div className="font-semibold">{u.role}</div>
            <div className="truncate text-slate-500">{u.userName}</div>
          </button>
        ))}
      </div>
    </div>
  )
}