import { Link } from 'react-router-dom'
import { fmtNum } from '../../lib/api'
import { Badge, Card, Icon, SectionTitle, Spinner, Stat, statusTone, useApi } from '../../components/ui'

export default function LogisticsDashboard() {
  const cargo = useApi<any[]>('/api/cargo?')
  const shipments = useApi<any[]>('/api/shipments')
  const containers = useApi<any[]>('/api/containers')
  const inventory = useApi<any[]>('/api/inventory?')

  const rows = cargo.data || []
  const byStatus = new Map<string, number>()
  rows.forEach((c) => byStatus.set(c.shipment_status, (byStatus.get(c.shipment_status) || 0) + 1))
  const delayed = rows.filter((c) => c.delayed)
  const inTransit = rows.filter((c) => c.shipment_status === 'transit')
  const containersRows = containers.data || []
  const packed = containersRows.filter((c) => c.status === 'packed').length
  const inv = inventory.data || []
  const invCount = inv.reduce((s, i) => s + (Number(i.quantity) || 0), 0)
  const lowStock = inv.filter((i) => i.is_low || (i.min_stock != null && Number(i.quantity) <= Number(i.min_stock)))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-50">Cargo & Supply Control</h1>
          <p className="text-sm text-slate-400">End-to-end material pipeline — from indent to polar station inventory</p>
        </div>
      </div>

      {/* Supply chain funnel */}
      <Card className="p-4">
        <SectionTitle title="Pipeline funnel" sub="cargo items by lifecycle stage" />
        {cargo.loading ? <Spinner /> : null}
        {!cargo.loading && !rows.length ? <p className="text-sm text-slate-400">No cargo records yet.</p> : null}
        <div className="flex flex-wrap items-center gap-2">
          {Array.from(byStatus.entries()).map(([s, n]) => (
            <div key={s} className="flex items-center gap-2 rounded-xl border border-ink-700/50 bg-ink-800/50 px-3 py-2">
              <Badge tone={statusTone(s)}>{s}</Badge>
              <span className="text-lg font-bold tabular-nums text-slate-100">{n}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total cargo items" value={fmtNum(rows.length)} sub="across active pipelines" tone="ice" />
        <Stat label="In transit" value={fmtNum(inTransit.length)} sub="moving to stations" tone="default" />
        <Stat label="Delayed items" value={fmtNum(delayed.length)} sub="need expediting" tone={delayed.length ? 'bad' : 'good'} />
        <Stat label="Containers" value={fmtNum(containersRows.length)} sub={`${containersRows.filter((c) => c.status === 'packed').length} packed`} tone="default" />
        <Stat label="Shipments" value={fmtNum(shipments.data?.length || 0)} sub="consignments tracked" tone="default" />
        <Stat label="Inventory units" value={fmtNum(invCount)} sub="at stations" tone="default" />
        <Stat label="Low stock SKUs" value={fmtNum(lowStock.length)} sub="need reorder" tone={lowStock.length ? 'warn' : 'good'} />
        <Stat label="Container utilization" value={containersRows.length ? `${Math.round((containersRows.reduce((s, c) => s + (Number(c.used_kg) || 0), 0) / Math.max(1, containersRows.reduce((s, c) => s + (Number(c.capacity_kg) || 0), 0))) * 100)}%` : '—'} sub={`${packed} packed`} tone="default" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Delayed cargo watchlist */}
        <Card className="p-4">
          <SectionTitle title="Delayed cargo watchlist" sub="items past expected arrival" right={<Link to="/cargo" className="text-xs text-ice-300">full ledger</Link>} />
          {!delayed.length ? <p className="text-sm text-slate-400">Nothing delayed — supply chain on schedule.</p> : null}
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {delayed.slice(0, 8).map((c) => (
              <div key={c.id} className="flex items-start gap-2 rounded-lg bg-ink-800/50 px-2.5 py-2 text-sm">
                <Badge tone="red">delayed</Badge>
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-200">{c.item_name}</div>
                  <div className="text-xs text-slate-400">{c.cargo_id} · expected {c.expected_arrival}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Low-stock notices */}
        <Card className="p-4">
          <SectionTitle title="Low-stock notices" sub="station inventory approaching reorder point" right={<Link to="/inventory" className="text-xs text-ice-300">inventory</Link>} />
          {!lowStock.length ? <p className="text-sm text-slate-400">All stock levels healthy.</p> : null}
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {lowStock.slice(0, 8).map((i) => (
              <div key={i.id} className="flex items-start gap-2 rounded-lg bg-ink-800/50 px-2.5 py-2 text-sm">
                <Badge tone="amber">low</Badge>
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-200">{i.item_name}</div>
                  <div className="text-xs text-slate-400">{Number(i.quantity)} / min {i.min_stock != null ? i.min_stock : '—'}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Quick supply actions */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <QuickAction to="/cargo" icon="cargo" label="Cargo ledger" />
        <QuickAction to="/logistics/shipments" icon="route" label="Shipments" />
        <QuickAction to="/logistics/containers" icon="box" label="Containers" />
        <QuickAction to="/logistics/resupply" icon="layers" label="Resupply planner" />
        <QuickAction to="/logistics/scan" icon="scan" label="QR scanner" />
        <QuickAction to="/inventory" icon="clip" label="Station inventory" />
        <QuickAction to="/cargo" icon="search" label="Track an item" />
        <Link to="/logistics/dashboard" className="rounded-xl border border-ice-500/60 bg-ice-500/10 px-3 py-3 text-sm font-medium text-ice-200">+ New indent →</Link>
      </div>

      {/* Supply metrics strip */}
      <div className="flex flex-wrap gap-2 text-sm">
        {inTransit.slice(0, 5).map((c) => (
          <span key={c.id} className="rounded-full border border-ink-700 bg-ink-800/60 px-3 py-1 text-xs text-slate-300">
            <Icon name="route" size={12} className="mr-1 inline-block text-ice-400" />
            {c.cargo_id} → {c.destination_station || 'station'} ({c.location || 'en route'})
          </span>
        ))}
      </div>
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