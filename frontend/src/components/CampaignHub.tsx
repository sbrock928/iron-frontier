import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  cancelCampaignOrder,
  createCampaign,
  getCampaign,
  joinCampaign,
  listCampaigns,
  setCampaignReady,
  submitCampaignOrder,
} from '../api/client'
import { FACTION_DATA, UI_ICONS } from '../game/config'
import type {
  CampaignOrder,
  CampaignOrderInput,
  CampaignSector,
  CampaignState,
  CampaignSummary,
  Faction,
  UnitKind,
} from '../types'

const factions = Object.keys(FACTION_DATA) as Faction[]
const SESSION_KEY = 'iron-frontier-campaign-session'

type CampaignSession = { campaignId: string; playerToken: string }

const readSession = (): CampaignSession | null => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SESSION_KEY) ?? 'null') as CampaignSession | null
    return parsed?.campaignId && parsed.playerToken ? parsed : null
  } catch {
    return null
  }
}

const orderLabel = (order: CampaignOrder, state: CampaignState) => {
  const source = state.sectors.find((sector) => sector.id === order.source_sector_id)?.label
  const target = state.sectors.find((sector) => sector.id === order.target_sector_id)?.label
  const unit = state.unit_catalog.find((item) => item.key === order.unit_kind)?.label ?? order.unit_kind
  const upgrade = state.research_catalog.find((item) => item.key === order.upgrade_key)?.label ?? order.upgrade_key
  if (order.order_type === 'move') return `Move ${order.quantity} ${unit} · ${source} → ${target}`
  if (order.order_type === 'produce') return `Deploy ${order.quantity} ${unit} · ${target}`
  return `Research ${upgrade}`
}

function FactionPicker({ value, onChange }: { value: Faction; onChange: (faction: Faction) => void }) {
  return (
    <div className="campaign-faction-picker" role="group" aria-label="Campaign faction">
      {factions.map((faction) => {
        const data = FACTION_DATA[faction]
        return (
          <button
            type="button"
            key={faction}
            className={value === faction ? 'active' : ''}
            data-tooltip={`${data.name}\n${data.tagline}`}
            title={data.name}
            onClick={() => onChange(faction)}
          >
            <img src={data.emblem} alt="" aria-hidden="true" />
            <span>{data.shortName}</span>
          </button>
        )
      })}
    </div>
  )
}

