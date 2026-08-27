import { useCallback, useEffect, useMemo, useState } from 'react'
import { getMissions, listSaves } from './api/client'
import { CommandConsole } from './components/CommandConsole'
import { GameCanvas } from './components/GameCanvas'
import { MainMenu } from './components/MainMenu'
import { MissionOverlay } from './components/MissionOverlay'
import { TopBar } from './components/TopBar'
import { defaultEnemyFaction } from './game/config'
import { useGameStore } from './store/gameStore'
import type { Difficulty, Faction, SaveGame } from './types'

export default function App() {
  const [screen, setScreen] = useState<'menu' | 'game'>('menu')
  const [missionId, setMissionId] = useState('mission_01')
  const [playerFaction, setPlayerFaction] = useState<Faction>('aegis')
  const [enemyFaction, setEnemyFaction] = useState<Faction>('noctis')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [saves, setSaves] = useState<SaveGame[]>([])

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

  /*
   * Saves are refreshed whenever we land on the menu, so a quick-save made
   * during a match shows up as soon as the player backs out. A failed fetch is
   * intentionally silent: the deployment log is a convenience, and blocking the
   * menu on it would be worse than simply not offering it.
   */
  const refreshSaves = useCallback(() => {
    listSaves()
      .then(setSaves)
      .catch(() => setSaves([]))
  }, [])

  useEffect(() => {
    if (screen === 'menu') refreshSaves()
  }, [refreshSaves, screen])

  const changePlayerFaction = (faction: Faction) => {
    setPlayerFaction(faction)
    if (enemyFaction === faction) setEnemyFaction(defaultEnemyFaction(faction))
  }

  /** Restore a slot's matchup into the menu selectors; the player still presses Deploy. */
  const restoreSave = (save: SaveGame) => {
    setMissionId(save.mission_id)
    setPlayerFaction(save.payload.faction)
    setEnemyFaction(save.payload.enemy_faction)
    setDifficulty(save.payload.difficulty)
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
        saves={saves}
        onMissionChange={setMissionId}
        onPlayerFactionChange={changePlayerFaction}
        onEnemyFactionChange={setEnemyFaction}
        onDifficultyChange={setDifficulty}
        onRestore={restoreSave}
        onStart={deploy}
      />
    )
  }

  return (
    <main className={`app-shell faction-${playerFaction}`}>
      <TopBar />
      <div className="battlefield-frame">
        {mission ? (
          <GameCanvas
            key={`${mission.id}-${playerFaction}-${enemyFaction}-${difficulty}`}
            mission={mission}
            faction={playerFaction}
            enemyFaction={enemyFaction}
            difficulty={difficulty}
          />
        ) : (
          <div className="loading-screen">
            <strong>IRON FRONTIER</strong>
            <span>Connecting to command network…</span>
          </div>
        )}
        <MissionOverlay />
      </div>
      <CommandConsole onExitToMenu={returnToMenu} />
    </main>
  )
}
