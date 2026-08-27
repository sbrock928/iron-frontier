import { portraitFor } from '../game/config'
import { gameBus } from '../game/events/gameBus'
import type { SelectedEntity } from '../types'

/**
 * How many selection wireframes are shown. Matching StarCraft's cap keeps the
 * strip a fixed size, so it never reflows the console mid-battle.
 */
const MAX_WIREFRAMES = 12

/**
 * The selection strip: one small health-tinted wireframe per selected entity.
 * Clicking one isolates it; shift-clicking drops it from the selection, which
 * is how a player peels a damaged unit out of a group without reselecting.
 */
export function SelectionStrip({ selected }: { selected: SelectedEntity[] }) {
  if (selected.length <= 1) return <div className="selection-strip is-empty" />

  const shown = selected.slice(0, MAX_WIREFRAMES)
  const overflow = selected.length - shown.length

  return (
    <div className="selection-strip" role="listbox" aria-label="Current selection">
      {shown.map((entity) => {
        const healthPercent = Math.max(0, Math.min(100, Math.round((entity.hp / entity.maxHp) * 100)))
        const hurt = healthPercent <= 33 ? 'critical' : healthPercent <= 66 ? 'hurt' : 'healthy'
        return (
          <button
            key={entity.id}
            className={`selection-chip health-${hurt}`}
            title={`${entity.label} — ${entity.hp}/${entity.maxHp}. Click to isolate, shift-click to remove.`}
            onClick={(event) => {
              if (event.shiftKey) gameBus.emit('selection-remove', entity.id)
              else gameBus.emit('selection-isolate', entity.id)
            }}
          >
            <img src={portraitFor(entity)} alt={entity.label} />
            <i className="chip-health" style={{ width: `${healthPercent}%` }} />
          </button>
        )
      })}
      {overflow > 0 && <span className="selection-overflow">+{overflow}</span>}
    </div>
  )
}
