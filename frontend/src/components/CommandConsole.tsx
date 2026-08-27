import { useMemo } from 'react'
import { gameBus } from '../game/events/gameBus'
import { useGameStore } from '../store/gameStore'
import { AlertLog } from './AlertLog'
import { CommandCard } from './CommandCard'
import { Minimap } from './Minimap'
import { Portrait } from './Portrait'
import { ProductionStrip } from './ProductionStrip'
import { SelectionStrip } from './SelectionStrip'

/**
 * The bottom command console: minimap on the left, selection readout and alert
 * log in the centre, command card on the right.
 *
 * This replaces the previous right-hand scrolling sidebar. A fixed-height
 * console keeps every control in a constant screen position and gives the
 * battlefield the full width of the window, which is what makes an RTS HUD
 * usable at speed.
 */
export function CommandConsole({ onExitToMenu }: { onExitToMenu: () => void }) {
  const selected = useGameStore((state) => state.selected)
  const controlGroups = useGameStore((state) => state.controlGroups)
  const groupNumbers = useMemo(() => Array.from({ length: 9 }, (_, index) => index + 1), [])

  return (
    <section className="command-console" aria-label="Command console">
      <div className="console-cell console-minimap">
        <Minimap />
        <div className="control-group-bar">
          {groupNumbers.map((group) => {
            const size = controlGroups[group]
            return (
              <button
                key={group}
                className={`control-group-badge ${size ? 'has-members' : ''}`.trim()}
                disabled={!size}
                title={size ? `Recall group ${group} (${size} unit${size === 1 ? '' : 's'})` : `Group ${group} is empty`}
                onClick={() => gameBus.emit('recall-control-group', group)}
              >
                <span>{group}</span>
                {size ? <small>{size}</small> : null}
              </button>
            )
          })}
        </div>
      </div>

      <div className="console-cell console-center">
        <Portrait entity={selected[0] ?? null} extraCount={Math.max(0, selected.length - 1)} />
        <SelectionStrip selected={selected} />
        <div className="console-feeds">
          <ProductionStrip />
          <AlertLog />
        </div>
      </div>

      <div className="console-cell console-command">
        <CommandCard />
        <div className="console-system-row">
          <button onClick={() => gameBus.emit('restart-game', undefined)}>Restart</button>
          <button onClick={onExitToMenu}>Main Menu</button>
        </div>
      </div>
    </section>
  )
}
