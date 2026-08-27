import { UI_ICONS, UNIT_STATS } from '../game/config'
import { gameBus } from '../game/events/gameBus'
import { useGameStore } from '../store/gameStore'

/** Upcoming icons shown per queue before collapsing into a "+N" counter. */
const VISIBLE_QUEUE_ICONS = 4

/**
 * Compact live view of every production and research queue.
 *
 * The command card only shows what can be ordered right now, so without this
 * the player would have no way to see what is already being built or how far
 * along it is — information the old sidebar carried and that is needed to make
 * any production decision.
 */
export function ProductionStrip() {
  const productionQueues = useGameStore((state) => state.productionQueues)
  const researchQueues = useGameStore((state) => state.researchQueues)

  if (productionQueues.length === 0 && researchQueues.length === 0) {
    return <div className="production-strip is-empty">Production idle</div>
  }

  return (
    <div className="production-strip" aria-label="Active production">
      {productionQueues.map((queue) => {
        const shown = queue.queuedKinds.slice(0, VISIBLE_QUEUE_ICONS)
        const overflow = queue.queuedKinds.length - shown.length
        return (
          <div className="production-item" key={queue.buildingId}>
            <div className="production-head">
              <strong>{queue.activeLabel}</strong>
              <button title="Cancel current order" onClick={() => gameBus.emit('cancel-production', queue.buildingId)}>
                ✕
              </button>
            </div>
            <div className="production-bar">
              <i style={{ width: `${Math.round(queue.progress * 100)}%` }} />
            </div>
            <div className="production-upcoming">
              {shown.map((kind, index) => (
                <img key={`${kind}-${index}`} src={UI_ICONS[kind]} alt={UNIT_STATS[kind].label} title={UNIT_STATS[kind].label} />
              ))}
              {overflow > 0 && <span>+{overflow}</span>}
            </div>
          </div>
        )
      })}

      {researchQueues.map((queue) => (
        <div className="production-item is-research" key={`${queue.buildingId}-${queue.upgradeKey}`}>
          <div className="production-head">
            <strong>{queue.label}</strong>
          </div>
          <div className="production-bar">
            <i style={{ width: `${Math.round(queue.progress * 100)}%` }} />
          </div>
          <div className="production-upcoming">
            <span>RESEARCH</span>
          </div>
        </div>
      ))}
    </div>
  )
}
