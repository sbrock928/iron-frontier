import { FACTION_UPGRADES, UPGRADE_DEFS, buildingLabel } from '../game/config'
import { gameBus } from '../game/events/gameBus'
import { useGameStore } from '../store/gameStore'

export function TechPanel() {
  const faction = useGameStore((state) => state.faction)
  const completed = useGameStore((state) => state.completedUpgrades)
  const research = useGameStore((state) => state.researchQueues)
  const completedSet = new Set(completed)
  const researchMap = new Map(research.map((item) => [item.upgradeKey, item]))

  return (
    <section className="sidebar-section tech-panel">
      <div className="section-title"><span>Technology</span><small>{faction === 'aegis' ? 'R&D' : faction === 'noctis' ? 'EVOLUTION' : 'ASCENSION'}</small></div>
      <div className="tech-tree">
        {FACTION_UPGRADES[faction].map((key) => {
          const def = UPGRADE_DEFS[key]
          const done = completedSet.has(key)
          const active = researchMap.get(key)
          const prereqsMet = def.prerequisites.every((item) => completedSet.has(item))
          return (
            <button className={`tech-node tier-${def.tier} ${done ? 'done' : ''}`} key={key} disabled={done || Boolean(active) || !prereqsMet} onClick={() => gameBus.emit('research-upgrade', key)}>
              <div><strong>{def.label}</strong><span>T{def.tier} · {buildingLabel(def.requiredBuilding, faction)}</span></div>
              <p>{def.description}</p>
              {active ? <><div className="queue-progress"><i style={{ width: `${Math.round(active.progress * 100)}%` }} /></div><small>RESEARCHING {Math.round(active.progress * 100)}%</small></> : <small>{done ? 'RESEARCHED' : prereqsMet ? `$${def.cost.toLocaleString()} · ${(def.researchMs / 1000).toFixed(0)}s` : 'PREREQUISITE REQUIRED'}</small>}
            </button>
          )
        })}
      </div>
    </section>
  )
}
