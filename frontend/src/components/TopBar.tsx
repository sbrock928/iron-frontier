import { FACTION_DATA } from '../game/config'
import { useGameStore } from '../store/gameStore'

export function TopBar() {
  const { mission, credits, powerUsed, powerCapacity, faction, enemyFaction } = useGameStore()
  const lowPower = powerUsed > powerCapacity
  const friendly = FACTION_DATA[faction]
  const hostile = FACTION_DATA[enemyFaction]
  return (
    <header className="topbar">
      <div className="brand">
        <img className="faction-emblem" src={friendly.emblem} alt="" aria-hidden="true" />
        <div>
          <strong>IRON FRONTIER</strong>
          <small>{friendly.name.toUpperCase()} // {mission?.name ?? 'Loading mission'}</small>
        </div>
      </div>
      <div className="hostile-tag" aria-label={`Hostile faction ${hostile.name}`}>
        <span>HOSTILE</span>
        <img src={hostile.emblem} alt="" aria-hidden="true" />
        <strong>{hostile.name.toUpperCase()}</strong>
      </div>
      <div className="resource-strip">
        <div><span>Credits</span><strong>${credits.toLocaleString()}</strong></div>
        <div className={lowPower ? 'danger' : ''}><span>Power</span><strong>{powerUsed} / {powerCapacity}</strong></div>
      </div>
    </header>
  )
}
