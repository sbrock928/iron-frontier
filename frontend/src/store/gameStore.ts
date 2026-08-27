import { create } from 'zustand'
import type { BuildingKind, Faction, GameStatus, Mission, ProductionQueueView, ResearchQueueView, SelectedEntity, UpgradeKey } from '../types'

type GameState = {
  mission: Mission | null
  missions: Mission[]
  faction: Faction
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
  setMission: (mission: Mission) => void
  setMissionCatalog: (missions: Mission[]) => void
  setFaction: (faction: Faction) => void
  setEconomy: (credits: number, powerUsed: number, powerCapacity: number) => void
  setSelected: (selected: SelectedEntity[]) => void
  setStatus: (status: GameStatus, message?: string) => void
  setPlacementKind: (kind: BuildingKind | null) => void
  setProductionQueues: (queues: ProductionQueueView[]) => void
  setResearchQueues: (queues: ResearchQueueView[]) => void
  setCompletedUpgrades: (upgrades: UpgradeKey[]) => void
  setAttackMoveArmed: (armed: boolean) => void
  reset: () => void
}

export const useGameStore = create<GameState>((set) => ({
  mission: null,
  missions: [],
  faction: 'aegis',
  credits: 0,
  powerUsed: 0,
  powerCapacity: 0,
  selected: [],
  status: 'loading',
  message: 'Loading mission…',
  placementKind: null,
  productionQueues: [],
  researchQueues: [],
  completedUpgrades: [],
  attackMoveArmed: false,
  setMission: (mission) => set({ mission, credits: mission.definition.starting_credits, status: 'playing', selected: [], productionQueues: [], researchQueues: [], completedUpgrades: [], attackMoveArmed: false }),
  setMissionCatalog: (missions) => set({ missions }),
  setFaction: (faction) => set({ faction, selected: [], placementKind: null, productionQueues: [], researchQueues: [], completedUpgrades: [], attackMoveArmed: false }),
  setEconomy: (credits, powerUsed, powerCapacity) => set({ credits, powerUsed, powerCapacity }),
  setSelected: (selected) => set({ selected }),
  setStatus: (status, message = '') => set({ status, message }),
  setPlacementKind: (placementKind) => set({ placementKind }),
  setProductionQueues: (productionQueues) => set({ productionQueues }),
  setResearchQueues: (researchQueues) => set({ researchQueues }),
  setCompletedUpgrades: (completedUpgrades) => set({ completedUpgrades }),
  setAttackMoveArmed: (attackMoveArmed) => set({ attackMoveArmed }),
  reset: () => set({ credits: 0, powerUsed: 0, powerCapacity: 0, selected: [], status: 'loading', placementKind: null, productionQueues: [], researchQueues: [], completedUpgrades: [], attackMoveArmed: false }),
}))
