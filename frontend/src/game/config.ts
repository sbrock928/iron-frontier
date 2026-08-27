import type { BuildingKind, Faction, UnitKind, UpgradeKey } from '../types'

export const GRID_SIZE = 48

export type AbilityKey = 'stim' | 'siege' | 'afterburners' | 'frenzy' | 'acid_burst' | 'phase'

export type UnitStats = {
  label: string
  hp: number
  speed: number
  range: number
  acquireRange: number
  vision: number
  damage: number
  cooldown: number
  cost: number
  buildMs: number
  spriteSize: { width: number; height: number }
  requiredFactory: 'barracks' | 'warfactory'
  canAttackAir?: boolean
  canAttackGround?: boolean
  isFlying?: boolean
}

export type BuildingStats = {
  label: string
  hp: number
  cost: number
  power: number
  size: number
  vision: number
  spriteSize: { width: number; height: number }
}

export type UpgradeDefinition = {
  key: UpgradeKey
  faction: Faction
  label: string
  description: string
  cost: number
  researchMs: number
  requiredBuilding: BuildingKind
  prerequisites: UpgradeKey[]
  tier: number
}

export const FACTION_DATA: Record<Faction, {
  name: string
  shortName: string
  emblem: string
  accent: string
  infantry: UnitKind[]
  factory: UnitKind[]
  worker: UnitKind
  startingUnits: UnitKind[]
  buildingLabels: Record<BuildingKind, string>
}> = {
  aegis: {
    name: 'Aegis Expeditionary',
    shortName: 'AEGIS',
    emblem: '/assets/ui/faction_player.png',
    accent: '#66e8dd',
    infantry: ['rifleman', 'medic', 'marauder'],
    factory: ['tank', 'artillery', 'gunship', 'harvester'],
    worker: 'harvester',
    startingUnits: ['rifleman', 'medic', 'marauder', 'tank', 'harvester'],
    buildingLabels: {
      conyard: 'Construction Yard', power: 'Power Plant', refinery: 'Refinery', barracks: 'Barracks', warfactory: 'War Factory', turret: 'Guard Turret',
    },
  },
  noctis: {
    name: 'Noctis Brood',
    shortName: 'NOCTIS',
    emblem: '/assets/ui/faction_enemy.png',
    accent: '#c684ff',
    infantry: ['skitter', 'spitter'],
    factory: ['brute', 'wraith', 'drone'],
    worker: 'drone',
    startingUnits: ['drone', 'skitter', 'skitter', 'spitter'],
    buildingLabels: {
      conyard: 'Hive Yard', power: 'Spore Reactor', refinery: 'Biomass Processor', barracks: 'Spawn Pit', warfactory: 'Gene Forge', turret: 'Spine Cannon',
    },
  },
}

export function opposingFaction(faction: Faction): Faction { return faction === 'aegis' ? 'noctis' : 'aegis' }
export function buildingLabel(kind: BuildingKind, faction: Faction): string { return FACTION_DATA[faction].buildingLabels[kind] }

