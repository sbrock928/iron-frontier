import { useEffect, useMemo, useState } from 'react'
import {
  ABILITY_DEFS,
  ALL_BUILDING_KINDS,
  BUILDING_STATS,
  FACTION_DATA,
  UI_ICONS,
  UNIT_STATS,
  WORKER_KINDS,
  buildingLabel,
  factionBuildingIcon,
  isUnitUnlocked,
} from '../game/config'
import { gameBus } from '../game/events/gameBus'
import { COMMAND_GRID_COLUMNS, COMMAND_GRID_ROWS, COMMAND_GRID_SIZE, ORDER_HOTKEYS, assignHotkeys, padToGrid } from '../game/hotkeys'
import { useGameStore } from '../store/gameStore'
import type { BuildingKind, CommandAction, UnitKind, UpgradeKey } from '../types'

/** Which submenu the card is currently showing. */
type CardPage = 'root' | 'build'

/** Structures the player can order; the conyard is the thing that builds them. */
const STRUCTURES: BuildingKind[] = ALL_BUILDING_KINDS.filter((kind) => kind !== 'conyard')

/** Purpose-made icons for orders that aren't a unit or structure. */
const ORDER_ICONS = {
  attack: '/assets/ui/cmd_attack.png',
  stop: '/assets/ui/cmd_stop.png',
  center: '/assets/ui/cmd_center.png',
} as const

function CommandButton({ action, onInvoke }: { action: CommandAction | null; onInvoke: (action: CommandAction) => void }) {
  if (!action) return <div className="command-slot command-slot-empty" aria-hidden="true" />

  const tooltip = [
    action.label,
    action.description ?? '',
    action.hotkey ? `Hotkey: ${action.hotkey}` : '',
    action.cost ? `Cost: $${action.cost.toLocaleString()}` : '',
    action.reason ?? '',
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <span className="command-tooltip" data-tooltip={tooltip}>
      <button
        className={`command-slot ${action.disabled ? 'is-disabled' : ''}`.trim()}
        disabled={action.disabled}
        title={tooltip}
        onClick={() => onInvoke(action)}
      >
        <img src={action.icon} alt="" aria-hidden="true" />
        <span className="command-hotkey">{action.hotkey}</span>
        <span className="command-label">{action.label}</span>
        {action.cost ? <span className="command-cost">${action.cost.toLocaleString()}</span> : null}
      </button>
    </span>
  )
}

/**
 * The command card: a fixed 3x4 grid of context-sensitive orders on the right
 * of the console, with keyboard hotkeys.
 *
 * The grid is always rendered at full size. General orders keep stable positions,
 * while unit abilities only appear when at least one selected unit can use them;
 * this keeps unrelated faction powers from cluttering every selection.
 */