function CampaignLobby({
  campaigns,
  busy,
  error,
  onCreate,
  onJoin,
  onBack,
}: {
  campaigns: CampaignSummary[]
  busy: boolean
  error: string
  onCreate: (name: string, commander: string, faction: Faction) => Promise<void>
  onJoin: (code: string, commander: string, faction: Faction) => Promise<void>
  onBack: () => void
}) {
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [campaignName, setCampaignName] = useState('Fractured Meridian')
  const [commander, setCommander] = useState('Commander')
  const [joinCode, setJoinCode] = useState('')
  const [faction, setFaction] = useState<Faction>('aegis')

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (mode === 'create') void onCreate(campaignName, commander, faction)
    else void onJoin(joinCode, commander, faction)
  }

  return (
    <main className="campaign-shell campaign-lobby-shell">
      <div className="menu-backdrop" />
      <section className="campaign-lobby-card">
        <header className="campaign-lobby-header">
          <div>
            <span>ASYNCHRONOUS STRATEGIC COMMAND</span>
            <h1>SECTOR COMMAND</h1>
            <p>Claim sectors, deploy faction armies, research doctrine, and resolve turns when every commander is ready.</p>
          </div>
          <button type="button" className="campaign-secondary" data-tooltip="Return to the Iron Frontier main menu." title="Back to main menu" onClick={onBack}>Main Menu</button>
        </header>

        <div className="campaign-lobby-grid">
          <form className="campaign-enlist" onSubmit={submit}>
            <div className="campaign-mode-tabs">
              <button type="button" className={mode === 'create' ? 'active' : ''} onClick={() => setMode('create')}>Create Campaign</button>
              <button type="button" className={mode === 'join' ? 'active' : ''} onClick={() => setMode('join')}>Join by Code</button>
            </div>

            {mode === 'create' ? (
              <label>
                <span>Campaign name</span>
                <input required value={campaignName} minLength={3} maxLength={100} onChange={(event) => setCampaignName(event.target.value)} />
              </label>
            ) : (
              <label>
                <span>Join code</span>
                <input required className="campaign-code-input" value={joinCode} minLength={6} maxLength={8} placeholder="ABC123" onChange={(event) => setJoinCode(event.target.value.toUpperCase())} />
              </label>
            )}
            <label>
              <span>Commander name</span>
              <input required value={commander} minLength={2} maxLength={60} onChange={(event) => setCommander(event.target.value)} />
            </label>

            <span className="campaign-field-label">Faction</span>
            <FactionPicker value={faction} onChange={setFaction} />

            {error ? <div className="campaign-error" role="alert">{error}</div> : null}
            <button className="campaign-primary" type="submit" disabled={busy || (mode === 'join' && joinCode.length < 6)}>
              {busy ? 'CONNECTING…' : mode === 'create' ? 'ESTABLISH CAMPAIGN' : 'JOIN CAMPAIGN'}
            </button>
          </form>

          <section className="campaign-open-list">
            <header><strong>Campaign registry</strong><small>{campaigns.length} recorded</small></header>
            {campaigns.length === 0 ? <p>No campaigns yet. Establish the first frontier.</p> : (
              <ul>
                {campaigns.map((campaign) => (
                  <li key={campaign.id}>
                    <button
                      type="button"
                      disabled={campaign.status !== 'waiting'}
                      data-tooltip={campaign.status === 'waiting' ? `Use code ${campaign.join_code} to enlist.` : 'This campaign has already started.'}
                      title={`${campaign.name} — ${campaign.status}`}
                      onClick={() => { setMode('join'); setJoinCode(campaign.join_code) }}
                    >
                      <span><strong>{campaign.name}</strong><small>Turn {campaign.turn_number} · {campaign.status}</small></span>
                      <b>{campaign.player_count}/{campaign.max_players}</b>
                      <code>{campaign.join_code}</code>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </section>
    </main>
  )
}

function SectorMap({
  state,
  selectedId,
  targetId,
  onSelect,
}: {
  state: CampaignState
  selectedId: string | null
  targetId: string | null
  onSelect: (sector: CampaignSector) => void
}) {
  const sectorsById = useMemo(() => new Map(state.sectors.map((sector) => [sector.id, sector])), [state.sectors])
  const connections = useMemo(() => {
    const seen = new Set<string>()
    return state.sectors.flatMap((sector) => sector.neighbor_ids.flatMap((neighborId) => {
      const neighbor = sectorsById.get(neighborId)
      if (!neighbor) return []
      const key = [sector.id, neighbor.id].sort().join(':')
      if (seen.has(key)) return []
      seen.add(key)
      return [{ key, from: sector, to: neighbor }]
    }))
  }, [sectorsById, state.sectors])
  const players = new Map(state.players.map((player) => [player.id, player]))

  return (
    <div className="sector-map" aria-label="Strategic sector map">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {connections.map((connection) => (
          <line key={connection.key} x1={connection.from.map_x} y1={connection.from.map_y} x2={connection.to.map_x} y2={connection.to.map_y} />
        ))}
      </svg>
      {state.sectors.map((sector) => {
        const owner = sector.owner_player_id ? players.get(sector.owner_player_id) : null
        const forceTotal = sector.forces.reduce((sum, force) => sum + force.quantity, 0)
        const relation = !owner ? 'neutral' : owner.id === state.viewer_player_id ? 'friendly' : 'hostile'
        const tooltip = [
          sector.label,
          owner ? `Controlled by ${owner.display_name} · ${FACTION_DATA[owner.faction].name}` : 'Unclaimed sector',
          `Income: $${sector.resource_yield}/turn`,
          `Forces: ${forceTotal}`,
          sector.base_level > 0 ? `Base level ${sector.base_level}` : 'No production base',
        ].join('\n')
        return (
          <button
            type="button"
            key={sector.id}
            className={`sector-node sector-${relation} ${sector.id === selectedId ? 'is-selected' : ''} ${sector.id === targetId ? 'is-target' : ''}`.trim()}
            style={{ left: `${sector.map_x}%`, top: `${sector.map_y}%` }}
            data-tooltip={tooltip}
            title={tooltip}
            onClick={() => onSelect(sector)}
          >
            {owner ? <img src={FACTION_DATA[owner.faction].emblem} alt="" aria-hidden="true" /> : <span className="sector-neutral-mark">◆</span>}
            <strong>{sector.label}</strong>
            <small>${sector.resource_yield} · {forceTotal}F</small>
          </button>
        )
      })}
    </div>
  )
}

function OrderPanel({
  state,
  selected,
  target,
  busy,
  onOrder,
  onCancel,
}: {
  state: CampaignState
  selected: CampaignSector | null
  target: CampaignSector | null
  busy: boolean
  onOrder: (order: CampaignOrderInput) => Promise<void>
  onCancel: (orderId: string) => Promise<void>
}) {
  const [unitKind, setUnitKind] = useState<UnitKind>(state.unit_catalog[0]?.key ?? 'rifleman')
  const [quantity, setQuantity] = useState(1)
  const viewer = state.players.find((player) => player.id === state.viewer_player_id)
  const ownSector = selected?.owner_player_id === state.viewer_player_id
  const moveForces = selected?.forces.filter((force) => force.player_id === state.viewer_player_id) ?? []
  const selectedUnit = state.unit_catalog.find((unit) => unit.key === unitKind) ?? state.unit_catalog[0]

  useEffect(() => {
    if (!state.unit_catalog.some((unit) => unit.key === unitKind) && state.unit_catalog[0]) {
      setUnitKind(state.unit_catalog[0].key)
    }
  }, [state.unit_catalog, unitKind])

  return (
    <aside className="campaign-order-panel">
      <section className="campaign-sector-detail">
        <span>Selected sector</span>
        <strong>{selected?.label ?? 'Select a sector'}</strong>
        {selected ? <small>{selected.owner_player_id ? 'Controlled territory' : 'Unclaimed frontier'} · ${selected.resource_yield}/turn</small> : null}
        {selected?.forces.map((force) => (
          <div className="campaign-force-row" key={`${force.player_id}-${force.unit_kind}`}>
            <img src={UI_ICONS[force.unit_kind]} alt="" aria-hidden="true" />
            <span>{state.unit_catalog.find((unit) => unit.key === force.unit_kind)?.label ?? force.unit_kind}</span>
            <b>{force.quantity}</b>
          </div>
        ))}
      </section>

      <section className="campaign-order-section">
        <header><strong>Movement</strong><small>{target ? `Target: ${target.label}` : 'Select an adjacent target'}</small></header>
        <div className="campaign-order-fields">
          <select
            aria-label="Force to move"
            value={moveForces.some((force) => force.unit_kind === unitKind) ? unitKind : moveForces[0]?.unit_kind ?? ''}
            onChange={(event) => setUnitKind(event.target.value as UnitKind)}
          >
            {moveForces.map((force) => <option key={force.unit_kind} value={force.unit_kind}>{force.unit_kind} ({force.quantity})</option>)}
          </select>
          <input aria-label="Movement quantity" type="number" min={1} max={999} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))} />
          <button
            type="button"
            disabled={busy || !ownSector || !target || moveForces.length === 0 || viewer?.ready}
            data-tooltip="Queue a movement order. It resolves after every commander is ready."
            title="Queue movement order"
            onClick={() => {
              const movingKind = (moveForces.some((force) => force.unit_kind === unitKind) ? unitKind : moveForces[0]?.unit_kind)
              if (selected && target && movingKind) void onOrder({ order_type: 'move', source_sector_id: selected.id, target_sector_id: target.id, unit_kind: movingKind, quantity })
            }}
          >QUEUE MOVE</button>
        </div>
      </section>

      <section className="campaign-order-section">
        <header><strong>Production</strong><small>{selected?.base_level ? `Base level ${selected.base_level}` : 'Requires an established base'}</small></header>
        <div className="campaign-order-fields">
          <select aria-label="Unit to produce" value={unitKind} onChange={(event) => setUnitKind(event.target.value as UnitKind)}>
            {state.unit_catalog.map((unit) => <option key={unit.key} value={unit.key}>{unit.label} · ${unit.cost}</option>)}
          </select>
          <input aria-label="Production quantity" type="number" min={1} max={99} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))} />
          <button
            type="button"
            disabled={busy || !ownSector || !selected?.base_level || !selectedUnit || (viewer?.credits ?? 0) < selectedUnit.cost * quantity || viewer?.ready}
            data-tooltip={selectedUnit ? `Deploy ${selectedUnit.label}\nCost: $${(selectedUnit.cost * quantity).toLocaleString()}\nPower: ${selectedUnit.power} each` : 'Select a unit'}
            title="Queue production order"
            onClick={() => selected && selectedUnit && void onOrder({ order_type: 'produce', target_sector_id: selected.id, unit_kind: selectedUnit.key, quantity })}
          >QUEUE DEPLOYMENT</button>
        </div>
      </section>

      <section className="campaign-order-section campaign-research-orders">
        <header><strong>Doctrine</strong><small>Strategic upgrades</small></header>
        {state.research_catalog.map((upgrade) => {
          const complete = state.completed_research.includes(upgrade.key)
          const queued = state.pending_orders.some((order) => order.upgrade_key === upgrade.key)
          return (
            <button
              type="button"
              key={upgrade.key}
              disabled={busy || complete || queued || (viewer?.credits ?? 0) < upgrade.cost || viewer?.ready}
              data-tooltip={`${upgrade.label}\n${upgrade.description}\nCost: $${upgrade.cost.toLocaleString()}`}
              title={upgrade.label}
              onClick={() => void onOrder({ order_type: 'research', upgrade_key: upgrade.key })}
            >
              <span><strong>{upgrade.label}</strong><small>{complete ? 'Complete' : queued ? 'Queued' : upgrade.description}</small></span>
              <b>{complete ? '✓' : `$${upgrade.cost}`}</b>
            </button>
          )
        })}
      </section>

      <section className="campaign-pending-orders">
        <header><strong>Turn orders</strong><small>{state.pending_orders.length} queued</small></header>
        {state.pending_orders.length === 0 ? <p>No orders submitted.</p> : state.pending_orders.map((order) => (
          <div key={order.id}>
            <span>{orderLabel(order, state)}</span>
            <button type="button" disabled={busy || viewer?.ready} data-tooltip="Cancel this order and refund its reserved cost." title="Cancel order" onClick={() => void onCancel(order.id)}>×</button>
          </div>
        ))}
      </section>
    </aside>
  )
}

