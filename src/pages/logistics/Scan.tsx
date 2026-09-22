import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import { Badge, Btn, Card, Icon, inputCls, statusTone } from '../../components/ui'

export default function QrScan() {
  const { can } = useAuth()
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [hits, setHits] = useState<any[] | null>(null)
  const [msg, setMsg] = useState('')
  const canWrite = can('cargo:write')

  const scan = async () => {
    if (!q.trim()) return
    setBusy(true)
    setMsg('')
    try {
      const res: any[] = await api(`/api/cargo?q=${encodeURIComponent(q.trim())}`)
      setHits(res)
      if (!res.length) setMsg('No cargo matched that QR / id.')
    } catch (e: any) {
      setMsg(e?.message || 'Scan failed')
    } finally {
      setBusy(false)
    }
  }

  const advance = async (c: any, status: string) => {
    try {
      await api(`/api/cargo/${c.id}/status`, { method: 'POST', body: JSON.stringify({ status, location: 'Scanner verified' }) })
      setMsg(`${c.cargo_id} → ${status}`)
      scan()
    } catch (e: any) {
      setMsg(e?.message || 'Failed')
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-50">QR Scanner</h1>
        <p className="text-xs text-slate-400">Look up cargo by QR code or cargo ID and advance its lifecycle stages</p>
      </div>

      <Card className="p-4">
        <div className="flex gap-2">
          <div className="flex-1">
            <input
              className={inputCls}
              placeholder="Scan QR or type cargo ID / DHU-… code"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && scan()}
              autoFocus
            />
          </div>
          <Btn onClick={scan} disabled={busy}>{busy ? '…' : <Icon name="scan" size={16} />}</Btn>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
          <Icon name="wifi" size={12} className="text-ice-400" />
          {navigatorOnDevice() ? (
            <span>Camera assist: {cameraAvailable() ? 'BarcodeDetector ready — point at a QR.' : 'not available in this browser (type the code instead).'}</span>
          ) : (
            <span>Camera assist requires a secure context.</span>
          )}
        </div>
        {msg ? <p className="mt-2 text-sm text-ice-300">{msg}</p> : null}
      </Card>

      {hits === null ? (
        <Card className="p-8 text-center text-sm text-slate-400">
          <Icon name="scan" size={28} className="mx-auto mb-2 text-slate-600" />
          Scan a cargo QR above to pull up its tracking status.
        </Card>
      ) : null}
      {hits !== null && !hits.length ? (
        <Card className="p-8 text-center text-sm text-slate-400">No cargo found for <code className="text-ice-300">{q}</code>.</Card>
      ) : null}

      <div className="space-y-2">
        {(hits || []).map((c) => (
          <Card key={c.id} className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ice-500/15"><Icon name="cargo" size={18} className="text-ice-300" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-100">{c.item_name}</span>
                  <code className="text-xs text-ice-400">{c.cargo_id}</code>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <Badge tone={statusTone(c.shipment_status)}>{c.shipment_status}</Badge>
                  <span>category {c.category || '—'}</span>
                  <span>qr {c.qr_code || '—'}</span>
                  {c.delayed ? <Badge tone="red">delayed</Badge> : null}
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  qty {c.quantity ?? '—'} {c.unit || ''} · expected {c.expected_arrival || '—'}
                </div>
              </div>
            </div>
            {canWrite ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {['packing', 'manifest', 'transport', 'transit', 'station_arrival', 'inspection', 'inventory'].filter((s) => s !== c.shipment_status).map((s) => (
                  <Btn key={s} kind="ghost" className="!px-2 !py-1 text-[11px]" onClick={() => advance(c, s)}>{s}</Btn>
                ))}
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  )
}

function navigatorOnDevice() {
  return typeof navigator !== 'undefined' && (navigator as any).mediaDevices?.getUserMedia != null
}

function cameraAvailable() {
  return typeof (window as any).BarcodeDetector !== 'undefined'
}