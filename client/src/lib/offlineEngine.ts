import { getCachedValue } from './offline'
import type { ChatReply, EmergencyInterpret, Prediction, SimulationResult, SurvivalClock } from './types'

interface Bundle {
  overview: any
  clock: SurvivalClock[]
  predictions: Prediction[]
  missions: any[]
  personnel: any[]
  tasks: any[]
  missionName: string
  mid: number | null
}

async function loadBundle(mid: number | null): Promise<Bundle> {
  const [overview, clock, predictions, missions, personnel, tasks] = await Promise.all([
    mid ? getCachedValue<any>(`/api/missions/${mid}/overview`) : Promise.resolve(null),
    mid ? getCachedValue<SurvivalClock[]>(`/api/inventory/survival-clock/all?mission_id=${mid}`) : Promise.resolve(null),
    mid ? getCachedValue<Prediction[]>(`/api/inventory/predictions/all?mission_id=${mid}`) : Promise.resolve(null),
    getCachedValue<any[]>(`/api/missions`),
    getCachedValue<any[]>(`/api/personnel`),
    getCachedValue<any[]>(`/api/tasks`),
  ])
  const missionName = (missions || []).find((m) => m.id === mid)?.name || `Mission ${mid || '—'}`
  return { overview, clock: clock || [], predictions: predictions || [], missions: missions || [], personnel: personnel || [], tasks: tasks || [], missionName, mid }
}

export function detectLang(q: string): 'hi' | 'en' {
  return /[\u0900-\u097F]/.test(q) ? 'hi' : 'en'
}

function clockLine(c: SurvivalClock): string {
  return `- ${c.label || c.category}: ${c.days_remaining == null ? '—' : `${c.days_remaining}d`}${c.status === 'critical' ? ' ⚠ critical' : ''}`
}

function riskLevel(o: any): string {
  const l = String(o?.risk?.level || o?.risk?.status || 'medium').toLowerCase()
  if (['low', 'medium', 'high', 'critical'].includes(l)) return l
  return l === 'moderate' ? 'medium' : 'medium'
}