function CampaignBoard({
  state,
  busy,
  error,
  onExecute,
  onExit,
}: {
  state: CampaignState
  busy: boolean
  error: string
  onExecute: (operation: () => Promise<CampaignState>) => Promise<void>
  onExit: () => void
}) {
  const ownHome = state.sectors.find((sector) => sector.owner_player_id === state.viewer_player_id) ?? state.sectors[0] ?? null
  const [selectedId, setSelectedId] = useState<string | null>(ownHome?.id ?? null)
  const [targetId, setTargetId] = useState<string | null>(null)
  const viewer = state.players.find((player) => player.id === state.viewer_player_id)
  const selected = state.sectors.find((sector) => sector.id === selectedId) ?? null
  const target = state.sectors.find((sector) => sector.id === targetId) ?? null

  useEffect(() => {
    if (selectedId && !state.sectors.some((sector) => sector.id === selectedId)) setSelectedId(ownHome?.id ?? null)
  }, [ownHome?.id, selectedId, state.sectors])

  const chooseSector = (sector: CampaignSector) => {
    if (selected?.owner_player_id === state.viewer_player_id && selected.neighbor_ids.includes(sector.id) && sector.id !== selected.id) {
      setTargetId(sector.id)
      return
    }
    setSelectedId(sector.id)
    setTargetId(null)
  }

  return (
    <main className={`campaign-shell campaign-board faction-${viewer?.faction ?? 'aegis'}`}>
      <header className="campaign-command-bar">
        <div className="campaign-title-block"><span>IRON FRONTIER // SECTOR COMMAND</span><strong>{state.name}</strong></div>
        <div className="campaign-turn-readout"><span>Turn</span><strong>{state.turn_number}</strong><small>{state.status.toUpperCase()}</small></div>
        <div className="campaign-code"><span>Join code</span><strong>{state.join_code}</strong></div>
        <div className="campaign-credit"><span>War chest</span><strong>${(viewer?.credits ?? 0).toLocaleString()}</strong></div>
        <button type="button" className="campaign-secondary" data-tooltip="Return to the campaign registry. Your session remains saved locally." title="Campaign registry" onClick={onExit}>Registry</button>
      </header>

      {error ? <div className="campaign-board-error" role="alert">{error}</div> : null}
      <div className="campaign-board-grid">
        <section className="campaign-map-panel">
          <SectorMap state={state} selectedId={selectedId} targetId={targetId} onSelect={chooseSector} />
          {state.status === 'waiting' ? (
            <div className="campaign-waiting-banner"><strong>Awaiting commanders</strong><span>Share join code <b>{state.join_code}</b>. Planning unlocks when {state.max_players} commanders enlist.</span></div>
          ) : null}
          <div className="campaign-player-strip">
            {state.players.map((player) => (
              <div className={player.id === state.viewer_player_id ? 'is-viewer' : ''} key={player.id}>
                <img src={FACTION_DATA[player.faction].emblem} alt="" aria-hidden="true" />
                <span><strong>{player.display_name}</strong><small>{FACTION_DATA[player.faction].shortName} · ${player.credits.toLocaleString()}</small></span>
                <b className={player.ready ? 'is-ready' : ''}>{player.ready ? 'READY' : 'PLANNING'}</b>
              </div>
            ))}
          </div>
          <section className="campaign-event-log">
            <header><strong>Campaign dispatches</strong><small>Persistent turn history</small></header>
            <ol>
              {[...state.events].reverse().map((event) => <li key={event.id}><b>T{event.turn_number}</b><span>{event.message}</span></li>)}
            </ol>
          </section>
        </section>

        <OrderPanel
          state={state}
          selected={selected}
          target={target}
          busy={busy}
          onOrder={(order) => onExecute(() => submitCampaignOrder(state.id, state.viewer_token, order))}
          onCancel={(orderId) => onExecute(() => cancelCampaignOrder(state.id, orderId, state.viewer_token))}
        />
      </div>

      <footer className="campaign-ready-bar">
        <span>{viewer?.ready ? 'Orders locked. Waiting for the other commander.' : 'Queue orders, then commit your turn.'}</span>
        <button
          type="button"
          disabled={busy || state.status !== 'planning'}
          className={viewer?.ready ? 'is-ready' : ''}
          data-tooltip={viewer?.ready ? 'Unlock your orders while the turn is still waiting.' : 'Lock orders. The turn resolves when every commander is ready.'}
          title={viewer?.ready ? 'Unready' : 'Commit turn'}
          onClick={() => void onExecute(() => setCampaignReady(state.id, state.viewer_token, !viewer?.ready))}
        >{viewer?.ready ? 'UNREADY' : 'COMMIT TURN'}</button>
      </footer>
    </main>
  )
}

