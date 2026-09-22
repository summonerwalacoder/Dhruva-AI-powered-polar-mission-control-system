export function speak(text: string, lang = 'en') {
  try {
    if (!('speechSynthesis' in window)) return false
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'
    u.rate = 1.0
    window.speechSynthesis.speak(u)
    return true
  } catch {
    return false
  }
}

export function stopSpeaking() {
  try {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  } catch {
    /* noop */
  }
}

export type SpeechHook = (onResult: (text: string) => void, onEnd: () => void) => {
  start: () => void
  stop: () => void
  supported: boolean
}

export function createRecognizer(lang: string): { start: () => void; supported: boolean } {
  const W = window as any
  const SR = W.SpeechRecognition || W.webkitSpeechRecognition
  if (!SR) return { supported: false, start: () => {} }
  const rec = new SR()
  rec.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'
  rec.interimResults = false
  rec.maxAlternatives = 1
  return {
    supported: true,
    start: () => {
      try {
        rec.start()
      } catch {
        /* already started */
      }
    },
  }
}

export function attachRecognizer(
  lang: string,
  onResult: (text: string) => void,
  onEnd: () => void,
): { start: () => void; stop: () => void; supported: boolean } {
  const W = window as any
  const SR = W.SpeechRecognition || W.webkitSpeechRecognition
  if (!SR) return { start: () => {}, stop: () => {}, supported: false }
  const rec = new SR()
  rec.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'
  rec.interimResults = false
  rec.continuous = false
  rec.addEventListener('result', (e: any) => {
    const text = e?.results?.[0]?.[0]?.transcript || ''
    if (text) onResult(text)
  })
  rec.addEventListener('end', onEnd)
  rec.addEventListener('error', onEnd)
  return {
    supported: true,
    start: () => {
      try {
        rec.start()
      } catch {
        /* noop */
      }
    },
    stop: () => {
      try {
        rec.stop()
      } catch {
        /* noop */
      }
    },
  }
}