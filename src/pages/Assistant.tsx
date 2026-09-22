import { useEffect, useRef, useState } from 'react'
import { useMission } from '../context/MissionContext'
import { api, ApiError } from '../lib/api'
import { offlineAnswer } from '../lib/offlineEngine'
import { Badge, Btn, Card, Icon, Spinner } from '../components/ui'
import { attachRecognizer, speak, stopSpeaking } from '../lib/voice'
import type { ChatReply } from '../lib/types'

interface Msg {
  q: string
  a: ChatReply
}

export default function Assistant() {
  const { selectedId } = useMission()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [thread, setThread] = useState<Msg[]>([])
  const [err, setErr] = useState('')
  const [listen, setListen] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [quick, setQuick] = useState<{ id: string; label: string }[]>([])
  const [provider, setProvider] = useState('')
  const bodyRef = useRef<HTMLDivElement>(null)
  const recRef = useRef<ReturnType<typeof attachRecognizer> | null>(null)

  useEffect(() => {
    api('/api/ai/quick-actions').then((r: any) => setQuick(r.actions)).catch(() => {})
    api('/api/ai/status').then((r: any) => setProvider(r.provider)).catch(() => {})
  }, [])

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
  }, [thread.length, busy])

  const send = async (q: string) => {
    if (!q.trim() || busy) return
    setBusy(true)
    setErr('')
    try {
      const r = await api<ChatReply>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message: q.trim(), mission_id: selectedId, voice: listen }),
      })
      setThread((t) => [...t, { q: q.trim(), a: r }])
      stopSpeaking()
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 0) {
        const local = await offlineAnswer(q.trim(), selectedId)
        setThread((t) => [...t, { q: q.trim(), a: local }])
        stopSpeaking()
      } else {
        setErr(e?.detail || e?.message || 'Failed')
      }
    } finally {
      setBusy(false)
      setText('')
    }
  }

  const speakReply = (m: Msg) => {
    if (speaking) {
      stopSpeaking()
      setSpeaking(false)
      return
    }
    speak(m.a.reply, m.a.language === 'hi' ? 'hi' : 'en')
    setSpeaking(true)
    const done = () => setSpeaking(false)
    window.speechSynthesis?.addEventListener('end', done, { once: true })
  }

  const rec = attachRecognizer(
    'en',
    (t) => send(t),
    () => {
      setListen(false)
    },
  )
  recRef.current = rec

  return (
    <div className="flex h-[calc(100dvh-140px)] flex-col space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-50">DHRUVA AI Assistant</h1>
          <p className="text-xs text-slate-400">
            Multilingual command centre · provider: <b className="text-ice-300">{provider || '…'}</b>
          </p>
        </div>
        <Badge tone="ice">voice: en-IN · hi-IN</Badge>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col">
        <div ref={bodyRef} className="flex-1 space-y-3 overflow-y-auto p-3">
          {!thread.length ? (
            <div className="py-10 text-center text-sm text-slate-400">
              <div className="mb-3 text-3xl">❄</div>
              Ask anything about the mission. Try:
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {quick.map((q) => (
                  <button key={q.id} onClick={() => send(q.label)} className="rounded-full bg-ink-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-ink-700">
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            thread.map((m, i) => (
              <div key={i} className="space-y-2">
                <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-ice-500 px-3.5 py-2 text-sm text-ink-950">{m.q}</div>
                <div className="mr-auto w-fit max-w-[92%] rounded-2xl rounded-bl-sm bg-ink-800 px-3.5 py-2.5 text-sm text-slate-100">
                  <p className="whitespace-pre-wrap leading-relaxed">{m.a.reply}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-ink-700/50 pt-2 text-[11px] text-slate-500">
                    <button onClick={() => speakReply(m)} className="flex items-center gap-1 text-ice-300 hover:text-white">
                      <Icon name={speaking ? 'stop' : 'mic'} size={12} /> {m.a.language === 'hi' ? 'सुनें' : 'speak'}
                    </button>
                    <Badge tone="slate">{m.a.intent}</Badge>
                    <Badge tone="slate">{m.a.language}</Badge>
                    <span>provider: {m.a.provider}{m.a.model ? ` · ${m.a.model}` : ''}</span>
                  </div>
                  {m.a.evidence?.length ? (
                    <details className="mt-1.5">
                      <summary className="cursor-pointer text-[11px] text-slate-500">evidence ({m.a.evidence.length})</summary>
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-slate-400">
                        {m.a.evidence.map((e, j) => <li key={j}>{e}</li>)}
                      </ul>
                    </details>
                  ) : null}
                </div>
              </div>
            ))
          )}
          {busy ? (
            <div className="mr-auto w-fit rounded-2xl rounded-bl-sm bg-ink-800 px-3.5 py-2 text-sm text-slate-400">
              <Spinner label="thinking…" />
            </div>
          ) : null}
          {err ? <div className="rounded-lg bg-rose-500/15 p-2.5 text-sm text-rose-300">{err}</div> : null}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); send(text) }}
          className="flex items-center gap-2 border-t border-ink-700/60 p-2.5"
        >
          {listen ? (
            <button
              type="button"
              onClick={() => { setListen(false); stopSpeaking(); recRef.current?.stop() }}
              className="sos-pulse flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white"
            >
              <Icon name="stop" size={18} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { setListen(true); rec.start() }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink-700 text-slate-200 hover:bg-ink-600"
              title="Voice input"
            >
              <Icon name="mic" size={18} />
            </button>
          )}
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ask DHRUVA… (हिंदी में भी पूछ सकते हैं)"
            className="flex-1 rounded-xl border border-ink-700 bg-ink-800/70 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-ice-500"
          />
          {listen ? <span className="hidden text-[11px] text-rose-300 sm:block">listening… speak now</span> : null}
          <Btn type="submit" disabled={busy || !text.trim()} className="h-11 w-11 p-0">
            <Icon name="send" size={16} />
          </Btn>
        </form>
      </Card>
    </div>
  )
}