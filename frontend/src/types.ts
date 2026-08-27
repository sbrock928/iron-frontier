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

export type SelectedEntity = {
  id: string
  label: string
  kind: UnitKind | BuildingKind
  hp: number
  maxHp: number
  team: Team
}
