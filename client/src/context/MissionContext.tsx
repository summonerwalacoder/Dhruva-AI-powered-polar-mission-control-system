import { createContext, useContext, useEffect, useState } from 'react'
import { api, getCachedUser } from '../lib/api'
import { getCachedValue } from '../lib/offline'
import type { User, MissionSummary } from '../lib/types'
import { can } from '../lib/perms'

interface MissionState {
  /** missions visible to this user (loaded lazily) */
  missions: MissionSummary[]
  /** currently selected mission id (persisted) */
  selectedId: number | null
  selected: MissionSummary | null
  setSelected: (id: number) => void
  setMissions: (ms: MissionSummary[]) => void
  needMission: boolean
}

const M = createContext<MissionState>(null as unknown as MissionState)
export const useMission = () => useContext(M)

const KEY = 'dhruva_mission'

export function defaultMissionFor(user: User | null, missions: MissionSummary[]): MissionSummary | null {
  if (!user || !missions.length) return null
  const stored = Number(localStorage.getItem(KEY))
  const byStored = missions.find((m) => m.id === stored)
  if (byStored) return byStored
  const byUser = missions.find((m) => m.id === user.mission_id)
  if (byUser) return byUser
  const active = missions.find((m) => m.status === 'active')
  return active || missions[0]
}

export function MissionProvider({ children }: { children: React.ReactNode }) {
  const user = getCachedUser<User>()
  const [missions, setMissions] = useState<MissionSummary[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)

  useEffect(() => {
    const d = defaultMissionFor(user, missions)
    if (d) setSelectedId(d.id)
  }, [missions])

  // Load the mission list centrally so the mission selector is available on
  // every page immediately after login (not only Dashboard/Missions).
  useEffect(() => {
    if (!user) return
    let on = true
    const load = async () => {
      try {
        const ms = await api<MissionSummary[]>('/api/missions')
        if (on && Array.isArray(ms)) setMissions(ms)
      } catch {
        const cached = await getCachedValue<MissionSummary[]>('/api/missions')
        if (on && Array.isArray(cached)) setMissions(cached)
      }
    }
    load()
    return () => {
      on = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selected = missions.find((m) => m.id === selectedId) || null

  return (
    <M.Provider
      value={{
        missions,
        selectedId,
        selected,
        setSelected: (id) => {
          localStorage.setItem(KEY, String(id))
          setSelectedId(id)
        },
        setMissions,
        needMission: can(user?.role, 'mission:read'),
      }}
    >
      {children}
    </M.Provider>
  )
}