export const UNIT_STATS: Record<UnitKind, UnitStats> = {
  rifleman: { label: 'Rifleman', hp: 95, speed: 110, range: 155, acquireRange: 230, vision: 340, damage: 13, cooldown: 650, cost: 220, buildMs: 1800, spriteSize: { width: 52, height: 52 }, requiredFactory: 'barracks', canAttackAir: true, canAttackGround: true },
  medic: { label: 'Field Medic', hp: 82, speed: 110, range: 135, acquireRange: 0, vision: 330, damage: 0, cooldown: 0, cost: 260, buildMs: 2100, spriteSize: { width: 52, height: 52 }, requiredFactory: 'barracks', canAttackAir: false, canAttackGround: false },
  marauder: { label: 'Marauder', hp: 185, speed: 94, range: 180, acquireRange: 250, vision: 350, damage: 24, cooldown: 860, cost: 420, buildMs: 3000, spriteSize: { width: 64, height: 64 }, requiredFactory: 'barracks', canAttackAir: false, canAttackGround: true },
  tank: { label: 'Medium Tank', hp: 340, speed: 80, range: 220, acquireRange: 305, vision: 395, damage: 42, cooldown: 1150, cost: 850, buildMs: 4200, spriteSize: { width: 92, height: 92 }, requiredFactory: 'warfactory', canAttackAir: false, canAttackGround: true },
  artillery: { label: 'Siege Artillery', hp: 250, speed: 60, range: 310, acquireRange: 390, vision: 450, damage: 58, cooldown: 1750, cost: 1150, buildMs: 6200, spriteSize: { width: 96, height: 96 }, requiredFactory: 'warfactory', canAttackAir: false, canAttackGround: true },
  gunship: { label: 'Gunship', hp: 260, speed: 120, range: 210, acquireRange: 300, vision: 470, damage: 26, cooldown: 760, cost: 980, buildMs: 5600, spriteSize: { width: 94, height: 94 }, requiredFactory: 'warfactory', canAttackAir: true, canAttackGround: true, isFlying: true },
  harvester: { label: 'Harvester', hp: 430, speed: 65, range: 0, acquireRange: 0, vision: 280, damage: 0, cooldown: 0, cost: 1200, buildMs: 5000, spriteSize: { width: 94, height: 94 }, requiredFactory: 'warfactory', canAttackAir: false, canAttackGround: false },
  skitter: { label: 'Skitter Drone', hp: 82, speed: 126, range: 145, acquireRange: 225, vision: 315, damage: 12, cooldown: 540, cost: 190, buildMs: 1500, spriteSize: { width: 60, height: 60 }, requiredFactory: 'barracks', canAttackAir: false, canAttackGround: true },
  brute: { label: 'Brute Mauler', hp: 360, speed: 78, range: 190, acquireRange: 285, vision: 365, damage: 40, cooldown: 1080, cost: 840, buildMs: 4300, spriteSize: { width: 96, height: 96 }, requiredFactory: 'warfactory', canAttackAir: false, canAttackGround: true },
  spitter: { label: 'Spitter Beast', hp: 210, speed: 74, range: 265, acquireRange: 355, vision: 410, damage: 34, cooldown: 980, cost: 440, buildMs: 3000, spriteSize: { width: 88, height: 88 }, requiredFactory: 'barracks', canAttackAir: true, canAttackGround: true },
  wraith: { label: 'Wraith Flier', hp: 220, speed: 130, range: 200, acquireRange: 320, vision: 470, damage: 22, cooldown: 700, cost: 950, buildMs: 5200, spriteSize: { width: 90, height: 90 }, requiredFactory: 'warfactory', canAttackAir: true, canAttackGround: true, isFlying: true },
  drone: { label: 'Extractor Drone', hp: 390, speed: 72, range: 0, acquireRange: 0, vision: 300, damage: 0, cooldown: 0, cost: 1050, buildMs: 4600, spriteSize: { width: 92, height: 92 }, requiredFactory: 'warfactory', canAttackAir: false, canAttackGround: false },
}

export const BUILDING_STATS: Record<BuildingKind, BuildingStats> = {
  conyard: { label: 'Command Core', hp: 1400, cost: 0, power: 0, size: 110, vision: 420, spriteSize: { width: 160, height: 160 } },
  power: { label: 'Power Structure', hp: 650, cost: 600, power: -100, size: 82, vision: 250, spriteSize: { width: 128, height: 128 } },
  refinery: { label: 'Resource Processor', hp: 900, cost: 1400, power: 30, size: 105, vision: 305, spriteSize: { width: 148, height: 148 } },
  barracks: { label: 'Infantry Structure', hp: 700, cost: 700, power: 20, size: 82, vision: 290, spriteSize: { width: 136, height: 136 } },
  warfactory: { label: 'Heavy Production', hp: 1050, cost: 2000, power: 45, size: 115, vision: 330, spriteSize: { width: 164, height: 164 } },
  turret: { label: 'Defense Turret', hp: 520, cost: 650, power: 15, size: 58, vision: 450, spriteSize: { width: 108, height: 108 } },
}

