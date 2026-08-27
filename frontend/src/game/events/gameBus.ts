import type { BuildingKind, UnitKind, UpgradeKey } from '../../types'
import type { AbilityKey } from '../config'

type Events = {
  'build-structure': BuildingKind
  'produce-unit': UnitKind
  'research-upgrade': UpgradeKey
  'cancel-production': string
  'restart-game': undefined
  'save-game': undefined
  'placement-pointer-move': { u: number; v: number }
  'placement-pointer-down': { u: number; v: number }
  'cancel-placement': undefined
  'stop-selected': undefined
  'center-selected': undefined
  'arm-attack-move': undefined
  'activate-ability': AbilityKey
}

type Handler<K extends keyof Events> = (payload: Events[K]) => void

class GameBus {
  private listeners = new Map<keyof Events, Set<(payload: never) => void>>()

  on<K extends keyof Events>(event: K, handler: Handler<K>): () => void {
    const set = this.listeners.get(event) ?? new Set<(payload: never) => void>()
    set.add(handler as (payload: never) => void)
    this.listeners.set(event, set)
    return () => set.delete(handler as (payload: never) => void)
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    this.listeners.get(event)?.forEach((handler) => handler(payload as never))
  }
}

export const gameBus = new GameBus()
