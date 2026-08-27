import { useEffect, useState } from 'react'
import { getMission, getMissions } from './api/client'
import { BuildPanel } from './components/BuildPanel'
import { CommandPanel } from './components/CommandPanel'
import { GameCanvas } from './components/GameCanvas'
import { MissionPanel } from './components/MissionPanel'
import { SelectionPanel } from './components/SelectionPanel'
import { StatusBar } from './components/StatusBar'
import { TopBar } from './components/TopBar'
import { TechPanel } from './components/TechPanel'
import { useGameStore } from './store/gameStore'
import type { Faction, Mission } from './types'

export default function App() {
  const [mission, setMission] = useState<Mission | null>(null)
  const [missionId, setMissionId] = useState('mission_01')
  const faction = useGameStore((state) => state.faction)
  const setFaction = useGameStore((state) => state.setFaction)
  const setStoreMission = useGameStore((state) => state.setMission)
  const setMissionCatalog = useGameStore((state) => state.setMissionCatalog)
  const setStatus = useGameStore((state) => state.setStatus)

  useEffect(() => {
    let cancelled = false
    getMissions()
      .then((loaded) => {
        if (cancelled) return
        setMissionCatalog(loaded)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const message = error instanceof Error ? error.message : 'Unknown API error'
        setStatus('error', `Could not load missions: ${message}`)
      })
    return () => { cancelled = true }
  }, [setMissionCatalog, setStatus])

  useEffect(() => {
    let cancelled = false
    setStatus('loading', 'Loading mission…')
    getMission(missionId)
      .then((loaded) => {
        if (cancelled) return
        setMission(loaded)
        setStoreMission(loaded)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const message = error instanceof Error ? error.message : 'Unknown API error'
        setStatus('error', `Could not load mission: ${message}`)
      })
    return () => { cancelled = true }
  }, [missionId, setStatus, setStoreMission])

  const handleFactionChange = (nextFaction: Faction) => {
    setFaction(nextFaction)
    setStatus('loading', 'Reinitializing battlefield for selected race…')
  }

  return (
    <main className={`app-shell faction-${faction}`}>
      <TopBar />
      <div className="workspace">
        <div className="battlefield-frame">
          {mission ? <GameCanvas key={`${mission.id}-${faction}`} mission={mission} faction={faction} /> : <div className="loading-screen"><strong>IRON FRONTIER</strong><span>Connecting to command network…</span></div>}
          <StatusBar />
        </div>
        <aside className="sidebar">
          <BuildPanel />
          <SelectionPanel />
          <TechPanel />
          <MissionPanel missionId={missionId} faction={faction} onMissionChange={setMissionId} onFactionChange={handleFactionChange} />
          <CommandPanel />
        </aside>
      </div>
    </main>
  )
}
