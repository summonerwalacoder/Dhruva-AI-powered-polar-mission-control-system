import { Link } from 'react-router-dom'
import { fmtNum } from '../lib/api'
import { Badge, Card, Empty, SectionTitle, Spinner, Stat, useApi } from '../components/ui'

export default function MedicalInventory() {
  const inventory = useApi<any[]>('/api/inventory?category=medical')

  const rows = inventory.data || []
  const low = rows.filter((i) => i.is_low || (i.min_stock != null && Number(i.quantity) <= Number(i.min_stock)))
  const total = rows.reduce((s, i) => s + (Number(i.quantity) || 0), 0)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-50">Medical Inventory</h1>
        <p className="text-xs text-slate-400">Sick-bay and cold-chain stock levels (read-only for medical)</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Medical SKUs" value={fmtNum(rows.length)} tone="ice" />
        <Stat label="Total units" value={fmtNum(total)} tone="default" />
        <Stat label="Low stock items" value={fmtNum(low.length)} sub="at/below reorder level" tone={low.length ? 'warn' : 'good'} />
        <Stat label="Expiring soon" value={fmtNum(rows.filter((i) => i.expiry && i.expiry <= todayPlus(60)).length)} sub="within 60 days" tone="warn" />
      </div>

      {inventory.loading ? <Spinner label="Loading inventory…" /> : null}
      {!inventory.loading && !rows.length ? <Empty label="No medical inventory recorded for this mission." /> : null}

      <Card className="p-4">
        <SectionTitle title="Stock ledger" sub="category: medical" right={<Link className="text-xs text-ice-300" to="/inventory">full inventory</Link>} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Unit</th>
                <th className="px-3 py-2">Location</th>
                <th className="px-3 py-2">Expiry</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700/40">
              {rows.map((i) => (
                <tr key={i.id}>
                  <td className="px-3 py-2 font-medium text-slate-100">{i.item}</td>
                  <td className="px-3 py-2 tabular-nums text-slate-300">{Number(i.quantity)}</td>
                  <td className="px-3 py-2 text-slate-400">{i.unit || '—'}</td>
                  <td className="px-3 py-2 text-slate-400">{i.location || '—'}</td>
                  <td className="px-3 py-2 text-slate-400">
                    {i.expiry ? (
                      <span className={i.expiry <= todayPlus(60) ? 'text-rose-300' : ''}>{i.expiry}</span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={i.is_low || (i.min_stock != null && Number(i.quantity) <= Number(i.min_stock)) ? 'amber' : 'green'}>
                      {i.is_low || (i.min_stock != null && Number(i.quantity) <= Number(i.min_stock)) ? 'low' : 'ok'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function todayPlus(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}