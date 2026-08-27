import type { BuildingKind, UnitKind } from '../types'
import { BUILDING_STATS, FACTION_DATA, UI_ICONS, UNIT_STATS, buildingLabel, isUnitUnlocked } from '../game/config'
import { gameBus } from '../game/events/gameBus'
import { useGameStore } from '../store/gameStore'

const structures: BuildingKind[] = ['power', 'refinery', 'barracks', 'warfactory', 'turret']

function BuildButton({ icon, title, subtitle, active = false, disabled = false, onClick }: { icon: string; title: string; subtitle: string; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button className={`asset-button ${active ? 'build-active' : ''}`.trim()} aria-pressed={active} disabled={disabled} onClick={onClick}>
      <img src={icon} alt="" aria-hidden="true" />
      <div><strong>{title}</strong><span>{subtitle}</span></div>
    </button>
  )
}

function UnitGrid({ title, hint, units }: { title: string; hint: string; units: UnitKind[] }) {
  const completedUpgrades = useGameStore((state) => state.completedUpgrades)
  const completed = new Set(completedUpgrades)
  return (
    <>
      <h3>{title}</h3>
      <p className="muted tech-note">{hint}</p>
      <div className="build-grid">
        {units.map((kind) => {
          const item = UNIT_STATS[kind]
          const unlocked = isUnitUnlocked(kind, completed)
          return <BuildButton key={kind} icon={UI_ICONS[kind]} title={item.label} subtitle={unlocked ? `$${item.cost.toLocaleString()}` : 'TECH LOCKED'} disabled={!unlocked} onClick={() => gameBus.emit('produce-unit', kind)} />
        })}
      </div>
    </>
  )
}

export function BuildPanel() {
  const placementKind = useGameStore((state) => state.placementKind)
  const faction = useGameStore((state) => state.faction)
  const queues = useGameStore((state) => state.productionQueues)
  const data = FACTION_DATA[faction]

  return (
    <section className="sidebar-section">
      <div className="section-title"><span>Production</span><small>{data.shortName} FORGE</small></div>
      <h3>Structures</h3>
      <div className="build-grid">
        {structures.map((kind) => {
          const item = BUILDING_STATS[kind]
          const active = placementKind === kind
          const title = buildingLabel(kind, faction)
          return <BuildButton key={kind} icon={faction === 'noctis' ? `/assets/ui/alien_${kind}_icon.png` : UI_ICONS[kind]} title={active ? `PLACE ${title}` : title} subtitle={active ? 'CLICK MAP' : `$${item.cost.toLocaleString()}`} active={active} onClick={() => gameBus.emit('build-structure', kind)} />
        })}
      </div>
      {placementKind && <p className="placement-help">Move onto the battlefield and left-click to place. Esc or right-click cancels.</p>}
      <UnitGrid title={faction === 'aegis' ? 'Barracks Tech' : 'Spawn Pit Brood'} hint={faction === 'aegis' ? 'Infantry and support troops.' : 'Fast biological assault organisms.'} units={data.infantry} />
      <UnitGrid title={faction === 'aegis' ? 'War Factory Tech' : 'Gene Forge Brood'} hint={faction === 'aegis' ? 'Armor, aircraft and economy units.' : 'Heavy organisms, fliers and extractor drones.'} units={data.factory} />

      <div className="section-title queue-title"><span>Live Queues</span><small>{queues.length} ACTIVE</small></div>
      {queues.length === 0 ? <p className="muted">Production buildings are idle.</p> : queues.map((queue) => (
        <div className="production-queue" key={queue.buildingId}>
          <div className="queue-head"><strong>{queue.buildingLabel}</strong><span>{queue.activeLabel}</span></div>
          <div className="queue-progress"><i style={{ width: `${Math.round(queue.progress * 100)}%` }} /></div>
          <div className="queue-foot"><span>{Math.round(queue.progress * 100)}%</span><span>{queue.queuedKinds.length} waiting</span><button onClick={() => gameBus.emit('cancel-production', queue.buildingId)}>Cancel</button></div>
        </div>
      ))}
    </section>
  )
}
