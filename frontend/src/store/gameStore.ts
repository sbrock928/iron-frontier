import { create } from 'zustand'
import type { BuildingKind, Difficulty, Faction, GameStatus, Mission, ProductionQueueView, ResearchQueueView, SelectedEntity, UpgradeKey } from '../types'

type GameState = {
  mission: Mission | null
  missions: Mission[]
  faction: Faction
  enemyFaction: Faction
  difficulty: Difficulty
  credits: number
  powerUsed: number
  powerCapacity: number
  selected: SelectedEntity[]
  status: GameStatus
  message: string
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
  setEconomy: (credits: number, powerUsed: number, powerCapacity: number) => void
  setSelected: (selected: SelectedEntity[]) => void
  setStatus: (status: GameStatus, message?: string) => void
  setPlacementKind: (kind: BuildingKind | null) => void
  setProductionQueues: (queues: ProductionQueueView[]) => void
  setResearchQueues: (queues: ResearchQueueView[]) => void
  setCompletedUpgrades: (upgrades: UpgradeKey[]) => void
  setAttackMoveArmed: (armed: boolean) => void
  setControlGroups: (groups: Record<number, number>) => void
  resetBattleState: () => void
}

export const useGameStore = create<GameState>((set) => ({
  mission: null,
  missions: [],
  faction: 'aegis',
  enemyFaction: 'noctis',
  difficulty: 'normal',
  credits: 0,
  powerUsed: 0,
  powerCapacity: 0,
  selected: [],
  status: 'loading',
  message: 'Loading command network…',
  placementKind: null,
  productionQueues: [],
  researchQueues: [],
  completedUpgrades: [],
  attackMoveArmed: false,
  controlGroups: {},
  setMission: (mission) => set({ mission, credits: mission.definition.starting_credits, status: 'playing', selected: [], productionQueues: [], researchQueues: [], completedUpgrades: [], attackMoveArmed: false, controlGroups: {} }),
  setMissionCatalog: (missions) => set({ missions }),
  setFaction: (faction) => set({ faction, selected: [], placementKind: null, productionQueues: [], researchQueues: [], completedUpgrades: [], attackMoveArmed: false, controlGroups: {} }),
  setEnemyFaction: (enemyFaction) => set({ enemyFaction }),
  setDifficulty: (difficulty) => set({ difficulty }),
  setEconomy: (credits, powerUsed, powerCapacity) => set({ credits, powerUsed, powerCapacity }),
  setSelected: (selected) => set({ selected }),
  setStatus: (status, message = '') => set({ status, message }),
  setPlacementKind: (placementKind) => set({ placementKind }),
  setProductionQueues: (productionQueues) => set({ productionQueues }),
  setResearchQueues: (researchQueues) => set({ researchQueues }),
  setCompletedUpgrades: (completedUpgrades) => set({ completedUpgrades }),
  setAttackMoveArmed: (attackMoveArmed) => set({ attackMoveArmed }),
  setControlGroups: (controlGroups) => set({ controlGroups }),
  resetBattleState: () => set({ credits: 0, powerUsed: 0, powerCapacity: 0, selected: [], status: 'loading', placementKind: null, productionQueues: [], researchQueues: [], completedUpgrades: [], attackMoveArmed: false, controlGroups: {} }),
}))
