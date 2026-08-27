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
