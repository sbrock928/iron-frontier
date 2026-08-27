import { FACTION_DATA } from '../game/config'
import { useGameStore } from '../store/gameStore'
import type { Faction } from '../types'

export function MissionPanel({
  missionId,
  faction,
  onMissionChange,
  onFactionChange,
}: {
  missionId: string
  faction: Faction
  onMissionChange: (id: string) => void
  onFactionChange: (faction: Faction) => void
}) {
  const mission = useGameStore((state) => state.mission)
  const missions = useGameStore((state) => state.missions)
  return (
    <section className="sidebar-section mission-panel">
      <div className="section-title"><span>Scenario</span><small>COMMAND</small></div>
      <label className="mission-picker">
        <span>Playable race</span>
        <select value={faction} onChange={(event) => onFactionChange(event.target.value as Faction)}>
          {(Object.keys(FACTION_DATA) as Faction[]).map((key) => <option key={key} value={key}>{FACTION_DATA[key].name}</option>)}
        </select>
      </label>
      <label className="mission-picker">
        <span>Mission / skirmish</span>
        <select value={missionId} onChange={(event) => onMissionChange(event.target.value)}>
          {missions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <p className="muted tech-note">Playing as <strong>{FACTION_DATA[faction].name}</strong>. Changing race immediately restarts the battlefield with that faction's roster and structures.</p>
      <p className="muted tech-note">{mission?.description}</p>
      <div className="section-title objective-title"><span>Objectives</span><small>MISSION</small></div>
      {mission?.definition.objectives.map((objective, index) => (
        <div className="objective" key={objective.id}><b>{String(index + 1).padStart(2, '0')}</b><span>{objective.label}</span></div>
      ))}
    </section>
  )
}