export function CommandCard() {
  const selected = useGameStore((state) => state.selected)
  const faction = useGameStore((state) => state.faction)
  const credits = useGameStore((state) => state.credits)
  const completedUpgrades = useGameStore((state) => state.completedUpgrades)
  const placementKind = useGameStore((state) => state.placementKind)
  const attackMoveArmed = useGameStore((state) => state.attackMoveArmed)
  const productionQueues = useGameStore((state) => state.productionQueues)

  const [page, setPage] = useState<CardPage>('root')

  // Any change of selection returns the card to its root page: leaving it on a
  // submenu belonging to a structure the player no longer has selected would
  // show orders that cannot be issued.
  const selectionSignature = selected.map((entity) => entity.id).join(',')
  useEffect(() => setPage('root'), [selectionSignature])

  const completed = useMemo(() => new Set<UpgradeKey>(completedUpgrades), [completedUpgrades])
  const primary = selected[0] ?? null
  const selectedKinds = useMemo(
    () => new Set(selected.filter((entity) => entity.team === 'player').map((entity) => entity.kind)),
    [selected],
  )

  const actions = useMemo<CommandAction[]>(() => {
    const data = FACTION_DATA[faction]

    const backAction: CommandAction = {
      id: 'back', label: 'Back', description: 'Return to the main command card.', hotkey: ORDER_HOTKEYS.back, icon: ORDER_ICONS.center, kind: 'back', key: 'back',
    }

    if (page === 'build') {
      const hotkeys = assignHotkeys(STRUCTURES, (kind) => buildingLabel(kind, faction))
      return [
        ...STRUCTURES.map<CommandAction>((kind) => {
          const stats = BUILDING_STATS[kind]
          const affordable = credits >= stats.cost
          return {
            id: `build-${kind}`,
            label: buildingLabel(kind, faction),
            hotkey: hotkeys.get(kind) ?? '',
            icon: factionBuildingIcon(kind, faction),
            kind: 'build',
            key: kind,
            cost: stats.cost,
            description: `Place a ${buildingLabel(kind, faction)} near your base.`,
            disabled: !affordable,
            ...(affordable ? {} : { reason: 'Insufficient credits' }),
          }
        }),
        backAction,
      ]
    }

    // Root page. A selected production structure offers its roster; otherwise
    // the card shows unit orders plus the build entry point.
    const producible: UnitKind[] =
      primary?.kind === 'barracks' ? data.infantry
        : primary?.kind === 'warfactory' ? data.factory
          : primary?.kind === 'airfield' ? data.air
            : []

    if (producible.length > 0) {
      const hotkeys = assignHotkeys(producible, (kind) => UNIT_STATS[kind].label)
      const queue = productionQueues.find((item) => item.buildingId === primary?.id)
      const trainActions = producible.map<CommandAction>((kind) => {
        const stats = UNIT_STATS[kind]
        const unlocked = isUnitUnlocked(kind, completed)
        const affordable = credits >= stats.cost
        return {
          id: `train-${kind}`,
          label: stats.label,
          hotkey: hotkeys.get(kind) ?? '',
          icon: UI_ICONS[kind],
          kind: 'train',
          key: kind,
          cost: stats.cost,
          description: `Train ${stats.label}. Uses ${stats.supply} supply and takes ${(stats.buildMs / 1000).toFixed(1)} seconds.`,
          disabled: !unlocked || !affordable,
          ...(unlocked ? (affordable ? {} : { reason: 'Insufficient credits' }) : { reason: 'Locked behind the tech tree' }),
        }
      })
      if (queue) {
        trainActions.push({
          id: 'cancel-production',
          label: 'Cancel',
          hotkey: ORDER_HOTKEYS.cancel,
          icon: ORDER_ICONS.stop,
          kind: 'order',
          key: 'cancel-production',
          description: 'Cancel the active production order in this structure.',
        })
      }
      return trainActions
    }

    const orders: CommandAction[] = []
    const hasUnits = selected.some((entity) => entity.kind in UNIT_STATS)

    orders.push({
      id: 'attack-move',
      label: attackMoveArmed ? 'Attack (armed)' : 'Attack Move',
      hotkey: ORDER_HOTKEYS.attackMove,
      icon: ORDER_ICONS.attack,
      kind: 'order',
      key: 'attack-move',
      description: 'Move toward a destination and engage enemies encountered along the way.',
      disabled: !hasUnits,
      ...(hasUnits ? {} : { reason: 'Select units first' }),
    })
    orders.push({
      id: 'stop', label: 'Stop', description: 'Immediately cancel current movement and attack orders.', hotkey: ORDER_HOTKEYS.stop, icon: ORDER_ICONS.stop, kind: 'order', key: 'stop',
      disabled: !hasUnits, ...(hasUnits ? {} : { reason: 'Select units first' }),
    })
    orders.push({
      id: 'center', label: 'Center', description: 'Center the camera on the current selection.', hotkey: ORDER_HOTKEYS.center, icon: ORDER_ICONS.center, kind: 'order', key: 'center',
      disabled: selected.length === 0, ...(selected.length > 0 ? {} : { reason: 'Nothing selected' }),
    })

    // Assign all ability letters in one pass; assigning them individually would
    // let two abilities claim the same key, since each call starts fresh.
    const abilities = ABILITY_DEFS.filter(
      (definition) => definition.faction === faction && definition.requiresKinds.some((kind) => selectedKinds.has(kind)),
    )
    const abilityHotkeys = assignHotkeys(abilities, (ability) => ability.label)
    for (const ability of abilities) {
      orders.push({
        id: `ability-${ability.key}`,
        label: ability.label,
        description: ability.description,
        hotkey: abilityHotkeys.get(ability) ?? '',
        icon: ORDER_ICONS.attack,
        kind: 'ability',
        key: ability.key,
      })
    }

    // Build is offered whenever a worker is selected, matching how the player
    // actually constructs. Research lives in the dedicated battlefield panel.
    const hasWorker = selected.some((entity) => WORKER_KINDS.has(entity.kind as UnitKind))
    orders.push({
      id: 'open-build', label: 'Build', description: 'Open the structure construction menu.', hotkey: ORDER_HOTKEYS.build, icon: UI_ICONS.conyard, kind: 'submenu', key: 'build',
      disabled: !hasWorker && primary?.kind !== 'conyard',
      ...(hasWorker || primary?.kind === 'conyard' ? {} : { reason: 'Select a worker or your construction yard' }),
    })

    return orders
  }, [page, faction, credits, completed, primary, selected, selectedKinds, attackMoveArmed, productionQueues])

  const invoke = useMemo(() => (action: CommandAction) => {
    if (action.disabled) return
    switch (action.kind) {
      case 'build':
        gameBus.emit('build-structure', action.key as BuildingKind)
        setPage('root')
        break
      case 'train':
        gameBus.emit('produce-unit', action.key as UnitKind)
        break
      case 'ability':
        gameBus.emit('activate-ability', action.key as Parameters<typeof gameBus.emit<'activate-ability'>>[1])
        break
      case 'submenu':
        setPage(action.key as CardPage)
        break
      case 'back':
        setPage('root')
        break
      case 'order':
        if (action.key === 'attack-move') gameBus.emit('arm-attack-move', undefined)
        else if (action.key === 'stop') gameBus.emit('stop-selected', undefined)
        else if (action.key === 'center') gameBus.emit('center-selected', undefined)
        else if (action.key === 'cancel-production' && primary) gameBus.emit('cancel-production', primary.id)
        break
    }
  }, [primary])

  // Keyboard hotkeys. Bound on window rather than inside Phaser so the card
  // stays the single source of truth for what each letter currently does.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return

      if (event.key === 'Escape') {
        if (page !== 'root') {
          setPage('root')
          event.preventDefault()
        }
        return
      }

      const pressed = event.key.toUpperCase()
      const match = actions.find((action) => action.hotkey === pressed && !action.disabled)
      if (!match) return
      event.preventDefault()
      invoke(match)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [actions, invoke, page])

  const slots = padToGrid(actions, COMMAND_GRID_SIZE)

  return (
    <div className="command-card">
      {placementKind && (
        <p className="command-placement-hint">
          Placing {buildingLabel(placementKind, faction)} — left-click the battlefield, Esc cancels.
        </p>
      )}
      <div
        className="command-grid"
        role="group"
        aria-label="Command card"
        style={{
          gridTemplateColumns: `repeat(${COMMAND_GRID_COLUMNS}, 1fr)`,
          gridTemplateRows: `repeat(${COMMAND_GRID_ROWS}, minmax(0, 1fr))`,
        }}
      >
        {slots.map((action, index) => (
          <CommandButton key={action?.id ?? `empty-${index}`} action={action} onInvoke={invoke} />
        ))}
      </div>
    </div>
  )
}
