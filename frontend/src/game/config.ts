import type { BuildingKind, Difficulty, Faction, UnitKind, UpgradeKey } from '../types'

export const GRID_SIZE = 48

export type AbilityKey =
  | 'stim' | 'siege' | 'afterburners'
  | 'frenzy' | 'acid_burst' | 'phase'
  | 'shield_surge' | 'phase_stride' | 'overcharge'

export type UnitRole = 'infantry' | 'vehicle' | 'air' | 'worker' | 'support'

export type UnitStats = {
  label: string
  hp: number
  shield?: number
  shieldRegen?: number
  speed: number
  range: number
  acquireRange: number
  vision: number
  damage: number
  cooldown: number
  cost: number
  /**
   * Supply consumed while this unit is alive or in production. Scaled roughly
   * with credit cost and battlefield weight: 1 for workers and light infantry,
   * 5 for a faction's heaviest capital unit. This is what makes the supply cap
   * bite — without it a player could field an unlimited army.
   */
  supply: number
  buildMs: number
  spriteSize: { width: number; height: number }
  requiredFactory: BuildingKind
  role: UnitRole
  canAttackAir?: boolean
  canAttackGround?: boolean
  isFlying?: boolean
}

export type BuildingStats = {
  label: string
  hp: number
  cost: number
  /**
   * Supply capacity this structure contributes while alive. Only the command
   * yard and the faction's dedicated supply structure provide any; everything
   * else is 0. Losing a provider can push a player over their cap, which
   * blocks further training until it is rebuilt.
   */
  supply: number
  size: number
  vision: number
  spriteSize: { width: number; height: number }
  /** Weapon profile. Present only on structures that can fire. */
  weapon?: {
    damage: number
    range: number
    cooldown: number
  }
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

type FactionData = {
  name: string
  shortName: string
  tagline: string
  emblem: string
  accent: string
  infantry: UnitKind[]
  factory: UnitKind[]
  air: UnitKind[]
  worker: UnitKind
  startingUnits: UnitKind[]
  buildingLabels: Record<BuildingKind, string>
}

export const FACTION_DATA: Record<Faction, FactionData> = {
  aegis: {
    name: 'Aegis Expeditionary',
    shortName: 'AEGIS',
    tagline: 'Industrial firepower, combined arms, disciplined logistics.',
    emblem: '/assets/ui/faction_player.png',
    accent: '#66e8dd',
    infantry: ['rifleman', 'medic', 'marauder', 'sniper'],
    factory: ['tank', 'artillery', 'walker', 'harvester'],
    air: ['gunship', 'interceptor'],
    worker: 'harvester',
    startingUnits: ['harvester', 'rifleman', 'medic', 'marauder', 'tank'],
    buildingLabels: {
      conyard: 'Construction Yard', power: 'Fusion Reactor', refinery: 'Refinery', barracks: 'Barracks',
      warfactory: 'War Factory', airfield: 'Flight Control', techlab: 'Science Directorate',
      turret: 'Guard Turret', detector: 'Sensor Array',
    },
  },
  noctis: {
    name: 'Noctis Brood',
    shortName: 'NOCTIS',
    tagline: 'Rapid mutation, biological swarms, predatory adaptation.',
    emblem: '/assets/ui/faction_enemy.png',
    accent: '#c684ff',
    infantry: ['skitter', 'spitter', 'broodcaster'],
    factory: ['brute', 'ravager', 'drone'],
    air: ['wraith', 'devourer'],
    worker: 'drone',
    startingUnits: ['drone', 'skitter', 'skitter', 'spitter', 'spitter'],
    buildingLabels: {
      conyard: 'Hive Yard', power: 'Spore Reactor', refinery: 'Biomass Processor', barracks: 'Spawn Pit',
      warfactory: 'Gene Forge', airfield: 'Sky Nest', techlab: 'Cerebral Nexus',
      turret: 'Spine Cannon', detector: 'Seer Node',
    },
  },
  veyra: {
    name: 'Veyra Ascendancy',
    shortName: 'VEYRA',
    tagline: 'Ancient crystal technology, regenerating shields, precision warfare.',
    emblem: '/assets/ui/faction_veyra.png',
    accent: '#e5b6ff',
    infantry: ['lancer', 'adept', 'seer'],
    factory: ['sentinel', 'colossus', 'probe'],
    air: ['seraph', 'arbiter'],
    worker: 'probe',
    startingUnits: ['probe', 'lancer', 'lancer', 'adept', 'adept'],
    buildingLabels: {
      conyard: 'Nexus Core', power: 'Flux Pylon', refinery: 'Crystal Assimilator', barracks: 'Disciple Gate',
      warfactory: 'Forge Sanctum', airfield: 'Star Portal', techlab: 'Archive Spire',
      turret: 'Prism Battery', detector: 'Oracle Beacon',
    },
  },
}

export const DIFFICULTY_DATA: Record<Difficulty, { label: string; aiCredits: number; economy: number; production: number; aggression: number }> = {
  easy: { label: 'Cadet', aiCredits: 2600, economy: 0.82, production: 0.82, aggression: 1.28 },
  normal: { label: 'Standard', aiCredits: 3600, economy: 1, production: 1, aggression: 1 },
  hard: { label: 'Veteran', aiCredits: 4600, economy: 1.12, production: 1.12, aggression: 0.82 },
  brutal: { label: 'Extermination', aiCredits: 6000, economy: 1.28, production: 1.28, aggression: 0.68 },
}

export function defaultEnemyFaction(faction: Faction): Faction {
  if (faction === 'aegis') return 'noctis'
  if (faction === 'noctis') return 'veyra'
  return 'aegis'
}

export function buildingLabel(kind: BuildingKind, faction: Faction): string { return FACTION_DATA[faction].buildingLabels[kind] }
export function factionBuildingIcon(kind: BuildingKind, faction: Faction): string {
  if (faction === 'aegis') return `/assets/ui/${kind}_icon.png`
  if (faction === 'noctis') return `/assets/ui/alien_${kind}_icon.png`
  return `/assets/ui/veyra_${kind}_icon.png`
}

export const UNIT_STATS: Record<UnitKind, UnitStats> = {
  // Aegis infantry / support
  rifleman: { label: 'Rifleman', hp: 95, speed: 110, range: 155, acquireRange: 230, vision: 340, damage: 13, cooldown: 650, cost: 220, supply: 1, buildMs: 1800, spriteSize: { width: 52, height: 52 }, requiredFactory: 'barracks', role: 'infantry', canAttackAir: true, canAttackGround: true },
  medic: { label: 'Field Medic', hp: 82, speed: 110, range: 135, acquireRange: 0, vision: 340, damage: 0, cooldown: 0, cost: 260, supply: 1, buildMs: 2100, spriteSize: { width: 52, height: 52 }, requiredFactory: 'barracks', role: 'support', canAttackAir: false, canAttackGround: false },
  marauder: { label: 'Marauder', hp: 185, speed: 94, range: 180, acquireRange: 250, vision: 350, damage: 24, cooldown: 860, cost: 420, supply: 2, buildMs: 3000, spriteSize: { width: 64, height: 64 }, requiredFactory: 'barracks', role: 'infantry', canAttackAir: false, canAttackGround: true },
  sniper: { label: 'Specter Sniper', hp: 78, speed: 104, range: 310, acquireRange: 370, vision: 430, damage: 48, cooldown: 1700, cost: 620, supply: 2, buildMs: 4300, spriteSize: { width: 54, height: 54 }, requiredFactory: 'barracks', role: 'infantry', canAttackAir: false, canAttackGround: true },
  // Aegis armor / air / economy
  tank: { label: 'Medium Tank', hp: 340, speed: 80, range: 220, acquireRange: 305, vision: 395, damage: 42, cooldown: 1150, cost: 850, supply: 3, buildMs: 4200, spriteSize: { width: 92, height: 92 }, requiredFactory: 'warfactory', role: 'vehicle', canAttackAir: false, canAttackGround: true },
  artillery: { label: 'Siege Artillery', hp: 250, speed: 60, range: 310, acquireRange: 390, vision: 450, damage: 58, cooldown: 1750, cost: 1150, supply: 4, buildMs: 6200, spriteSize: { width: 96, height: 96 }, requiredFactory: 'warfactory', role: 'vehicle', canAttackAir: false, canAttackGround: true },
  walker: { label: 'Goliath Walker', hp: 390, speed: 72, range: 235, acquireRange: 330, vision: 420, damage: 34, cooldown: 920, cost: 1080, supply: 4, buildMs: 5700, spriteSize: { width: 94, height: 94 }, requiredFactory: 'warfactory', role: 'vehicle', canAttackAir: true, canAttackGround: true },
  gunship: { label: 'Gunship', hp: 260, speed: 120, range: 210, acquireRange: 300, vision: 470, damage: 26, cooldown: 760, cost: 980, supply: 3, buildMs: 5600, spriteSize: { width: 94, height: 94 }, requiredFactory: 'airfield', role: 'air', canAttackAir: true, canAttackGround: true, isFlying: true },
  interceptor: { label: 'Valkyrie Interceptor', hp: 190, speed: 154, range: 245, acquireRange: 350, vision: 500, damage: 30, cooldown: 620, cost: 1200, supply: 3, buildMs: 6200, spriteSize: { width: 88, height: 88 }, requiredFactory: 'airfield', role: 'air', canAttackAir: true, canAttackGround: false, isFlying: true },
  harvester: { label: 'Harvester', hp: 430, speed: 65, range: 0, acquireRange: 0, vision: 280, damage: 0, cooldown: 0, cost: 1200, supply: 1, buildMs: 5000, spriteSize: { width: 94, height: 94 }, requiredFactory: 'warfactory', role: 'worker', canAttackAir: false, canAttackGround: false },

  // Noctis
  skitter: { label: 'Skitter Drone', hp: 82, speed: 126, range: 145, acquireRange: 225, vision: 315, damage: 12, cooldown: 540, cost: 190, supply: 1, buildMs: 1500, spriteSize: { width: 60, height: 60 }, requiredFactory: 'barracks', role: 'infantry', canAttackAir: false, canAttackGround: true },
  spitter: { label: 'Spitter Beast', hp: 210, speed: 74, range: 265, acquireRange: 355, vision: 410, damage: 34, cooldown: 980, cost: 440, supply: 2, buildMs: 3000, spriteSize: { width: 88, height: 88 }, requiredFactory: 'barracks', role: 'infantry', canAttackAir: true, canAttackGround: true },
  broodcaster: { label: 'Brood Caster', hp: 150, speed: 82, range: 290, acquireRange: 350, vision: 450, damage: 22, cooldown: 1050, cost: 640, supply: 2, buildMs: 4400, spriteSize: { width: 72, height: 72 }, requiredFactory: 'barracks', role: 'support', canAttackAir: true, canAttackGround: true },
  brute: { label: 'Brute Mauler', hp: 360, speed: 78, range: 190, acquireRange: 285, vision: 365, damage: 40, cooldown: 1080, cost: 840, supply: 3, buildMs: 4300, spriteSize: { width: 96, height: 96 }, requiredFactory: 'warfactory', role: 'vehicle', canAttackAir: false, canAttackGround: true },
  ravager: { label: 'Ravager Strain', hp: 450, speed: 68, range: 230, acquireRange: 320, vision: 400, damage: 52, cooldown: 1350, cost: 1180, supply: 4, buildMs: 6100, spriteSize: { width: 104, height: 104 }, requiredFactory: 'warfactory', role: 'vehicle', canAttackAir: false, canAttackGround: true },
  wraith: { label: 'Wraith Flier', hp: 220, speed: 130, range: 200, acquireRange: 320, vision: 470, damage: 22, cooldown: 700, cost: 950, supply: 3, buildMs: 5200, spriteSize: { width: 90, height: 90 }, requiredFactory: 'airfield', role: 'air', canAttackAir: true, canAttackGround: true, isFlying: true },
  devourer: { label: 'Devourer', hp: 390, speed: 102, range: 250, acquireRange: 350, vision: 470, damage: 46, cooldown: 1120, cost: 1380, supply: 4, buildMs: 7200, spriteSize: { width: 108, height: 108 }, requiredFactory: 'airfield', role: 'air', canAttackAir: true, canAttackGround: true, isFlying: true },
  drone: { label: 'Extractor Drone', hp: 390, speed: 72, range: 0, acquireRange: 0, vision: 300, damage: 0, cooldown: 0, cost: 1050, supply: 1, buildMs: 4600, spriteSize: { width: 92, height: 92 }, requiredFactory: 'warfactory', role: 'worker', canAttackAir: false, canAttackGround: false },

  // Veyra Ascendancy — costly, shielded, precise
  lancer: { label: 'Lancer', hp: 70, shield: 75, shieldRegen: 8, speed: 108, range: 180, acquireRange: 250, vision: 360, damage: 18, cooldown: 720, cost: 280, supply: 1, buildMs: 2100, spriteSize: { width: 58, height: 58 }, requiredFactory: 'barracks', role: 'infantry', canAttackAir: true, canAttackGround: true },
  adept: { label: 'Resonant Adept', hp: 110, shield: 110, shieldRegen: 10, speed: 100, range: 230, acquireRange: 305, vision: 400, damage: 32, cooldown: 980, cost: 520, supply: 2, buildMs: 3500, spriteSize: { width: 66, height: 66 }, requiredFactory: 'barracks', role: 'infantry', canAttackAir: false, canAttackGround: true },
  seer: { label: 'Oracle Seer', hp: 80, shield: 130, shieldRegen: 12, speed: 105, range: 250, acquireRange: 0, vision: 560, damage: 0, cooldown: 0, cost: 650, supply: 2, buildMs: 4300, spriteSize: { width: 64, height: 64 }, requiredFactory: 'barracks', role: 'support', canAttackAir: false, canAttackGround: false },
  sentinel: { label: 'Sentinel Walker', hp: 250, shield: 180, shieldRegen: 10, speed: 78, range: 240, acquireRange: 330, vision: 420, damage: 44, cooldown: 1030, cost: 980, supply: 3, buildMs: 5000, spriteSize: { width: 96, height: 96 }, requiredFactory: 'warfactory', role: 'vehicle', canAttackAir: true, canAttackGround: true },
  colossus: { label: 'Prism Titan', hp: 360, shield: 260, shieldRegen: 12, speed: 56, range: 350, acquireRange: 430, vision: 490, damage: 72, cooldown: 1800, cost: 1650, supply: 5, buildMs: 7800, spriteSize: { width: 118, height: 118 }, requiredFactory: 'warfactory', role: 'vehicle', canAttackAir: false, canAttackGround: true },
  seraph: { label: 'Seraph Fighter', hp: 150, shield: 170, shieldRegen: 11, speed: 156, range: 250, acquireRange: 360, vision: 520, damage: 34, cooldown: 650, cost: 1250, supply: 4, buildMs: 6200, spriteSize: { width: 92, height: 92 }, requiredFactory: 'airfield', role: 'air', canAttackAir: true, canAttackGround: true, isFlying: true },
  arbiter: { label: 'Concord Sphere', hp: 230, shield: 300, shieldRegen: 14, speed: 92, range: 285, acquireRange: 380, vision: 600, damage: 38, cooldown: 980, cost: 1850, supply: 5, buildMs: 8600, spriteSize: { width: 110, height: 110 }, requiredFactory: 'airfield', role: 'air', canAttackAir: true, canAttackGround: true, isFlying: true },
  probe: { label: 'Forgebound Probe', hp: 150, shield: 150, shieldRegen: 12, speed: 82, range: 0, acquireRange: 0, vision: 340, damage: 0, cooldown: 0, cost: 1150, supply: 1, buildMs: 4700, spriteSize: { width: 84, height: 84 }, requiredFactory: 'warfactory', role: 'worker', canAttackAir: false, canAttackGround: false },
}

/**
 * Maximum supply a player can ever reach, regardless of how many providers they
 * build. Without a ceiling the late game degenerates into whoever can spam the
 * most supply structures, and the pathfinding/collision cost of the resulting
 * army sizes is not something the simulation is built for.
 */
export const MAX_SUPPLY = 200

export const BUILDING_STATS: Record<BuildingKind, BuildingStats> = {
  conyard: { label: 'Command Core', hp: 1500, cost: 0, supply: 12, size: 110, vision: 430, spriteSize: { width: 160, height: 160 } },
  power: { label: 'Power Structure', hp: 680, cost: 600, supply: 10, size: 82, vision: 255, spriteSize: { width: 128, height: 128 } },
  refinery: { label: 'Resource Processor', hp: 920, cost: 1400, supply: 0, size: 105, vision: 310, spriteSize: { width: 148, height: 148 } },
  barracks: { label: 'Infantry Structure', hp: 720, cost: 700, supply: 0, size: 82, vision: 295, spriteSize: { width: 136, height: 136 } },
  warfactory: { label: 'Heavy Production', hp: 1080, cost: 2000, supply: 0, size: 115, vision: 335, spriteSize: { width: 164, height: 164 } },
  airfield: { label: 'Air Production', hp: 950, cost: 1750, supply: 0, size: 104, vision: 370, spriteSize: { width: 150, height: 150 } },
  techlab: { label: 'Advanced Research', hp: 820, cost: 1550, supply: 0, size: 92, vision: 390, spriteSize: { width: 140, height: 140 } },
  turret: { label: 'Defense Turret', hp: 540, cost: 650, supply: 0, size: 58, vision: 455, spriteSize: { width: 108, height: 108 }, weapon: { damage: 28, range: 260, cooldown: 850 } },
  detector: { label: 'Detection Array', hp: 480, cost: 850, supply: 0, size: 60, vision: 700, spriteSize: { width: 105, height: 105 } },
}

export const UPGRADE_DEFS: Record<UpgradeKey, UpgradeDefinition> = {
  // Aegis
  aegis_composite_plating: { key: 'aegis_composite_plating', faction: 'aegis', label: 'Composite Plating', description: 'Aegis units take 12% less damage.', cost: 700, researchMs: 9000, requiredBuilding: 'barracks', prerequisites: [], tier: 1 },
  aegis_targeting_ai: { key: 'aegis_targeting_ai', faction: 'aegis', label: 'Targeting AI', description: '+12% weapon damage and +30 sight range.', cost: 850, researchMs: 10500, requiredBuilding: 'barracks', prerequisites: [], tier: 1 },
  aegis_reactor_optimization: { key: 'aegis_reactor_optimization', faction: 'aegis', label: 'Reactor Optimization', description: '+18% production speed and +15% harvesting yield.', cost: 900, researchMs: 11000, requiredBuilding: 'refinery', prerequisites: [], tier: 1 },
  aegis_precision_school: { key: 'aegis_precision_school', faction: 'aegis', label: 'Precision School', description: 'Unlocks Ghost Snipers.', cost: 900, researchMs: 11000, requiredBuilding: 'techlab', prerequisites: ['aegis_targeting_ai'], tier: 2 },
  aegis_siege_doctrine: { key: 'aegis_siege_doctrine', faction: 'aegis', label: 'Siege Doctrine', description: 'Unlocks Siege Artillery.', cost: 1200, researchMs: 14000, requiredBuilding: 'techlab', prerequisites: ['aegis_targeting_ai'], tier: 2 },
  aegis_heavy_chassis: { key: 'aegis_heavy_chassis', faction: 'aegis', label: 'Heavy Chassis', description: 'Unlocks Goliath Walkers and improves vehicle durability.', cost: 1250, researchMs: 14500, requiredBuilding: 'techlab', prerequisites: ['aegis_composite_plating'], tier: 2 },
  aegis_aerospace_command: { key: 'aegis_aerospace_command', faction: 'aegis', label: 'Aerospace Command', description: 'Unlocks Gunships and improves air vision.', cost: 1300, researchMs: 15000, requiredBuilding: 'airfield', prerequisites: ['aegis_reactor_optimization'], tier: 2 },
  aegis_interceptor_program: { key: 'aegis_interceptor_program', faction: 'aegis', label: 'Interceptor Program', description: 'Unlocks Valkyrie Interceptors.', cost: 1450, researchMs: 16500, requiredBuilding: 'airfield', prerequisites: ['aegis_aerospace_command'], tier: 3 },
  aegis_nanomedicine: { key: 'aegis_nanomedicine', faction: 'aegis', label: 'Nanomedicine', description: 'Field Medics heal 35% faster.', cost: 1100, researchMs: 12500, requiredBuilding: 'techlab', prerequisites: ['aegis_reactor_optimization'], tier: 2 },

  // Noctis
  noctis_carapace_grafting: { key: 'noctis_carapace_grafting', faction: 'noctis', label: 'Carapace Grafting', description: 'Brood units take 12% less damage.', cost: 680, researchMs: 9000, requiredBuilding: 'barracks', prerequisites: [], tier: 1 },
  noctis_synaptic_acceleration: { key: 'noctis_synaptic_acceleration', faction: 'noctis', label: 'Synaptic Acceleration', description: '+12% speed and 10% faster attacks.', cost: 820, researchMs: 10500, requiredBuilding: 'barracks', prerequisites: [], tier: 1 },
  noctis_metabolic_bloom: { key: 'noctis_metabolic_bloom', faction: 'noctis', label: 'Metabolic Bloom', description: '+18% production speed and +15% biomass harvesting.', cost: 880, researchMs: 11000, requiredBuilding: 'refinery', prerequisites: [], tier: 1 },
  noctis_acid_evolution: { key: 'noctis_acid_evolution', faction: 'noctis', label: 'Acid Evolution', description: 'Spitters gain +20% damage and +35 range.', cost: 1050, researchMs: 12500, requiredBuilding: 'techlab', prerequisites: ['noctis_synaptic_acceleration'], tier: 2 },
  noctis_brood_mind: { key: 'noctis_brood_mind', faction: 'noctis', label: 'Brood Mind', description: 'Unlocks Brood Casters.', cost: 980, researchMs: 12000, requiredBuilding: 'techlab', prerequisites: ['noctis_synaptic_acceleration'], tier: 2 },
  noctis_alpha_mauler: { key: 'noctis_alpha_mauler', faction: 'noctis', label: 'Alpha Mauler Strain', description: 'Unlocks Brute Maulers.', cost: 1150, researchMs: 13500, requiredBuilding: 'warfactory', prerequisites: ['noctis_carapace_grafting'], tier: 2 },
  noctis_ravager_strain: { key: 'noctis_ravager_strain', faction: 'noctis', label: 'Ravager Strain', description: 'Unlocks Ravagers.', cost: 1400, researchMs: 16000, requiredBuilding: 'techlab', prerequisites: ['noctis_alpha_mauler'], tier: 3 },
  noctis_phase_brood: { key: 'noctis_phase_brood', faction: 'noctis', label: 'Phase Brood', description: 'Unlocks Wraith Fliers.', cost: 1300, researchMs: 15000, requiredBuilding: 'airfield', prerequisites: ['noctis_metabolic_bloom'], tier: 2 },
  noctis_devourer_strain: { key: 'noctis_devourer_strain', faction: 'noctis', label: 'Devourer Strain', description: 'Unlocks Devourer heavy fliers.', cost: 1550, researchMs: 17500, requiredBuilding: 'airfield', prerequisites: ['noctis_phase_brood'], tier: 3 },

  // Veyra
  veyra_shield_harmonics: { key: 'veyra_shield_harmonics', faction: 'veyra', label: 'Shield Harmonics', description: '+35% shield regeneration.', cost: 780, researchMs: 9500, requiredBuilding: 'barracks', prerequisites: [], tier: 1 },
  veyra_resonance_matrix: { key: 'veyra_resonance_matrix', faction: 'veyra', label: 'Resonance Matrix', description: '+12% weapon damage and +25 range.', cost: 930, researchMs: 11000, requiredBuilding: 'barracks', prerequisites: [], tier: 1 },
  veyra_crystal_efficiency: { key: 'veyra_crystal_efficiency', faction: 'veyra', label: 'Crystal Efficiency', description: '+18% production speed and +15% harvesting yield.', cost: 950, researchMs: 11500, requiredBuilding: 'refinery', prerequisites: [], tier: 1 },
  veyra_phase_doctrine: { key: 'veyra_phase_doctrine', faction: 'veyra', label: 'Phase Doctrine', description: 'Adepts and Lancers gain improved movement speed.', cost: 1050, researchMs: 12500, requiredBuilding: 'techlab', prerequisites: ['veyra_resonance_matrix'], tier: 2 },
  veyra_oracle_path: { key: 'veyra_oracle_path', faction: 'veyra', label: 'Oracle Path', description: 'Unlocks Oracle Seers and improves detection.', cost: 1000, researchMs: 12000, requiredBuilding: 'techlab', prerequisites: ['veyra_shield_harmonics'], tier: 2 },
  veyra_sentinel_awakening: { key: 'veyra_sentinel_awakening', faction: 'veyra', label: 'Sentinel Awakening', description: 'Unlocks Sentinel Walkers.', cost: 1250, researchMs: 14000, requiredBuilding: 'warfactory', prerequisites: ['veyra_shield_harmonics'], tier: 2 },
  veyra_colossus_protocol: { key: 'veyra_colossus_protocol', faction: 'veyra', label: 'Colossus Protocol', description: 'Unlocks Prism Colossi.', cost: 1650, researchMs: 18000, requiredBuilding: 'techlab', prerequisites: ['veyra_sentinel_awakening', 'veyra_resonance_matrix'], tier: 3 },
  veyra_star_gate: { key: 'veyra_star_gate', faction: 'veyra', label: 'Star Communion', description: 'Unlocks Seraph Fighters.', cost: 1350, researchMs: 15000, requiredBuilding: 'airfield', prerequisites: ['veyra_crystal_efficiency'], tier: 2 },
  veyra_arbiter_convergence: { key: 'veyra_arbiter_convergence', faction: 'veyra', label: 'Arbiter Convergence', description: 'Unlocks Arbiter Spheres.', cost: 1800, researchMs: 19000, requiredBuilding: 'airfield', prerequisites: ['veyra_star_gate', 'veyra_shield_harmonics'], tier: 3 },
}

export const UNIT_UNLOCK_UPGRADE: Partial<Record<UnitKind, UpgradeKey>> = {
  sniper: 'aegis_precision_school', artillery: 'aegis_siege_doctrine', walker: 'aegis_heavy_chassis', gunship: 'aegis_aerospace_command', interceptor: 'aegis_interceptor_program',
  broodcaster: 'noctis_brood_mind', brute: 'noctis_alpha_mauler', ravager: 'noctis_ravager_strain', wraith: 'noctis_phase_brood', devourer: 'noctis_devourer_strain',
  seer: 'veyra_oracle_path', sentinel: 'veyra_sentinel_awakening', colossus: 'veyra_colossus_protocol', seraph: 'veyra_star_gate', arbiter: 'veyra_arbiter_convergence',
}

export function isUnitUnlocked(kind: UnitKind, completed: ReadonlySet<UpgradeKey>): boolean {
  const requirement = UNIT_UNLOCK_UPGRADE[kind]
  return !requirement || completed.has(requirement)
}

const ALL_UNIT_KINDS = Object.keys(UNIT_STATS) as UnitKind[]
export const ALL_BUILDING_KINDS: BuildingKind[] = ['conyard', 'power', 'refinery', 'barracks', 'warfactory', 'airfield', 'techlab', 'turret', 'detector']
export const WORKER_KINDS = new Set<UnitKind>(['harvester', 'drone', 'probe'])

export type AbilityDefinition = {
  key: AbilityKey
  faction: Faction
  label: string
  description: string
  /**
   * Unit kinds that can use the ability. An empty list means the ability
   * applies to any selection belonging to the faction.
   */
  requiresKinds: UnitKind[]
}

/**
 * Faction abilities offered on the command card. Declared as data so the card
 * can render and enable/disable them generically; previously this mapping lived
 * as hardcoded JSX branches in the old command panel, where the enabling rules
 * were invisible to everything else in the codebase.
 */
export const ABILITY_DEFS: AbilityDefinition[] = [
  { key: 'stim', faction: 'aegis', label: 'Stim Burst', description: 'Temporary attack and movement boost for front-line infantry.', requiresKinds: ['rifleman', 'marauder'] },
  { key: 'siege', faction: 'aegis', label: 'Toggle Siege', description: 'Anchor artillery for greatly increased range.', requiresKinds: ['artillery'] },
  { key: 'afterburners', faction: 'aegis', label: 'Afterburners', description: 'Burst of speed for aircraft.', requiresKinds: ['gunship', 'interceptor'] },
  { key: 'frenzy', faction: 'noctis', label: 'Brood Frenzy', description: 'Drives melee organisms into a temporary rage.', requiresKinds: ['skitter', 'brute', 'ravager'] },
  { key: 'acid_burst', faction: 'noctis', label: 'Acid Surge', description: 'Corrosive volley from ranged organisms.', requiresKinds: ['spitter', 'broodcaster'] },
  { key: 'phase', faction: 'noctis', label: 'Phase Veil', description: 'Briefly cloaks flying organisms.', requiresKinds: ['wraith', 'devourer'] },
  { key: 'shield_surge', faction: 'veyra', label: 'Shield Surge', description: 'Immediately restores shields across the selection.', requiresKinds: [] },
  { key: 'phase_stride', faction: 'veyra', label: 'Phase Stride', description: 'Short-range blink for disciples.', requiresKinds: ['lancer', 'adept', 'seer'] },
  { key: 'overcharge', faction: 'veyra', label: 'Overcharge', description: 'Amplifies the weapons of heavy constructs.', requiresKinds: ['sentinel', 'colossus', 'seraph', 'arbiter'] },
]


export const UI_ICONS: Record<UnitKind | BuildingKind, string> = {
  conyard: '/assets/ui/conyard_icon.png', power: '/assets/ui/power_icon.png', refinery: '/assets/ui/refinery_icon.png', barracks: '/assets/ui/barracks_icon.png', warfactory: '/assets/ui/warfactory_icon.png', airfield: '/assets/ui/airfield_icon.png', techlab: '/assets/ui/techlab_icon.png', turret: '/assets/ui/turret_icon.png', detector: '/assets/ui/detector_icon.png',
  rifleman: '/assets/ui/rifleman_icon.png', medic: '/assets/ui/medic_icon.png', marauder: '/assets/ui/marauder_icon.png', sniper: '/assets/ui/sniper_icon.png', tank: '/assets/ui/tank_icon.png', artillery: '/assets/ui/artillery_icon.png', walker: '/assets/ui/walker_icon.png', gunship: '/assets/ui/gunship_icon.png', interceptor: '/assets/ui/interceptor_icon.png', harvester: '/assets/ui/harvester_icon.png',
  skitter: '/assets/ui/skitter_icon.png', spitter: '/assets/ui/spitter_icon.png', broodcaster: '/assets/ui/broodcaster_icon.png', brute: '/assets/ui/brute_icon.png', ravager: '/assets/ui/ravager_icon.png', wraith: '/assets/ui/wraith_icon.png', devourer: '/assets/ui/devourer_icon.png', drone: '/assets/ui/drone_icon.png',
  lancer: '/assets/ui/lancer_icon.png', adept: '/assets/ui/adept_icon.png', seer: '/assets/ui/seer_icon.png', sentinel: '/assets/ui/sentinel_icon.png', colossus: '/assets/ui/colossus_icon.png', seraph: '/assets/ui/seraph_icon.png', arbiter: '/assets/ui/arbiter_icon.png', probe: '/assets/ui/probe_icon.png',
}

const PORTRAITS: Record<UnitKind, string> = Object.fromEntries(ALL_UNIT_KINDS.map((kind) => [kind, `/assets/portraits/${kind}.png`])) as Record<UnitKind, string>

/**
 * Best available artwork for an entity in the HUD: a full portrait where one
 * exists (units), otherwise the command icon (structures). Structure kinds are
 * shared across factions, so the faction — when the caller knows it — selects
 * the right racial variant of the icon.
 */
export function portraitFor(entity: { kind: UnitKind | BuildingKind; faction?: Faction }): string {
  if (entity.kind in PORTRAITS) return PORTRAITS[entity.kind as UnitKind]
  const kind = entity.kind as BuildingKind
  return entity.faction ? factionBuildingIcon(kind, entity.faction) : UI_ICONS[kind]
}
export const TEAM_TINT = { player: 0xe9f8f6, enemy: 0xffe7e7 } as const

/**
 * Ground vehicle kinds that are rendered as two layers: a hull sprite that
 * always faces the unit's direction of travel, and a separate turret sprite
 * that independently rotates to track the current attack target. Air units
 * and infantry are single-layer — a turret only makes sense on a chassis the
 * camera can see the top of.
 */
const TURRET_UNIT_KINDS: ReadonlySet<UnitKind> = new Set<UnitKind>([
  'tank', 'artillery', 'walker', 'brute', 'ravager', 'sentinel', 'colossus',
])

export function hasTurret(kind: UnitKind): boolean {
  return TURRET_UNIT_KINDS.has(kind)
}

/** Frame name within the 'units' texture atlas for a unit's hull/body. */
export function unitAtlasFrame(kind: UnitKind): string {
  return kind
}

/** Frame name within the 'units' texture atlas for a unit's turret layer. */
export function unitTurretAtlasFrame(kind: UnitKind): string {
  return `${kind}_turret`
}

/** Frame name within the 'buildings' texture atlas for a faction's building variant. */
export function buildingAtlasFrame(kind: BuildingKind, faction: Faction): string {
  return faction === 'aegis' ? kind : `${faction}_${kind}`
}
