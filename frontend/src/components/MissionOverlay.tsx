import { DIFFICULTY_DATA, FACTION_DATA } from '../game/config'
import { useGameStore } from '../store/gameStore'

/**
 * Mission briefing and objectives, shown as a collapsible overlay on the
 * battlefield rather than as a permanent panel. Objectives are reference
 * material a player consults occasionally, so they should not permanently
 * consume console space the way they did in the old sidebar.
 */
export function MissionOverlay() {
  const mission = useGameStore((state) => state.mission)
  const faction = useGameStore((state) => state.faction)
  const enemyFaction = useGameStore((state) => state.enemyFaction)
  const difficulty = useGameStore((state) => state.difficulty)

  if (!mission) return null

  return (
    <details className="mission-overlay">
      <summary>
        <span>Objectives</span>
        <small>{DIFFICULTY_DATA[difficulty].label.toUpperCase()}</small>
      </summary>
      <div className="mission-overlay-body">
        <div className="matchup-line">
          <span>{FACTION_DATA[faction].shortName}</span>
          <b>VS</b>
          <span>{FACTION_DATA[enemyFaction].shortName}</span>
        </div>
        <p className="muted">
          <strong>{mission.name}</strong> — {mission.description}
        </p>
        {mission.definition.objectives.map((objective, index) => (
          <div className="objective" key={objective.id}>
            <b>{String(index + 1).padStart(2, '0')}</b>
            <span>{objective.label}</span>
          </div>
        ))}
      </div>
    </details>
  )
}
