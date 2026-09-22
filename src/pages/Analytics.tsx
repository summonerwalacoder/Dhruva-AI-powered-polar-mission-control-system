import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import { useMission } from '../context/MissionContext'
import { Card, ErrorBox, SectionTitle, Spinner, Stat, useApi } from '../components/ui'
import type { Analytics } from '../lib/types'

const PIE = ['#2fa3b8', '#34d399', '#f59e0b', '#f87171', '#8b5cf6']

export default function Analytics() {
  const { selectedId } = useMission()
  const { data, loading, error, reload } = useApi<Analytics>(`/api/analytics/summary?mission_id=${selectedId || ''}`)

  if (loading) return <Spinner label="Crunching analytics…" />
  if (error) return <ErrorBox message={error} onRetry={reload} />
  if (!data) return null

  const consData = Object.entries(data.inventory.consumption_30d || {}).map(([k, v]) => ({ name: k, value: v }))
  const catData = Object.entries(data.inventory.by_category || {}).map(([k, v]) => ({ name: k, value: v as number }))
  const alert7 = (data.alerts.last_7d ? Object.entries(data.alerts.last_7d) : []).map(([d, v]) => ({ day: d.slice(5), alerts: v }))
  const mvt = Object.entries(data.personnel.by_movement || {}).map(([k, v]) => ({ name: k.replace('_', ' '), value: v as number }))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-50">Mission Analytics</h1>
        <p className="text-xs text-slate-400">Consumption, readiness and alert trends</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Cargo delayed" value={`${data.cargo.delayed} / ${data.cargo.total}`} sub={`${data.cargo.delay_rate}% delay rate`} tone={data.cargo.delayed ? 'warn' : 'good'} />
        <Stat label="In transit" value={data.cargo.in_transit} sub={`${data.cargo.delivered} delivered`} tone="ice" />
        <Stat label="Asset uptime" value={`${data.assets.uptime}%`} sub={`${data.assets.critical} critical`} tone={data.assets.critical ? 'bad' : data.assets.uptime > 80 ? 'good' : 'warn'} />
        <Stat label="Open emergencies" value={data.emergency.open} sub={data.emergency.avg_response_hours ? `avg response ${data.emergency.avg_response_hours}h` : 'no data'} tone={data.emergency.open ? 'warn' : 'good'} />
        <Stat label="Alerts (7d)" value={data.alerts.total} sub="last 7 days" tone="default" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle title="Consumption last 30 days" sub="by category (units consumed)" />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={consData}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={{ background: '#0f2a44', border: '1px solid #16385a', borderRadius: 8 }} />
                <Bar dataKey="value" fill="#2fa3b8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {mvt.length ? (
          <Card className="p-4">
            <SectionTitle title="Personnel movement" sub="current status distribution" />
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={mvt} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {mvt.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0f2a44', border: '1px solid #16385a', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        ) : null}

        <Card className="p-4">
          <SectionTitle title="Alerts last 7 days" />
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={alert7}>
                <XAxis dataKey="day" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#0f2a44', border: '1px solid #16385a', borderRadius: 8 }} />
                <Line type="monotone" dataKey="alerts" stroke="#2fa3b8" strokeWidth={2} dot={{ fill: '#2fa3b8' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <SectionTitle title="Inventory by category" sub="current stock count" />
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={catData} layout="vertical">
                <XAxis type="number" stroke="#64748b" fontSize={11} />
                <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} width={80} />
                <Tooltip contentStyle={{ background: '#0f2a44', border: '1px solid #16385a', borderRadius: 8 }} />
                <Bar dataKey="value" fill="#34d399" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  )
}