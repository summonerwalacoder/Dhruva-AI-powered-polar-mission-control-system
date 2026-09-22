import { ConfigTab } from '../Admin'

export default function AdminConfig() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-50">System Configuration</h1>
        <p className="text-xs text-slate-400">Global keys — integrations, thresholds, policies</p>
      </div>
      <ConfigTab />
    </div>
  )
}