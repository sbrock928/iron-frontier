import type { BuildingKind, UnitKind } from '../types'
import { BUILDING_STATS, FACTION_DATA, UI_ICONS, UNIT_STATS, buildingLabel } from '../game/config'
import { gameBus } from '../game/events/gameBus'
import { useGameStore } from '../store/gameStore'

const structures: BuildingKind[] = ['power', 'refinery', 'barracks', 'warfactory', 'turret']

function BuildButton({ icon, title, subtitle, active = false, onClick }: { icon: string; title: string; subtitle: string; active?: boolean; onClick: () => void }) {
  return (
    <button className={`asset-button ${active ? 'build-active' : ''}`.trim()} aria-pressed={active} onClick={onClick}>
      <img src={icon} alt="" aria-hidden="true" />
      <div><strong>{title}</strong><span>{subtitle}</span></div>
    </button>
  )
}

function UnitGrid({ title, hint, units }: { title: string; hint: string; units: UnitKind[] }) {
  return (
    <>
      <h3>{title}</h3>
      <p className="muted tech-note">{hint}</p>
      <div className="build-grid">
        {units.map((kind) => {
          const item = UNIT_STATS[kind]
          return <BuildButton key={kind} icon={UI_ICONS[kind]} title={item.label} subtitle={`$${item.cost.toLocaleString()}`} onClick={() => gameBus.emit('produce-unit', kind)} />
        })}
      </div>
    </>
  )
}

export function BuildPanel() {
  const placementKind = useGameStore((state) => state.placementKind)
  const faction = useGameStore((state) => state.faction)
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
    </section>
  )
}