export const UPGRADE_DEFS: Record<UpgradeKey, UpgradeDefinition> = {
  aegis_composite_plating: { key: 'aegis_composite_plating', faction: 'aegis', label: 'Composite Plating', description: 'Aegis units take 12% less damage.', cost: 700, researchMs: 9000, requiredBuilding: 'barracks', prerequisites: [], tier: 1 },
  aegis_targeting_ai: { key: 'aegis_targeting_ai', faction: 'aegis', label: 'Targeting AI', description: '+12% weapon damage and +30 sight range.', cost: 850, researchMs: 10500, requiredBuilding: 'barracks', prerequisites: [], tier: 1 },
  aegis_reactor_optimization: { key: 'aegis_reactor_optimization', faction: 'aegis', label: 'Reactor Optimization', description: '+18% production speed and +15% harvesting yield.', cost: 900, researchMs: 11000, requiredBuilding: 'refinery', prerequisites: [], tier: 1 },
  aegis_siege_doctrine: { key: 'aegis_siege_doctrine', faction: 'aegis', label: 'Siege Doctrine', description: 'Unlocks Siege Artillery.', cost: 1200, researchMs: 14000, requiredBuilding: 'warfactory', prerequisites: ['aegis_targeting_ai'], tier: 2 },
  aegis_aerospace_command: { key: 'aegis_aerospace_command', faction: 'aegis', label: 'Aerospace Command', description: 'Unlocks Gunships and improves air vision.', cost: 1300, researchMs: 15000, requiredBuilding: 'warfactory', prerequisites: ['aegis_reactor_optimization'], tier: 2 },
  noctis_carapace_grafting: { key: 'noctis_carapace_grafting', faction: 'noctis', label: 'Carapace Grafting', description: 'Brood units take 12% less damage.', cost: 680, researchMs: 9000, requiredBuilding: 'barracks', prerequisites: [], tier: 1 },
  noctis_synaptic_acceleration: { key: 'noctis_synaptic_acceleration', faction: 'noctis', label: 'Synaptic Acceleration', description: '+12% speed and 10% faster attacks.', cost: 820, researchMs: 10500, requiredBuilding: 'barracks', prerequisites: [], tier: 1 },
  noctis_metabolic_bloom: { key: 'noctis_metabolic_bloom', faction: 'noctis', label: 'Metabolic Bloom', description: '+18% production speed and +15% biomass harvesting.', cost: 880, researchMs: 11000, requiredBuilding: 'refinery', prerequisites: [], tier: 1 },
  noctis_acid_evolution: { key: 'noctis_acid_evolution', faction: 'noctis', label: 'Acid Evolution', description: 'Spitters gain +20% damage and +35 range.', cost: 1050, researchMs: 12500, requiredBuilding: 'barracks', prerequisites: ['noctis_synaptic_acceleration'], tier: 2 },
  noctis_alpha_mauler: { key: 'noctis_alpha_mauler', faction: 'noctis', label: 'Alpha Mauler Strain', description: 'Unlocks Brute Maulers.', cost: 1150, researchMs: 13500, requiredBuilding: 'warfactory', prerequisites: ['noctis_carapace_grafting'], tier: 2 },
  noctis_phase_brood: { key: 'noctis_phase_brood', faction: 'noctis', label: 'Phase Brood', description: 'Unlocks Wraith Fliers.', cost: 1300, researchMs: 15000, requiredBuilding: 'warfactory', prerequisites: ['noctis_metabolic_bloom'], tier: 2 },
}

export const FACTION_UPGRADES: Record<Faction, UpgradeKey[]> = {
  aegis: ['aegis_composite_plating', 'aegis_targeting_ai', 'aegis_reactor_optimization', 'aegis_siege_doctrine', 'aegis_aerospace_command'],
  noctis: ['noctis_carapace_grafting', 'noctis_synaptic_acceleration', 'noctis_metabolic_bloom', 'noctis_acid_evolution', 'noctis_alpha_mauler', 'noctis_phase_brood'],
}