export async function offlineAnswer(q: string, missionId: number | null): Promise<ChatReply> {
  const lang = detectLang(q)
  const b = await loadBundle(missionId)
  const ev: string[] = []
  const low = q.toLowerCase()
  const clock = b.clock

  const pick = (cat: string): SurvivalClock | undefined => clock.find((c) => c.category?.toLowerCase().includes(cat))
  const pickPred = (cat: string): Prediction | undefined => b.predictions.find((p) => p.category?.toLowerCase().includes(cat))

  let reply = ''
  let intent = 'general'

  if (/fuel|ingehan|generator|batti|power|bajli|कोयला|ईंधन|बिजली/.test(low)) {
    intent = 'fuel'
    const fuel = pick('fuel')
    const power = pick('energy') || pick('power') || clock.find((c) => /generator|power|energy/.test(c.category))
    const fuelD = fuel?.days_remaining
    const powerD = power?.days_remaining
    reply = `⚡ ENERGY / FUEL (offline estimate from cached data)\n${clockLine(fuel || { category: 'fuel', label: 'Fuel', status: 'unknown' })}\n${clockLine(power || { category: 'energy', label: 'Power/generators', status: 'unknown' })}`
    if (typeof fuelD === 'number') { ev.push(`Fuel ~${fuelD}d left`); if (fuelD < 7) reply += `\n⚠ Critical: call resupply forward.` }
    if (typeof powerD === 'number') { ev.push(`Power ~${powerD}d left`); if (powerD < 5) reply += `\n⚠ Conserve heating loads.` }
  } else if (/food|ration|resupply|supply|bhojan|khana|रीसप्लाई|खाना|भोजन|आहार/.test(low)) {
    intent = 'resupply'
    const rows = b.predictions.filter((p) => /food|ration|provision/.test(p.category))
    const food = pickPred('food') || b.predictions.find((p) => /food|ration/.test(p.category))
    const foodD = food?.days_remaining
    reply = `🥘 RESUPPLY OUTLOOK ${foodD ? `· food ~${foodD}d left` : ''}\n${(rows.length ? rows : food ? [food] : []).slice(0, 5).map((r) => `- ${r.item}: ${r.days_remaining}d${r.reorder_recommended ? ' — reorder' : ''}`).join('\n')}`
    if (food?.reorder_recommended || (typeof foodD === 'number' && foodD < 10)) reply += `\n⚠ Reorder recommended.${b.overview?.next_resupply ? ` Next resupply: ${b.overview.next_resupply}` : ''}`
    if (foodD != null) ev.push(`food ≈ ${Math.round(foodD)}d remaining`)
  } else if (/water|pani|पानी|जल/.test(low)) {
    intent = 'water'
    const w = pick('water')
    reply = `💧 WATER ${w?.days_remaining != null ? `· ~${w.days_remaining}d left` : ''}\nMelting capacity & storage status from last cache.`
    if (w?.days_remaining != null && w.days_remaining < 7) reply += `\n⚠ Conserve water + check melt circuit.`
  } else if (/weather|storm|mausam|weather|बर्फ़ानी|तूफान|मौसम/.test(low)) {
    intent = 'weather'
    const w = b.overview?.weather
    if (w) {
      reply = `🌨 WEATHER (cached)\n- ${w.condition || '—'}, ${w.temperature_c != null ? `${w.temperature_c}°C` : '—'} temp, wind ${w.wind_speed ?? '—'} km/h\n- storm: ${w.storm ? 'YES ⚠' : 'no'} · ice route: ${w.ice_route_condition || '—'} · source: ${w.source || w.label || 'manual'}/cached`
      ev.push(`weather source ${w.source || 'manual'} (cached)`)
    } else reply = `🌨 Weather not cached for this mission.`
  } else if (/risk|danger|khatra|safety|रिस्क|खतरा|ख़तरा/.test(low)) {
    intent = 'risk'
    const level = riskLevel(b.overview)
    const reasons = b.overview?.risk?.reasons || []
    reply = `🛡 MISSION RISK: ${level.toUpperCase()} (score ${b.overview?.risk?.score ?? '—'})\n${(b.overview?.risk?.actions || []).slice(0, 5).map((a: string) => `→ ${a}`).join('\n')}`
    ev.push(...(reasons.slice(0, 3) as string[]))
  } else if (/predict|deplet|shortage|kab khatam|कब खत्म|पूर्वानुमान/.test(low)) {
    intent = 'predictions'
    reply = `📉 DEPLETION PREDICTIONS\n${(b.predictions || []).slice(0, 6).map((p) => `- ${p.item}: ${p.days_remaining ?? '—'}d${p.shortage_probability && p.shortage_probability > 0.5 ? ` (${Math.round(p.shortage_probability * 100)}% short)` : ''}`).join('\n')}`
  } else if (/team|crew|personnel|log|people|क्रू|टीम|सदस्य|लोग/.test(low)) {
    intent = 'team'
    const rows = (b.personnel || []).slice(0, 6)
    reply = `👥 TEAM (cached)\n${rows.length ? rows.map((p) => `- ${p.name}: ${p.movement_status || p.status || '—'}${p.health_status && p.health_status !== 'healthy' ? ` · ${p.health_status}` : ''}`).join('\n') : 'No personnel cached.'}`
  } else if (/task|kaam|काम|कोई काम/.test(low)) {
    intent = 'task'
    const rows = (b.tasks || []).slice(0, 6)
    reply = `🗒 TASKS (cached)\n${rows.length ? rows.map((t: any) => `- ${t.title || t.id}: ${t.status || '—'}`).join('\n') : 'No tasks cached.'}`
  } else if (/summary|report|status|update|hal|report karo|रिपोर्ट|हाल/.test(low)) {
    intent = 'summary'
    const daysLeft = b.overview?.mission?.remaining_days
    reply = `📋 ${b.missionName} SUMMARY (cached)\n- progress ${b.overview?.mission?.progress ?? '—'}% · ${daysLeft ?? '—'} days left\n- resupply: ${b.overview?.next_resupply || '—'}`
    ev.push(`cached @ ${new Date().toLocaleTimeString()}`)
  } else {
    reply = `❄ I'm running in OFFLINE mode with cached mission data (${b.missionName}). I can answer from cached overview, survival clock and predictions. Try: fuel status · food/water left · weather · risk · team · tasks · summary.`
  }

  if (!b.overview && !b.clock.length) {
    reply = `No cached mission data yet for offline answering — connect once online to build the local cache, then this assistant answers even in the field without network.`
    intent = 'no_cache'
  }

  if (lang === 'hi') reply = `(ऑफ़लाइन उत्तर — cached data)\n\n${reply}`

  return {
    reply,
    language: lang,
    intent,
    provider: 'offline-local',
    model: 'dhruva-offline-engine',
    evidence: ev,
    action: null,
  }
}

