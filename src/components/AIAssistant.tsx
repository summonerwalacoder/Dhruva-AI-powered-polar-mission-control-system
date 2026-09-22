import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useMission } from '../context/MissionContext'
import { api } from '../lib/api'
import { attachRecognizer, speak, stopSpeaking } from '../lib/voice'
import type { ChatReply } from '../lib/types'
import { Icon } from './ui'

export function AssistantFab() {
  const { user } = useAuth()
  const { selectedId } = useMission()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [thread, setThread] = useState<{ q: string; a: ChatReply }[]>([])
  const [listening, setListening] = useState(false)
  const [err, setErr] = useState('')

  if (!user) return null

  const send = async (q: string) => {
    if (!q.trim() || busy) return
    setBusy(true)
    setErr('')
    try {
      const r = await api<ChatReply>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message: q.trim(), mission_id: selectedId, voice: false }),
      })
      setThread((t) => [...t, { q: q.trim(), a: r }])
      if (r.action?.type) {
        const map: Record<string, string> = {
          open_simulations: '/simulations',
          open_emergency: '/emergency',
          open_cargo: '/cargo',
          open_assets: '/assets',
          open_alerts: '/alerts',
          open_weather: '/weather',
          open_personnel: '/personnel',
        }
        const to = map[r.action.type]
        if (to) nav(to)
      }
    } catch (e: any) {
      setErr(e?.message || 'Request failed')
    } finally {
      setBusy(false)
      setText('')
    }
  }

  const rec = attachRecognizer(
    'en',
    (t) => {
      setText(t)
      send(t)
    },
    () => setListening(false),
  )

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-16 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-ice-400 to-ice-600 text-ink-950 shadow-xl lg:bottom-6 lg:right-6"
        aria-label="AI assistant"
      >
        <Icon name="ai" size={22} />
      </button>

      {open ? (
        <div className="fixed bottom-28 right-4 z-50 flex w-[min(92vw,360px)] flex-col rounded-2xl border border-ink-700 bg-ink-900/95 shadow-2xl fade-up lg:bottom-24 lg:right-6">
          <div className="flex items-center justify-between border-b border-ink-700/60 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-ice-200">DHRUVA AI</span>
              <span className="rounded bg-ink-700 px-1.5 py-0.5 text-[10px] text-slate-400">EN / हिंदी</span>
            </div>
            <button onClick={() => setOpen(false)} className="rounded p-1 text-slate-400 hover:text-white">
              <Icon name="x" size={16} />
            </button>
          </div>

          <div className="max-h-72 space-y-3 overflow-y-auto p-3">
            {!thread.length ? (
              <div className="text-xs text-slate-400">
                Ask anything — “fuel forecast”, “kya ho raha hai?” (what's happening), “what if resupply is 10 days late?”,
                “emergency help”, “weather today”.
              </div>
            ) : (
              thread.map((m, i) => (
                <div key={i} className="space-y-2">
                  <div className="ml-auto w-fit max-w-[85%] rounded-xl rounded-br-sm bg-ice-500 px-3 py-2 text-sm text-ink-950">
                    {m.q}
                  </div>
                  <div className="mr-auto w-fit max-w-[88%] rounded-xl rounded-bl-sm bg-ink-800 px-3 py-2 text-sm text-slate-100">
                    {m.a.reply}
                    <div className="mt-1.5 flex items-center gap-2">
                      <button
                        onClick={() => speak(m.a.reply, m.a.language === 'hi' ? 'hi' : 'en')}
                        className="text-ice-300 hover:text-white"
                        aria-label="Speak"
                      >
                        <Icon name="mic" size={13} />
                      </button>
                      {m.a.evidence?.length ? (
                        <span className="text-[10px] text-slate-500">{m.a.provider}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            )}
            {busy ? (
              <div className="mr-auto w-fit rounded-xl rounded-bl-sm bg-ink-800 px-3 py-2 text-xs text-slate-400">
                thinking…
              </div>
            ) : null}
            {err ? <div className="text-xs text-rose-300">{err}</div> : null}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              send(text)
            }}
            className="flex items-center gap-2 border-t border-ink-700/60 p-2.5"
          >
            {listening ? (
              <button
                type="button"
                onClick={() => {
                  stopSpeaking()
                  setListening(false)
                  rec.stop()
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-white sos-pulse"
              >
                <Icon name="stop" size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setListening(true)
                  rec.start()
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-700 text-slate-200"
                aria-label="Voice input"
              >
                <Icon name="mic" size={14} />
              </button>
            )}
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ask DHRUVA… (हिंदी में भी पूछें)"
              className="flex-1 rounded-lg border border-ink-700 bg-ink-800/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-ice-500"
            />
            <button
              type="submit"
              disabled={busy || !text.trim()}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-ice-500 text-ink-950 disabled:opacity-40"
            >
              <Icon name="send" size={14} />
            </button>
          </form>
        </div>
      ) : null}
    </>
  )
}