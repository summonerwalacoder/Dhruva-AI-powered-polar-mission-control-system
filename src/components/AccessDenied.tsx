import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { roleDashboardPath, roleConfig } from '../lib/roleConfig'
import { Btn, Icon } from './ui'

export default function AccessDenied() {
  const { user } = useAuth()
  const nav = useNavigate()
  const home = roleDashboardPath(user?.role)
  const cfg = roleConfig(user?.role)

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/15">
        <Icon name="shield" size={30} className="text-rose-400" />
      </div>
      <h1 className="text-xl font-bold text-slate-50">403 — Access Denied</h1>
      <p className="mt-2 text-sm text-slate-400">
        This module is not available for the <b className="text-slate-200">{cfg?.label || user?.role}</b>{' '}
        interface. Role-scoped access is enforced on both routing and backend APIs.
      </p>
      <div className="mt-5 flex justify-center gap-2">
        <Btn onClick={() => nav(home)}>
          <Icon name="dashboard" size={15} /> Return to my dashboard
        </Btn>
        <Btn kind="ghost" onClick={() => nav('/login')}>Sign out</Btn>
      </div>
    </div>
  )
}