import { useEffect, useMemo, useState } from 'react'
import { UI_ICONS, UPGRADE_DEFS, buildingLabel } from '../game/config'
import { gameBus } from '../game/events/gameBus'
import { ORDER_HOTKEYS } from '../game/hotkeys'
import { useGameStore } from '../store/gameStore'
import type { BuildingKind, UpgradeKey } from '../types'

const PANEL_ID = 'research-panel-body'

/**
 * A persistent technology entry point that is independent of unit selection.
 * Research is strategic, global information; keeping the full tree in this
 * panel prevents it from displacing immediate unit orders in the command card.
 */
export function ResearchPanel() {
  const [open, setOpen] = useState(false)
  const faction = useGameStore((state) => state.faction)
  const credits = useGameStore((state) => state.credits)
  const completedUpgrades = useGameStore((state) => state.completedUpgrades)
  const researchQueues = useGameStore((state) => state.researchQueues)
  const ownedBuildingKinds = useGameStore((state) => state.ownedBuildingKinds)

  const completed = useMemo(() => new Set<UpgradeKey>(completedUpgrades), [completedUpgrades])
  const owned = useMemo(() => new Set<BuildingKind>(ownedBuildingKinds), [ownedBuildingKinds])
  const queued = useMemo(
    () => new Map(researchQueues.map((queue) => [queue.upgradeKey, queue])),
    [researchQueues],
  )
  const upgrades = useMemo(
    () => Object.values(UPGRADE_DEFS)
      .filter((definition) => definition.faction === faction)
      .sort((a, b) => a.tier - b.tier || a.label.localeCompare(b.label)),
    [faction],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return

      if (event.key.toUpperCase() === ORDER_HOTKEYS.research) {
        setOpen((current) => !current)
        event.preventDefault()
      } else if (event.key === 'Escape' && open) {
        setOpen(false)
        event.preventDefault()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  const completeCount = upgrades.filter((definition) => completed.has(definition.key)).length
  const tabTooltip = [
    open ? 'Close research' : 'Open research',
    'View the faction technology tree, requirements, costs, and active progress.',
    `Hotkey: ${ORDER_HOTKEYS.research}`,
  ].join('\n')

  return (
    <aside className={`research-panel ${open ? 'is-open' : ''}`} aria-label="Technology research">
      <button
        className="research-tab"
        type="button"
        aria-expanded={open}
        aria-controls={PANEL_ID}
        data-tooltip={tabTooltip}
        title={tabTooltip}
        onClick={() => setOpen((current) => !current)}
      >
        <img src={UI_ICONS.techlab} alt="" aria-hidden="true" />
        <span>Research</span>
        <small>{completeCount}/{upgrades.length}</small>
        {researchQueues.length > 0 ? <i aria-label={`${researchQueues.length} active`}>{researchQueues.length}</i> : null}
      </button>

      {open && (
        <div className="research-panel-body" id={PANEL_ID}>
          <header>
            <div>
              <strong>Technology tree</strong>
              <span>{completeCount} of {upgrades.length} complete</span>
            </div>
            <button
              type="button"
              className="research-close"
              aria-label="Close research"
              data-tooltip="Close research panel\nHotkey: Escape or R"
              title="Close research panel — Escape or R"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </header>

          <div className="research-list">
            {upgrades.map((definition) => {
              const isComplete = completed.has(definition.key)
              const activeQueue = queued.get(definition.key)
              const missingPrerequisites = definition.prerequisites.filter((key) => !completed.has(key))
              const hasBuilding = owned.has(definition.requiredBuilding)
              const affordable = credits >= definition.cost
              const requiredBuilding = buildingLabel(definition.requiredBuilding, faction)
              const prerequisiteLabels = definition.prerequisites.map((key) => UPGRADE_DEFS[key].label)
              const reason = isComplete
                ? 'Research complete'
                : activeQueue
                  ? `Researching — ${Math.round(activeQueue.progress * 100)}% complete`
                  : !hasBuilding
                    ? `Requires ${requiredBuilding}`
                    : missingPrerequisites.length > 0
                      ? `Requires ${missingPrerequisites.map((key) => UPGRADE_DEFS[key].label).join(', ')}`
                      : !affordable
                        ? 'Insufficient credits'
                        : null
              const tooltip = [
                definition.label,
                definition.description,
                `Tier ${definition.tier} · $${definition.cost.toLocaleString()} · ${(definition.researchMs / 1000).toFixed(0)} seconds`,
                `Structure: ${requiredBuilding}`,
                prerequisiteLabels.length > 0 ? `Prerequisites: ${prerequisiteLabels.join(', ')}` : 'Prerequisites: none',
                reason ?? 'Available to research',
              ].join('\n')

              return (
                <button
                  className={`research-item ${isComplete ? 'is-complete' : ''} ${activeQueue ? 'is-active' : ''}`.trim()}
                  type="button"
                  key={definition.key}
                  disabled={reason !== null}
                  data-tooltip={tooltip}
                  title={tooltip}
                  onClick={() => gameBus.emit('research-upgrade', definition.key)}
                >
                  <span className="research-item-icon">
                    <img src={UI_ICONS.techlab} alt="" aria-hidden="true" />
                    <b>T{definition.tier}</b>
                  </span>
                  <span className="research-item-copy">
                    <strong>{definition.label}</strong>
                    <small>{definition.description}</small>
                    <em>{reason ?? `${requiredBuilding} · ${(definition.researchMs / 1000).toFixed(0)}s`}</em>
                    {activeQueue ? (
                      <span className="research-progress" aria-label={`${Math.round(activeQueue.progress * 100)} percent complete`}>
                        <i style={{ width: `${Math.round(activeQueue.progress * 100)}%` }} />
                      </span>
                    ) : null}
                  </span>
                  <span className="research-item-cost">{isComplete ? '✓' : `$${definition.cost.toLocaleString()}`}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </aside>
  )
}
