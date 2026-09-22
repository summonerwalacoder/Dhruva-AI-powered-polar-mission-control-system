import { AuditTab } from '../Admin'

export default function AdminAudit() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-50">Audit Logs</h1>
        <p className="text-xs text-slate-400">Immutable trail of every action across the platform</p>
      </div>
      <AuditTab />
    </div>
  )
}