export type Point = { x: number; y: number }

export type Objective = {
  id: string
  label: string
  type: string
  target: string | null
}

export type MissionDefinition = {
  world_width: number
  world_height: number
  starting_credits: number
  player_spawn: Point
  enemy_spawn: Point
  ore_fields: Point[]
  objectives: Objective[]
  enemy: {
    attack_interval_seconds: number
    starting_units: number
    production_multiplier: number
  }
}

export type Mission = {
  id: string
  name: string
  description: string
  definition: MissionDefinition
}

export type Team = 'player' | 'enemy'
export type Faction = 'aegis' | 'noctis' | 'veyra'
export type Difficulty = 'easy' | 'normal' | 'hard' | 'brutal'

export type UnitKind =
  | 'rifleman' | 'medic' | 'marauder' | 'sniper'
  | 'tank' | 'artillery' | 'walker' | 'gunship' | 'interceptor' | 'harvester'
  | 'skitter' | 'spitter' | 'broodcaster' | 'brute' | 'ravager' | 'wraith' | 'devourer' | 'drone'
  | 'lancer' | 'adept' | 'seer' | 'sentinel' | 'colossus' | 'seraph' | 'arbiter' | 'probe'

export type BuildingKind =
  | 'conyard' | 'power' | 'refinery' | 'barracks' | 'warfactory'
  | 'airfield' | 'techlab' | 'turret' | 'detector'

export type GameStatus = 'loading' | 'playing' | 'victory' | 'defeat' | 'error'

export type UpgradeKey =
  | 'aegis_composite_plating' | 'aegis_targeting_ai' | 'aegis_reactor_optimization'
  | 'aegis_precision_school' | 'aegis_siege_doctrine' | 'aegis_heavy_chassis'
  | 'aegis_aerospace_command' | 'aegis_interceptor_program' | 'aegis_nanomedicine'
  | 'noctis_carapace_grafting' | 'noctis_synaptic_acceleration' | 'noctis_metabolic_bloom'
  | 'noctis_acid_evolution' | 'noctis_brood_mind' | 'noctis_alpha_mauler'
  | 'noctis_ravager_strain' | 'noctis_phase_brood' | 'noctis_devourer_strain'
  | 'veyra_shield_harmonics' | 'veyra_resonance_matrix' | 'veyra_crystal_efficiency'
  | 'veyra_phase_doctrine' | 'veyra_oracle_path' | 'veyra_sentinel_awakening'
  | 'veyra_colossus_protocol' | 'veyra_star_gate' | 'veyra_arbiter_convergence'

export type SelectedEntity = {
  id: string
  label: string
  kind: UnitKind | BuildingKind
  hp: number
  maxHp: number
  shield?: number
  maxShield?: number
  team: Team
  /**
   * The owning faction. Buildings share `kind` values across all three factions
   * (every race has a `conyard`), so the HUD needs this to pick the right icon
   * and label. Units have faction-unique kinds and therefore omit it.
   */
  faction?: Faction
}

/** How prominently an alert is surfaced, and how long it lingers. */
export type AlertSeverity = 'info' | 'warning' | 'critical'

/**
 * A timestamped notification surfaced in the alert log. Alerts replace the old
 * single-slot status line, which could only ever show the most recent message
 * and silently dropped anything that happened while the player was reading.
 */
export type GameAlert = {
  id: number
  severity: AlertSeverity
  message: string
  /** Wall-clock ms, used for age-out and ordering. */
  at: number
  /** World position to centre the camera on when the alert is clicked, if any. */
  at_world?: Point
}

/** A single entity's position as drawn on the minimap. */
export type MinimapBlip = {
  x: number
  y: number
  team: Team | 'neutral'
  /** Structures are drawn larger and squarer than units. */
  structure: boolean
}

/**
 * Everything the DOM minimap needs for one repaint. The scene pushes these on a
 * fixed low-rate timer rather than the React tree reading game state directly,
 * which keeps Phaser as the single owner of simulation state.
 */
export type MinimapSnapshot = {
  worldWidth: number
  worldHeight: number
  blips: MinimapBlip[]
  /** Camera viewport in world coordinates, drawn as the minimap's view rectangle. */
  view: { x: number; y: number; width: number; height: number }
}

/**
 * One button on the command card. `kind` tells the scene how to interpret `key`
 * when the action is dispatched, so the card stays a dumb renderer and all
 * game rules stay in the scene.
 */
export type CommandAction = {
  id: string
  label: string
  /** Single-character hotkey hint shown in the button corner. */
  hotkey: string
  icon: string
  kind: 'build' | 'train' | 'research' | 'ability' | 'order' | 'submenu' | 'back'
  key: string
  cost?: number
  /** Disabled buttons still occupy their grid slot so positions stay muscle-memory stable. */
  disabled?: boolean
  /** Why the action is unavailable, shown on hover. */
  reason?: string
}

export type ProductionQueueView = {
  buildingId: string
  buildingLabel: string
  activeKind: UnitKind | null
  activeLabel: string
  progress: number
  queuedKinds: UnitKind[]
}

export type ResearchQueueView = {
  buildingId: string
  upgradeKey: UpgradeKey
  label: string
  progress: number
}

export type MatchSetup = {
  missionId: string
  playerFaction: Faction
  enemyFaction: Faction
  difficulty: Difficulty
}

/**
 * What we persist in a save slot.
 *
 * This deliberately records the *deployment* (which matchup was being played)
 * plus a snapshot of the economy for display in the menu. It is NOT a full
 * battle serialisation — unit positions, buildings, production queues, research
 * and fog are not captured, so loading a slot restages the same matchup from
 * its opening state rather than resuming mid-battle. The UI says exactly that;
 * see `MainMenu`'s deployment log.
 *
 * Field names are snake_case because this object crosses the wire verbatim as
 * the free-form `payload` of the backend's `SaveGameWrite`.
 */
export type SaveGamePayload = {
  faction: Faction
  enemy_faction: Faction
  difficulty: Difficulty
  credits: number
  supply_used: number
  supply_cap: number
  status: GameStatus
  saved_at: string
}

export type SaveGame = {
  slot: string
  mission_id: string
  payload: SaveGamePayload
  updated_at: string
}
