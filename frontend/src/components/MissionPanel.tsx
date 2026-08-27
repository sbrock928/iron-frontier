import { DIFFICULTY_DATA, FACTION_DATA } from '../game/config'
import { useGameStore } from '../store/gameStore'

export function MissionPanel() {
  const mission = useGameStore((state) => state.mission)
  const faction = useGameStore((state) => state.faction)
  const enemyFaction = useGameStore((state) => state.enemyFaction)
  const difficulty = useGameStore((state) => state.difficulty)
  return (
    <section className="sidebar-section mission-panel">
      <div className="section-title"><span>Battle Data</span><small>{DIFFICULTY_DATA[difficulty].label.toUpperCase()}</small></div>
      <div className="matchup-line"><span>{FACTION_DATA[faction].shortName}</span><b>VS</b><span>{FACTION_DATA[enemyFaction].shortName}</span></div>
      <p className="muted tech-note"><strong>{mission?.name}</strong> — {mission?.description}</p>
      <div className="section-title objective-title"><span>Objectives</span><small>MISSION</small></div>
      {mission?.definition.objectives.map((objective, index) => (
        <div className="objective" key={objective.id}><b>{String(index + 1).padStart(2, '0')}</b><span>{objective.label}</span></div>
      ))}
    </section>
  )
}
