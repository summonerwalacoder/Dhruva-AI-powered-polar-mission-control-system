import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useMission } from '../context/MissionContext'
import { apiQueued } from '../lib/api'
import { Icon, Modal, Field, inputCls, Btn } from './ui'

export function EmergencyFab() {
  const { user, can } = useAuth()
  const { selectedId } = useMission()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ description: '', type: '', severity: '', location: '' })
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string>('')

  if (!user || !can('emergency:report')) return null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setDone('')
    try {
      const payload = {
        mission_id: selectedId,
        description: form.description,
        type: form.type || 'general',
        severity: form.severity || 'normal',
        location: form.location,
        connectivity_status: navigator.onLine ? 'online' : 'offline',
        offline_queued: !navigator.onLine,
      }
      const res: any = await apiQueued('/api/emergencies', {
        method: 'POST',
        body: JSON.stringify(payload),
        entity: 'emergency',
        entity_id: `emr-${Date.now()}`,
        operation: 'upsert',
      })
      setDone(
        res?.queued
          ? 'Saved offline — will transmit when connected.'
          : `Emergency logged (${res?.emergency_id || ''}).`,
      )
      setForm({ description: '', type: '', severity: '', location: '' })
      setTimeout(() => {
        setOpen(false)
        setDone('')
        nav('/emergency')
      }, 1200)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {/* SOS quick button */}
      <button
        onClick={() => setOpen(true)}
        className="sos-pulse fixed bottom-4 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-rose-500 text-white shadow-2xl lg:bottom-6 lg:left-auto"
        aria-label="Emergency SOS"
      >
        <Icon name="emergency" size={24} />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Report Emergency / SOS">
        <form onSubmit={submit} className="space-y-3">
          <Field label="Describe the situation (en/hi)" hint="e.g. Generator kharab hai… / team member injured…">
            <textarea
              required
              rows={3}
              className={inputCls}
              placeholder="What happened?"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select className={inputCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="">auto / general</option>
                <option>medical</option>
                <option>fire</option>
                <option>generator_failure</option>
                <option>vehicle</option>
                <option>weather</option>
                <option>communication</option>
              </select>
            </Field>
            <Field label="Severity">
              <select className={inputCls} value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                <option>normal</option>
                <option>serious</option>
                <option>critical</option>
              </select>
            </Field>
          </div>
          <Field label="Location">
            <input
              className={inputCls}
              placeholder="Station / coordinates"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </Field>
          {done ? <div className="rounded-lg bg-emerald-500/15 p-2.5 text-sm text-emerald-300">{done}</div> : null}
          <Btn type="submit" disabled={busy || !form.description.trim()} className="w-full" kind="danger">
            Send Emergency SOS
          </Btn>
        </form>
      </Modal>
    </>
  )
}