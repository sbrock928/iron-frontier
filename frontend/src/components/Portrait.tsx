import { BUILDING_STATS, UNIT_STATS, portraitFor } from '../game/config'
import type { BuildingKind, SelectedEntity, UnitKind } from '../types'

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="portrait-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

/**
 * Combat stats for the portrait, read from the static stat tables by kind
 * rather than shipped on every selection payload — they never change at
 * runtime, so duplicating them across the event bus 10x/second would be waste.
 *
 * Only stats the simulation genuinely models are listed. There is deliberately
 * no armour/energy/kill-count row: those systems do not exist, and a HUD that
 * displays numbers the game does not track is worse than one that omits them.
 */
function combatStats(entity: SelectedEntity): { label: string; value: string }[] {
  if (entity.kind in UNIT_STATS) {
    const stats = UNIT_STATS[entity.kind as UnitKind]
    const dps = stats.damage > 0 ? (stats.damage / (stats.cooldown / 1000)).toFixed(1) : null
    return [
      ...(dps ? [{ label: 'DPS', value: dps }] : []),
      ...(stats.damage > 0 ? [{ label: 'RNG', value: String(Math.round(stats.range)) }] : []),
      { label: 'SPD', value: String(Math.round(stats.speed)) },
    ]
  }

  const stats = BUILDING_STATS[entity.kind as BuildingKind]
  const weapon = stats.weapon
  return [
    ...(weapon ? [{ label: 'DPS', value: (weapon.damage / (weapon.cooldown / 1000)).toFixed(1) }] : []),
    ...(weapon ? [{ label: 'RNG', value: String(Math.round(weapon.range)) }] : []),
    ...(stats.power !== 0 ? [{ label: 'PWR', value: stats.power > 0 ? `+${stats.power}` : String(stats.power) }] : []),
  ]
}

/**
 * The primary selection's portrait and vitals, occupying the left of the
 * console's centre section.
 */
export function Portrait({ entity, extraCount }: { entity: SelectedEntity | null; extraCount: number }) {
  if (!entity) {
    return (
      <div className="portrait-frame portrait-empty">
        <span>NO SELECTION</span>
      </div>
    )
  }

  const healthPercent = Math.max(0, Math.min(100, Math.round((entity.hp / entity.maxHp) * 100)))
  const shieldPercent = entity.maxShield
    ? Math.max(0, Math.min(100, Math.round(((entity.shield ?? 0) / entity.maxShield) * 100)))
    : null

  return (
    <div className="portrait-frame">
      <img className="portrait-art" src={portraitFor(entity)} alt="" aria-hidden="true" />
      <div className="portrait-meta">
        <strong className="portrait-name">{entity.label}</strong>
        {extraCount > 0 && <span className="portrait-extra">+{extraCount} more selected</span>}

        {shieldPercent !== null && (
          <div className="vital-track shield-track" role="img" aria-label={`Shields ${shieldPercent}%`}>
            <i style={{ width: `${shieldPercent}%` }} />
          </div>
        )}
        <div className="vital-track health-track" role="img" aria-label={`Health ${healthPercent}%`}>
          <i style={{ width: `${healthPercent}%` }} />
        </div>

        <div className="portrait-stats">
          <StatRow label="HP" value={`${entity.hp} / ${entity.maxHp}`} />
          {entity.maxShield ? <StatRow label="SH" value={`${entity.shield ?? 0} / ${entity.maxShield}`} /> : null}
          {combatStats(entity).map((stat) => <StatRow key={stat.label} label={stat.label} value={stat.value} />)}
        </div>
      </div>
    </div>
  )
}
