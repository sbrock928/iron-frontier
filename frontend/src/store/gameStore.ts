import { create } from 'zustand'
import type { BuildingKind, Faction, GameStatus, Mission, SelectedEntity } from '../types'

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
  setMission: (mission: Mission) => void
  setMissionCatalog: (missions: Mission[]) => void
  setFaction: (faction: Faction) => void
  setEconomy: (credits: number, powerUsed: number, powerCapacity: number) => void
  setSelected: (selected: SelectedEntity[]) => void
  setStatus: (status: GameStatus, message?: string) => void
  setPlacementKind: (kind: BuildingKind | null) => void
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
  setMission: (mission) => set({ mission, credits: mission.definition.starting_credits, status: 'playing', selected: [] }),
  setMissionCatalog: (missions) => set({ missions }),
  setFaction: (faction) => set({ faction, selected: [], placementKind: null }),
  setEconomy: (credits, powerUsed, powerCapacity) => set({ credits, powerUsed, powerCapacity }),
  setSelected: (selected) => set({ selected }),
  setStatus: (status, message = '') => set({ status, message }),
  setPlacementKind: (placementKind) => set({ placementKind }),
  reset: () => set({ credits: 0, powerUsed: 0, powerCapacity: 0, selected: [], status: 'loading', placementKind: null }),
}))
