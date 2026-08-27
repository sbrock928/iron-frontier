import { useEffect, useRef } from 'react'
import { gameBus } from '../game/events/gameBus'
import { useGameStore } from '../store/gameStore'

/** Newest alerts are shown first, capped so the log never grows past its panel. */
const VISIBLE_ALERTS = 6

/**
 * Rolling log of recent notifications. This replaces the old single-line status
 * bar, which could only ever display the most recent message — anything that
 * happened while the player was reading was silently lost.
 *
 * Alerts carrying a world position are clickable and jump the camera there,
 * which is how a player responds to an event off-screen.
 */
export function AlertLog() {
  const alerts = useGameStore((state) => state.alerts)
  const status = useGameStore((state) => state.status)
  const message = useGameStore((state) => state.message)
  const listRef = useRef<HTMLUListElement | null>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 })
  }, [alerts])

  const recent = alerts.slice(-VISIBLE_ALERTS).reverse()
  const terminal = status === 'victory' || status === 'defeat' || status === 'error'

  return (
    <div className="alert-log">
      {terminal && (
        <div className={`alert-banner alert-${status}`}>
          <strong>{status.toUpperCase()}</strong>
          <span>{message}</span>
        </div>
      )}
      <ul ref={listRef} aria-live="polite" aria-label="Recent alerts">
        {recent.length === 0 && <li className="alert-idle">All quiet.</li>}
        {recent.map((alert) => {
          const target = alert.at_world
          return (
            <li key={alert.id} className={`alert-row alert-${alert.severity}`}>
              {target ? (
                <button onClick={() => gameBus.emit('jump-to-world', target)} title="Jump to location">
                  {alert.message}
                </button>
              ) : (
                <span>{alert.message}</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
