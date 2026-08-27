import { create } from 'zustand'
import type { BuildingKind, Difficulty, Faction, GameAlert, GameStatus, Mission, ProductionQueueView, ResearchQueueView, SelectedEntity, UpgradeKey } from '../types'

/**
 * How many alerts are retained. The log is a ring buffer rather than an
 * unbounded list because alerts fire continuously during a match and nothing
 * would otherwise ever prune them.
 */
const ALERT_LIMIT = 40

let nextAlertId = 1

type GameState = {
  mission: Mission | null
  missions: Mission[]
  faction: Faction
  enemyFaction: Faction
  difficulty: Difficulty
  credits: number
  /**
   * Supply consumed by living units, and the cap provided by structures. Named
   * "supply" rather than "power" because it gates unit production the way
   * StarCraft supply does; the `power` BuildingKind that provides it keeps its
   * own name.
   */
  supplyUsed: number
  supplyCap: number
  /** Credits per minute currently being harvested, for the resource readout. */
  income: number
  selected: SelectedEntity[]
  status: GameStatus
  message: string
  alerts: GameAlert[]
  placementKind: BuildingKind | null
  productionQueues: ProductionQueueView[]
  researchQueues: ResearchQueueView[]
  completedUpgrades: UpgradeKey[]
  attackMoveArmed: boolean
  controlGroups: Record<number, number>
  setMission: (mission: Mission) => void
  setMissionCatalog: (missions: Mission[]) => void
  setFaction: (faction: Faction) => void
  setEnemyFaction: (faction: Faction) => void
  setDifficulty: (difficulty: Difficulty) => void
  setEconomy: (credits: number, supplyUsed: number, supplyCap: number, income: number) => void
  setSelected: (selected: SelectedEntity[]) => void
  setStatus: (status: GameStatus, message?: string) => void
  pushAlert: (alert: Omit<GameAlert, 'id' | 'at'>) => void
  clearAlerts: () => void
  setPlacementKind: (kind: BuildingKind | null) => void
  setProductionQueues: (queues: ProductionQueueView[]) => void
  setResearchQueues: (queues: ResearchQueueView[]) => void
  setCompletedUpgrades: (upgrades: UpgradeKey[]) => void
  setAttackMoveArmed: (armed: boolean) => void
  setControlGroups: (groups: Record<number, number>) => void
  resetBattleState: () => void
}

/**
 * Per-match state, cleared whenever a match starts, restarts, or is abandoned.
 * Kept as one object because these fields were previously spelled out inline in
 * four separate reset paths that had already drifted apart from each other.
 */
const emptyBattleState = {
  credits: 0,
  supplyUsed: 0,
  supplyCap: 0,
  income: 0,
  selected: [] as SelectedEntity[],
  alerts: [] as GameAlert[],
  placementKind: null as BuildingKind | null,
  productionQueues: [] as ProductionQueueView[],
  researchQueues: [] as ResearchQueueView[],
  completedUpgrades: [] as UpgradeKey[],
  attackMoveArmed: false,
  controlGroups: {} as Record<number, number>,
}

export const useGameStore = create<GameState>((set) => ({
  mission: null,
  missions: [],
  faction: 'aegis',
  enemyFaction: 'noctis',
  difficulty: 'normal',
  status: 'loading',
  message: 'Loading command network…',
  ...emptyBattleState,
  setMission: (mission) => set({ ...emptyBattleState, mission, credits: mission.definition.starting_credits, status: 'playing' }),
  setMissionCatalog: (missions) => set({ missions }),
  setFaction: (faction) => set({ ...emptyBattleState, faction }),
  setEnemyFaction: (enemyFaction) => set({ enemyFaction }),
  setDifficulty: (difficulty) => set({ difficulty }),
  setEconomy: (credits, supplyUsed, supplyCap, income) => set({ credits, supplyUsed, supplyCap, income }),
  setSelected: (selected) => set({ selected }),
  setStatus: (status, message = '') => set({ status, message }),
  pushAlert: (alert) =>
    set((state) => ({
      alerts: [...state.alerts, { ...alert, id: nextAlertId++, at: Date.now() }].slice(-ALERT_LIMIT),
    })),
  clearAlerts: () => set({ alerts: [] }),
  setPlacementKind: (placementKind) => set({ placementKind }),
  setProductionQueues: (productionQueues) => set({ productionQueues }),
  setResearchQueues: (researchQueues) => set({ researchQueues }),
  setCompletedUpgrades: (completedUpgrades) => set({ completedUpgrades }),
  setAttackMoveArmed: (attackMoveArmed) => set({ attackMoveArmed }),
  setControlGroups: (controlGroups) => set({ controlGroups }),
  resetBattleState: () => set({ ...emptyBattleState, status: 'loading' }),
}))
