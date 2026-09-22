import { fmtNum } from '../../lib/api'
import { Badge, Card, SectionTitle, Spinner, Stat, useApi } from '../../components/ui'

export default function AdminSystem() {
  const users = useApi<any[]>('/api/users')
  const missions = useApi<any[]>('/api/missions')
  const personnel = useApi<any[]>('/api/personnel?')
  const cargo = useApi<any[]>('/api/cargo?')
  const inventory = useApi<any[]>('/api/inventory?')
  const assets = useApi<any[]>('/api/assets?')
  const alerts = useApi<any[]>('/api/alerts?')
  const emergencies = useApi<any[]>('/api/emergencies?')
  const containers = useApi<any[]>('/api/containers')
  const shipments = useApi<any[]>('/api/shipments')
  const auditStats = useApi<any>('/api/audit/stats')
  const aiStatus = useApi<any>('/api/ai/status')
  const weatherStatus = useApi<any>('/api/weather/status')

  const rows: Array<[string, number, string]> = [
    ['Users', users.data?.length || 0, '/admin/users'],
    ['Missions', missions.data?.length || 0, '/missions'],
    ['Personnel', personnel.data?.length || 0, '/personnel'],
    ['Cargo items', cargo.data?.length || 0, '/cargo'],
    ['Inventory units', inventory.data?.reduce((s, i) => s + (Number(i.quantity) || 0), 0) || 0, '/inventory'],
    ['Assets', assets.data?.length || 0, '/assets'],
    ['Alerts', alerts.data?.length || 0, '/alerts'],
    ['Emergencies', emergencies.data?.length || 0, '/emergency'],
    ['Containers', containers.data?.length || 0, '/logistics/containers'],
    ['Shipments', shipments.data?.length || 0, '/logistics/shipments'],
  ]

  const loaders = [users, missions, personnel, cargo, inventory, assets, alerts, emergencies, containers, shipments, auditStats]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-50">System Monitoring</h1>
        <p className="text-xs text-slate-400">Entity counts, services and load indicators for the platform</p>
      </div>

      {loaders.some((l) => l.loading) ? <Spinner label="Collecting telemetry…" /> : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {rows.map(([label, value, to]) => (
          <Stat key={label} label={label} value={fmtNum(value)} sub={to} tone="ice" />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle title="Service health" sub="external dependencies" />
          <div className="space-y-2">
            <ServiceRow name="AI Assistant" detail={aiStatus.data?.message || ''} ok={aiStatus.data?.llm_configured} />
            <ServiceRow name="Weather source" detail={weatherStatus.data?.message || weatherStatus.data?.status || ''} ok={weatherStatus.data?.live_configured} />
            <ServiceRow name="API core" detail="FastAPI · uvicorn · SQLite" ok={true} />
            <ServiceRow name="Offline queue" detail="IndexedDB cache + outbox replayed on reconnect" ok={true} />
            <ServiceRow name="PWA" detail="Service worker cached shell (production)" ok={false} />
          </div>
        </Card>

        <Card className="p-4">
          <SectionTitle title="Audit activity" sub="events by action" />
          <div className="flex flex-wrap gap-2">
            {Object.entries(auditStats.data?.by_action || {}).slice(0, 18).map(([a, n]) => (
              <span key={a} className="rounded-full border border-ink-700 bg-ink-800/60 px-2.5 py-1 text-xs text-slate-300">
                {a} <b className="text-ice-300">×{String(n)}</b>
              </span>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function ServiceRow({ name, detail, ok }: { name: string; detail: string; ok: boolean | undefined }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-ink-800/50 px-3 py-2.5 text-sm">
      <div className="min-w-0">
        <div className="font-medium text-slate-200">{name}</div>
        <div className="truncate text-xs text-slate-500">{detail}</div>
      </div>
      <Badge tone={ok === undefined ? 'slate' : ok ? 'green' : 'amber'}>{ok === undefined ? 'unknown' : ok ? 'healthy' : 'attention'}</Badge>
    </div>
  )
}