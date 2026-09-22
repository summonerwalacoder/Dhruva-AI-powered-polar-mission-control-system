import { useState } from 'react'
import { useMission } from '../context/MissionContext'
import { downloadFile } from '../lib/api'
import { Badge, Btn, Card, ErrorBox, Icon, Spinner, cx, statusTone, useApi } from '../components/ui'

export default function Reports() {
  const { selectedId, selected } = useMission()
  const { data, loading, error, reload } = useApi<any>(`/api/reports/daily?mission_id=${selectedId}`)
  const [dl, setDl] = useState<'csv' | 'pdf' | null>(null)

  const download = async (kind: 'csv' | 'pdf') => {
    if (!selected) return
    setDl(kind)
    try {
      const ext = kind === 'csv' ? 'csv' : 'pdf'
      const name = `dhruva_${selected.mission_id}_${data?.date || 'report'}.${ext}`
      await downloadFile(`/api/reports/daily/${ext}?mission_id=${selectedId}`, name)
    } finally {
      setDl(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-50">Reports</h1>
          <p className="text-xs text-slate-400">Daily mission report — generated from live mission state</p>
        </div>
        <div className="flex gap-2">
          <Btn kind="ghost" disabled={!data || !!dl} onClick={() => download('csv')}>
            <Icon name="download" size={15} /> {dl === 'csv' ? '…' : 'CSV'}
          </Btn>
          <Btn kind="ghost" disabled={!data || !!dl} onClick={() => download('pdf')}>
            <Icon name="download" size={15} /> {dl === 'pdf' ? '…' : 'PDF'}
          </Btn>
        </div>
      </div>

      {!selectedId ? (
        <Card className="p-6 text-center text-sm text-slate-400">Select a mission to view its report.</Card>
      ) : null}

      {loading ? <Spinner label="Generating report…" /> : null}
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}

      {data ? (
        <Card className="space-y-4 p-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-slate-50">{data.title}</h2>
              {data.date ? <Badge tone="ice">{data.date}</Badge> : null}
            </div>
            <p className="text-sm text-slate-400">
              {data.mission?.name} · {data.mission?.code || data.mission?.mission_id} · status{' '}
              <Badge tone={statusTone(data.mission?.status)}>{data.mission?.status}</Badge>
            </p>
          </div>

          {data.summary ? (
            <InlineStat title="Summary" rows={Object.entries(data.summary as Record<string, any>).map(([k, v]) => [k, String(v)] as [string, string])} />
          ) : null}

          {data.risk ? (
            <Section title="Risk assessment" tone="warn">
              <div className="flex items-center gap-2">
                <Badge tone={statusTone(data.risk?.level)}>{data.risk?.level}</Badge>
                <span className="text-sm text-slate-400">score {data.risk?.score}</span>
              </div>
              {(data.risk?.reasons || []).map((r: string, i: number) => (
                <p key={i} className="text-sm text-slate-300">• {r}</p>
              ))}
            </Section>
          ) : null}

          {data.weather ? (
            <Section title="Weather">
              <p className="text-sm text-slate-300">
                {data.weather?.label}: {data.weather?.temperature_c}°C, wind {data.weather?.wind_speed} km/h, {data.weather?.condition}
                {data.weather?.storm ? ' — STORM' : ''}
              </p>
            </Section>
          ) : null}

          {data.survival_clock?.length ? (
            <Section title="Survival clock">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {data.survival_clock.map((c: any) => (
                  <div key={c.category} className="rounded-lg bg-ink-800/60 p-2.5 text-center">
                    <div className="text-[10px] uppercase tracking-wide text-slate-500">{c.label}</div>
                    <div className="text-lg font-bold tabular-nums text-slate-100">{c.days_remaining != null ? `${c.days_remaining}d` : '—'}</div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {data.personnel ? (
            <InlineStat title="Personnel" rows={Object.entries(data.personnel).filter(([, v]) => typeof v === 'number').map(([k, v]) => [k, String(v)] as [string, string])} />
          ) : null}

          {data.cargo ? (
            <InlineStat title="Cargo" rows={Object.entries(data.cargo).map(([k, v]) => [k, String(v)] as [string, string])} />
          ) : null}

          {data.alerts?.length ? (
            <Section title="Active alerts">
              {data.alerts.map((a: any, i: number) => (
                <p key={i} className="text-sm text-slate-300">• [{a.severity?.toUpperCase()}] {a.title}</p>
              ))}
            </Section>
          ) : null}
        </Card>
      ) : null}
    </div>
  )
}

function Section({ title, children, tone }: { title: string; children: React.ReactNode; tone?: string }) {
  return (
    <div className="border-t border-ink-700/50 pt-3">
      <div className={cx('mb-2 text-xs font-semibold uppercase tracking-wide', tone === 'warn' ? 'text-amber-300' : 'text-ice-300')}>{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function InlineStat({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <Section title={title}>
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between rounded bg-ink-800/50 px-2.5 py-1 text-sm">
            <span className="text-slate-400">{k.replaceAll('_', ' ')}</span>
            <span className="font-semibold text-slate-100">{v}</span>
          </div>
        ))}
      </div>
    </Section>
  )
}