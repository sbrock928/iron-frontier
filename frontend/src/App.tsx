import { useEffect, useMemo, useState } from 'react'
import { getMissions } from './api/client'
import { BuildPanel } from './components/BuildPanel'
import { CommandPanel } from './components/CommandPanel'
import { GameCanvas } from './components/GameCanvas'
import { MainMenu } from './components/MainMenu'
import { MissionPanel } from './components/MissionPanel'
import { SelectionPanel } from './components/SelectionPanel'
import { StatusBar } from './components/StatusBar'
import { TechPanel } from './components/TechPanel'
import { TopBar } from './components/TopBar'
import { defaultEnemyFaction } from './game/config'
import { useGameStore } from './store/gameStore'
import type { Difficulty, Faction } from './types'

export default function App() {
  const [screen, setScreen] = useState<'menu' | 'game'>('menu')
  const [missionId, setMissionId] = useState('mission_01')
  const [playerFaction, setPlayerFaction] = useState<Faction>('aegis')
  const [enemyFaction, setEnemyFaction] = useState<Faction>('noctis')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')

  const missions = useGameStore((state) => state.missions)
  const setMissionCatalog = useGameStore((state) => state.setMissionCatalog)
  const setStoreMission = useGameStore((state) => state.setMission)
  const setFaction = useGameStore((state) => state.setFaction)
  const setStoreEnemyFaction = useGameStore((state) => state.setEnemyFaction)
  const setStoreDifficulty = useGameStore((state) => state.setDifficulty)
  const setStatus = useGameStore((state) => state.setStatus)
  const resetBattleState = useGameStore((state) => state.resetBattleState)

  useEffect(() => {
    let cancelled = false
    getMissions()
      .then((loaded) => {
        if (cancelled) return
        setMissionCatalog(loaded)
        if (loaded.length > 0 && !loaded.some((item) => item.id === missionId)) setMissionId(loaded[0]?.id ?? 'mission_01')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const message = error instanceof Error ? error.message : 'Unknown API error'
        setStatus('error', `Could not load missions: ${message}`)
      })
    return () => { cancelled = true }
  }, [missionId, setMissionCatalog, setStatus])

  const mission = useMemo(() => missions.find((item) => item.id === missionId) ?? missions[0] ?? null, [missionId, missions])

  const changePlayerFaction = (faction: Faction) => {
    setPlayerFaction(faction)
    if (enemyFaction === faction) setEnemyFaction(defaultEnemyFaction(faction))
  }

  const deploy = () => {
    if (!mission) return
    setFaction(playerFaction)
    setStoreEnemyFaction(enemyFaction)
    setStoreDifficulty(difficulty)
    setStoreMission(mission)
    setStatus('loading', 'Deploying forces…')
    setScreen('game')
  }

  const returnToMenu = () => {
    resetBattleState()
    setScreen('menu')
  }

  if (screen === 'menu') {
    return (
      <MainMenu
        missions={missions}
        missionId={missionId}
        playerFaction={playerFaction}
        enemyFaction={enemyFaction}
        difficulty={difficulty}
        onMissionChange={setMissionId}
        onPlayerFactionChange={changePlayerFaction}
        onEnemyFactionChange={setEnemyFaction}
        onDifficultyChange={setDifficulty}
        onStart={deploy}
      />
    )
  }

  return (
    <main className={`app-shell faction-${playerFaction}`}>
      <TopBar />
      <div className="workspace">
        <div className="battlefield-frame">
          {mission ? <GameCanvas key={`${mission.id}-${playerFaction}-${enemyFaction}-${difficulty}`} mission={mission} faction={playerFaction} enemyFaction={enemyFaction} difficulty={difficulty} /> : <div className="loading-screen"><strong>IRON FRONTIER</strong><span>Connecting to command network…</span></div>}
          <StatusBar />
        </div>
        <aside className="sidebar">
          <BuildPanel />
          <SelectionPanel />
          <TechPanel />
          <MissionPanel />
          <CommandPanel onExitToMenu={returnToMenu} />
        </aside>
      </div>
    </main>
  )
}
