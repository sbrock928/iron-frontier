import { DIFFICULTY_DATA, FACTION_DATA } from '../game/config'
import type { Difficulty, Faction, Mission, SaveGame } from '../types'
import { useGameStore } from '../store/gameStore'

const factions = Object.keys(FACTION_DATA) as Faction[]
const difficulties = Object.keys(DIFFICULTY_DATA) as Difficulty[]

const relativeTime = (iso: string) => {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return 'unknown'
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export function MainMenu({
  missions,
  missionId,
  playerFaction,
  enemyFaction,
  difficulty,
  saves,
  onMissionChange,
  onPlayerFactionChange,
  onEnemyFactionChange,
  onDifficultyChange,
  onRestore,
  onStart,
}: {
  missions: Mission[]
  missionId: string
  playerFaction: Faction
  enemyFaction: Faction
  difficulty: Difficulty
  saves: SaveGame[]
  onMissionChange: (value: string) => void
  onPlayerFactionChange: (value: Faction) => void
  onEnemyFactionChange: (value: Faction) => void
  onDifficultyChange: (value: Difficulty) => void
  onRestore: (save: SaveGame) => void
  onStart: () => void
}) {
  const mission = missions.find((item) => item.id === missionId) ?? missions[0]
  const status = useGameStore((state) => state.status)
  const message = useGameStore((state) => state.message)

  return (
    <main className="main-menu-shell">
      <div className="menu-backdrop" />
      <section className="menu-card">
        <header className="menu-header">
          <div className="menu-eyebrow">TACTICAL COMMAND NETWORK</div>
          <h1>IRON FRONTIER</h1>
          <p>Choose your faction, opposition, battlefield and threat level before deployment.</p>
        </header>

        {status === 'error' && <div className="menu-error"><strong>BACKEND CONNECTION FAILED</strong><span>{message}</span><small>Start FastAPI on 127.0.0.1:8000, then refresh this page.</small></div>}

        <div className="menu-section-title"><span>01</span><strong>Choose your race</strong></div>
        <div className="faction-card-grid">
          {factions.map((faction) => {
            const data = FACTION_DATA[faction]
            const active = faction === playerFaction
            return (
              <button
                key={faction}
                className={`faction-card ${active ? 'active' : ''}`}
                data-tooltip={`Play as ${data.name}\n${data.tagline}`}
                title={`Play as ${data.name} — ${data.tagline}`}
                onClick={() => onPlayerFactionChange(faction)}
              >
                <img src={data.emblem} alt="" aria-hidden="true" />
                <div><strong>{data.name}</strong><span>{data.tagline}</span></div>
              </button>
            )
          })}
        </div>

        <div className="menu-grid-two">
          <div>
            <div className="menu-section-title compact"><span>02</span><strong>Opponent</strong></div>
            <label className="menu-select-label">
              <span>Enemy race</span>
              <select title="Choose the opposing faction" value={enemyFaction} onChange={(event) => onEnemyFactionChange(event.target.value as Faction)}>
                {factions.map((faction) => <option value={faction} key={faction}>{FACTION_DATA[faction].name}</option>)}
              </select>
            </label>
          </div>
          <div>
            <div className="menu-section-title compact"><span>03</span><strong>Threat level</strong></div>
            <div className="difficulty-grid">
              {difficulties.map((key) => {
                const tooltip = `${DIFFICULTY_DATA[key].label} threat\nEnemy economy: ${Math.round(DIFFICULTY_DATA[key].economy * 100)}% · production: ${Math.round(DIFFICULTY_DATA[key].production * 100)}%`
                return (
                  <button
                    key={key}
                    className={difficulty === key ? 'active' : ''}
                    data-tooltip={tooltip}
                    title={tooltip}
                    onClick={() => onDifficultyChange(key)}
                  >{DIFFICULTY_DATA[key].label}</button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="menu-section-title"><span>04</span><strong>Battlefield</strong></div>
        <div className="mission-chooser">
          <label className="menu-select-label">
            <span>Mission / skirmish</span>
            <select title="Choose the battlefield and mission objectives" value={missionId} onChange={(event) => onMissionChange(event.target.value)}>
              {missions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <div className="mission-preview">
            <strong>{mission?.name ?? 'Loading scenarios…'}</strong>
            <p>{mission?.description ?? 'Retrieving battlefield data from FastAPI…'}</p>
            {mission && <div className="mission-stats"><span>{mission.definition.world_width} × {mission.definition.world_height}</span><span>${mission.definition.starting_credits.toLocaleString()} start</span><span>{mission.definition.ore_fields.length} resource zones</span></div>}
          </div>
        </div>

        <footer className="menu-footer">
          <div className="matchup-summary">
            <img src={FACTION_DATA[playerFaction].emblem} alt="" />
            <strong>{FACTION_DATA[playerFaction].shortName}</strong>
            <span>VS</span>
            <strong>{FACTION_DATA[enemyFaction].shortName}</strong>
            <img src={FACTION_DATA[enemyFaction].emblem} alt="" />
          </div>
          <button
            className="deploy-button"
            disabled={!mission}
            data-tooltip={mission ? `Deploy to ${mission.name}\nStart a new battle with the selected matchup.` : 'Waiting for mission data.'}
            title={mission ? `Deploy to ${mission.name}` : 'Waiting for mission data'}
            onClick={onStart}
          >DEPLOY FORCES</button>
        </footer>

        {saves.length > 0 && (
          <section className="save-log">
            <div className="menu-section-title compact"><span>05</span><strong>Deployment log</strong></div>
            <p className="muted">
              Saved slots record the matchup and economy at the moment you saved. Restoring one
              reloads that matchup for a fresh deployment — mid-battle state is not yet persisted.
            </p>
            <ul>
              {saves.map((save) => {
                const savedMission = missions.find((item) => item.id === save.mission_id)
                return (
                  <li key={save.slot}>
                    <button
                      data-tooltip={`Restore ${save.slot}\nReload this saved matchup and economy for a fresh deployment.`}
                      title={`Restore ${save.slot} matchup`}
                      onClick={() => onRestore(save)}
                    >
                      <strong>{save.slot.toUpperCase()}</strong>
                      <span>{savedMission?.name ?? save.mission_id}</span>
                      <span>
                        {FACTION_DATA[save.payload.faction].shortName} vs {FACTION_DATA[save.payload.enemy_faction].shortName}
                        {' · '}{DIFFICULTY_DATA[save.payload.difficulty].label}
                        {' · '}${save.payload.credits.toLocaleString()}
                        {' · '}{save.payload.supply_used}/{save.payload.supply_cap} sup
                      </span>
                      <small>{relativeTime(save.updated_at)}</small>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </section>
    </main>
  )
}