export const UNIT_UNLOCK_UPGRADE: Partial<Record<UnitKind, UpgradeKey>> = {
  artillery: 'aegis_siege_doctrine', gunship: 'aegis_aerospace_command', brute: 'noctis_alpha_mauler', wraith: 'noctis_phase_brood',
}

export function isUnitUnlocked(kind: UnitKind, completed: ReadonlySet<UpgradeKey>): boolean {
  const requirement = UNIT_UNLOCK_UPGRADE[kind]
  return !requirement || completed.has(requirement)
}

export const UNIT_TEXTURES: Record<UnitKind, string> = {
  rifleman: 'unit-rifleman', medic: 'unit-medic', marauder: 'unit-marauder', tank: 'unit-tank', artillery: 'unit-artillery', gunship: 'unit-gunship', harvester: 'unit-harvester', skitter: 'unit-skitter', brute: 'unit-brute', spitter: 'unit-spitter', wraith: 'unit-wraith', drone: 'unit-drone',
}
export const UNIT_SHEETS: Record<UnitKind, string> = {
  rifleman: 'unit-rifleman-sheet', medic: 'unit-medic-sheet', marauder: 'unit-marauder-sheet', tank: 'unit-tank-sheet', artillery: 'unit-artillery-sheet', gunship: 'unit-gunship-sheet', harvester: 'unit-harvester-sheet', skitter: 'unit-skitter-sheet', brute: 'unit-brute-sheet', spitter: 'unit-spitter-sheet', wraith: 'unit-wraith-sheet', drone: 'unit-drone-sheet',
}
export const BUILDING_TEXTURES: Record<Faction, Record<BuildingKind, string>> = {
  aegis: { conyard: 'building-conyard', power: 'building-power', refinery: 'building-refinery', barracks: 'building-barracks', warfactory: 'building-warfactory', turret: 'building-turret' },
  noctis: { conyard: 'building-alien-conyard', power: 'building-alien-power', refinery: 'building-alien-refinery', barracks: 'building-alien-barracks', warfactory: 'building-alien-warfactory', turret: 'building-alien-turret' },
}
export const UI_ICONS: Record<UnitKind | BuildingKind, string> = {
  conyard: '/assets/ui/conyard_icon.png', power: '/assets/ui/power_icon.png', refinery: '/assets/ui/refinery_icon.png', barracks: '/assets/ui/barracks_icon.png', warfactory: '/assets/ui/warfactory_icon.png', turret: '/assets/ui/turret_icon.png',
  rifleman: '/assets/ui/rifleman_icon.png', medic: '/assets/ui/medic_icon.png', marauder: '/assets/ui/marauder_icon.png', tank: '/assets/ui/tank_icon.png', artillery: '/assets/ui/artillery_icon.png', gunship: '/assets/ui/gunship_icon.png', harvester: '/assets/ui/harvester_icon.png', skitter: '/assets/ui/skitter_icon.png', brute: '/assets/ui/brute_icon.png', spitter: '/assets/ui/spitter_icon.png', wraith: '/assets/ui/wraith_icon.png', drone: '/assets/ui/drone_icon.png',
}
export const PORTRAITS: Record<UnitKind, string> = {
  rifleman: '/assets/portraits/rifleman.png', medic: '/assets/portraits/medic.png', marauder: '/assets/portraits/marauder.png', tank: '/assets/portraits/tank.png', artillery: '/assets/portraits/artillery.png', gunship: '/assets/portraits/gunship.png', harvester: '/assets/portraits/harvester.png', skitter: '/assets/portraits/skitter.png', brute: '/assets/portraits/brute.png', spitter: '/assets/portraits/spitter.png', wraith: '/assets/portraits/wraith.png', drone: '/assets/portraits/drone.png',
}
export const TEAM_TINT = { player: 0xd8ebef, enemy: 0xf0dbff } as const