const TRIAGE_RULES: { cat: string; label: string; keys: RegExp; sev: 'critical' | 'serious' | 'minor'; steps: string[] }[] = [
  { cat: 'fire', label: 'Fire', keys: /fire|blaze|aag|आग|धुआं|smoke/i, sev: 'critical', steps: ['Activate fire alarms & evacuate to muster point', 'Deploy fire extinguishers; cut fuel/oxygen', 'Mark location for rescue crew'] },
  { cat: 'medical', label: 'Medical emergency', keys: /chest|breath|unconsc|injur|hurt|bleed|fracture|chot|सांस|घायल|खून|चोट|dil/i, sev: 'critical', steps: ['Apply first aid; monitor vitals', 'Initiate medevac protocol & route assessment', 'Alert medical officer on station comms'] },
  { cat: 'medevac', label: 'Medevac / evacuation', keys: /medevac|evacuat|crack|hypoxia|hypotherm|can't move|evac/i, sev: 'critical', steps: ['Prep medevac sled/vehicle', 'Check weather window before moving', 'Establish comms relay with HQ'] },
  { cat: 'fall', label: 'Fall / trauma', keys: /fallen|fell|slip|trip|fall|gir/i, sev: 'serious', steps: ['Keep casualty warm & immobilised', 'Assess for head/spine injury', 'Arrange medevac if movement pain'] },
  { cat: 'weather', label: 'Severe weather', keys: /storm|blizzard|wind|visibility|whiteout|tufan|storm|तूफान/i, sev: 'serious', steps: ['Shelter in place; halt field movement', 'Secure loose gear & tents', 'Recheck next weather window'] },
  { cat: 'power', label: 'Power / generator failure', keys: /power|generator|batti|electrical|band|fail|बिजली|जनरेटर/i, sev: 'serious', steps: ['Start backup generator', 'Rotate heating load; conserve battery', 'Schedule maintenance after hazard cleared'] },
  { cat: 'comms', label: 'Communications loss', keys: /comms|communication|radio|signal|network|contact lost|संपर्क/i, sev: 'serious', steps: ['Switch to backup radio channel', 'Attempt satellite/Iridium link', 'Report location & status via routine sked'] },
  { cat: 'sos', label: 'SOS / missing person', keys: /sos|missing|lost|gum|खो गया|maya/i, sev: 'critical', steps: ['Sound SOS; initiate search grid', 'Notify commander & HQ immediately', 'Mark last known position on map'] },
  { cat: 'structural', label: 'Structural damage', keys: /collap|crack|damage|shelter|tent|टेंट|टूट|break/i, sev: 'serious', steps: ['Evacuate damaged structure', 'Assess load-bearing / meltrate damage', 'Relocate personnel if unsafe'] },
]

export async function offlineTriage(desc: string): Promise<EmergencyInterpret> {
  const lang = detectLang(desc)
  const hit = TRIAGE_RULES.find((r) => r.keys.test(desc)) || {
    cat: 'unknown',
    label: 'Unclassified incident',
    keys: /^$/,
    sev: 'serious' as const,
    steps: ['Confirm details with reporter', 'Mark location & safest comms channel', 'Await HQ instruction / local assessment'],
  }
  return {
    emergency_type: hit.cat,
    type_label: hit.label,
    severity: hit.sev,
    severity_reasons: [`Classified ${hit.sev}`],
    language: lang,
    provider: 'offline-local',
    recommended_next_steps: hit.steps,
    suggested_emergency_create: {
      type: hit.cat,
      severity: hit.sev,
      description: desc,
      recommended_response: hit.steps[0],
    },
  }
}

const SEV = ['low', 'medium', 'high', 'critical']

function bump(level: string, n = 1): string {
  const i = Math.max(0, SEV.indexOf(level))
  return SEV[Math.min(SEV.length - 1, i + n)]
}

function catOf(s: string, ...tests: string[]): boolean {
  const x = s.toLowerCase()
  return tests.some((t) => x.includes(t))
}

export async function offlineSimulate(missionId: number, scenario: Record<string, any>): Promise<SimulationResult> {
  const b = await loadBundle(missionId)
  const beforeRisk = riskLevel(b.overview)
  const base: SurvivalClock[] = b.clock.length ? b.clock : (b.overview?.survival_clock || []).slice()

  const delay = Number(scenario.resupply_delay_days || 0)
  const fuelPct = Number(scenario.fuel_consumption_pct || 100)
  const teamInc = Number(scenario.team_increase || 0)
  const gFail = !!scenario.generator_fail
  const vUnavail = !!scenario.vehicle_unavailable
  const storm = !!scenario.severe_weather_blocks_route
  const cargoLost = !!scenario.cargo_lost
  const commOut = !!scenario.communication_outage

  const after: SurvivalClock[] = base.map((c) => ({ ...c }))
  const impact: { resource: string; was: number | null; now: number | null; impacted: boolean }[] = []
  let nBumps = 0

  const apply = (c: SurvivalClock, f: (d: number) => number) => {
    if (c.days_remaining == null) return
    const was = c.days_remaining
    const now = Math.max(0, Math.round(f(was)))
    c.days_remaining = now
    if (now < 5) c.status = 'critical'
    if (now !== was) impact.push({ resource: c.label || c.category, was, now, impacted: now < was })
  }

  if (cargoLost) { after.forEach((c) => catOf(c.category, 'food', 'ration') && apply(c, (d) => d - 4)); nBumps++ }
  if (delay > 0) {
    after.forEach((c) => {
      if (c.resupply_date && c.days_to_resupply != null && c.days_to_resupply === 0) apply(c, (d) => d - delay)
      else if (c.resupply_ok === false) apply(c, (d) => d - delay)
    })
    nBumps += Math.min(2, Math.floor(delay / 5))
  }
  if (fuelPct > 100) after.forEach((c) => catOf(c.category, 'fuel', 'energy', 'power') && apply(c, (d) => (d * 100) / fuelPct))
  if (gFail) after.forEach((c) => catOf(c.category, 'energy', 'power', 'generator') && apply(c, (d) => d * 0.25))
  if (storm) after.forEach((c) => catOf(c.category, 'food', 'water', 'fuel') && apply(c, (d) => d * 0.9))
  if (vUnavail) nBumps++
  if (commOut) nBumps++
  if (teamInc > 0) { after.forEach((c) => catOf(c.category, 'food', 'water') && apply(c, (d) => d * (1 - Math.min(0.3, teamInc / 40)))); nBumps++ }

  const overrun = after.reduce((acc, c) => acc + (c.status === 'critical' ? 1 : 0), 0)
  const afterRisk = bump(beforeRisk, Math.max(nBumps - (overrun >= 2 ? 1 : 0), 0))

  const actions: string[] = []
  if (delay > 0) actions.push('Trigger reserved stock and ration meal plans until resupply window.')
  if (fuelPct > 100) actions.push('Restrict vehicle use and raise generator efficiency.')
  if (gFail) actions.push('Switch to backup generator and rotate heating loads.')
  if (storm) actions.push('Hold field teams until a safe weather window reopens.')
  if (cargoLost) actions.push('Request priority airdrop of lost consumables.')
  if (vUnavail) actions.push('Assign alternate transport for logistics runs.')
  if (commOut) actions.push('Re-establish comms via backup radio/Iridium before relief moves.')

  return {
    id: 0,
    scenario,
    risk_before: beforeRisk,
    risk_after: afterRisk,
    baseline: { risk: beforeRisk, clock: base },
    result: { risk: afterRisk, clock: after, actions },
    before: { risk: beforeRisk, clock: base },
    after: { risk: afterRisk, clock: after },
    impact: { severity: afterRisk, critical_dependencies: [], mission_impact: impact },
  }
}