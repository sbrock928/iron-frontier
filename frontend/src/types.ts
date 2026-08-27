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
export type Faction = 'aegis' | 'noctis'
export type UnitKind =
  | 'rifleman'
  | 'medic'
  | 'marauder'
  | 'tank'
  | 'artillery'
  | 'gunship'
  | 'harvester'
  | 'skitter'
  | 'brute'
  | 'spitter'
  | 'wraith'
  | 'drone'
export type BuildingKind = 'conyard' | 'power' | 'refinery' | 'barracks' | 'warfactory' | 'turret'
export type GameStatus = 'loading' | 'playing' | 'victory' | 'defeat' | 'error'

export type UpgradeKey =
  | 'aegis_composite_plating'
  | 'aegis_targeting_ai'
  | 'aegis_reactor_optimization'
  | 'aegis_siege_doctrine'
  | 'aegis_aerospace_command'
  | 'noctis_carapace_grafting'
  | 'noctis_synaptic_acceleration'
  | 'noctis_metabolic_bloom'
  | 'noctis_acid_evolution'
  | 'noctis_alpha_mauler'
  | 'noctis_phase_brood'

export type SelectedEntity = {
  id: string
  label: string
  kind: UnitKind | BuildingKind
  hp: number
  maxHp: number
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
