import { useAuth } from '../../context/AuthContext'
import { UsersTab } from '../Admin'

export default function AdminUsers() {
  const { user } = useAuth()
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-50">Users</h1>
        <p className="text-xs text-slate-400">Accounts, role assignment and access control</p>
      </div>
      <UsersTab me={user} />
    </div>
  )
}