export function CampaignHub({ onBack }: { onBack: () => void }) {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([])
  const [state, setState] = useState<CampaignState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const activeCampaignId = state?.id
  const activePlayerToken = state?.viewer_token

  const acceptState = useCallback((next: CampaignState) => {
    setState(next)
    setError('')
    window.localStorage.setItem(SESSION_KEY, JSON.stringify({ campaignId: next.id, playerToken: next.viewer_token }))
  }, [])

  const refreshRegistry = useCallback(() => {
    listCampaigns().then(setCampaigns).catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : 'Could not load campaigns')
    })
  }, [])

  useEffect(() => {
    refreshRegistry()
    const session = readSession()
    if (!session) return
    getCampaign(session.campaignId, session.playerToken).then(acceptState).catch(() => {
      window.localStorage.removeItem(SESSION_KEY)
    })
  }, [acceptState, refreshRegistry])

  useEffect(() => {
    if (!activeCampaignId || !activePlayerToken) return
    const timer = window.setInterval(() => {
      getCampaign(activeCampaignId, activePlayerToken).then(acceptState).catch(() => undefined)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [acceptState, activeCampaignId, activePlayerToken])

  const execute = async (operation: () => Promise<CampaignState>) => {
    setBusy(true)
    setError('')
    try {
      acceptState(await operation())
      refreshRegistry()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Campaign operation failed')
    } finally {
      setBusy(false)
    }
  }

  if (state) {
    return (
      <CampaignBoard
        state={state}
        busy={busy}
        error={error}
        onExecute={execute}
        onExit={() => { setState(null); refreshRegistry() }}
      />
    )
  }

  return (
    <CampaignLobby
      campaigns={campaigns}
      busy={busy}
      error={error}
      onBack={onBack}
      onCreate={(name, commander, faction) => execute(() => createCampaign({ name, commander_name: commander, faction, max_players: 2 }))}
      onJoin={(joinCode, commander, faction) => execute(() => joinCampaign({ join_code: joinCode, commander_name: commander, faction }))}
    />
  )
}
