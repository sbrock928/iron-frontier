import type { BuildingKind, MinimapSnapshot, UnitKind, UpgradeKey } from '../../types'
import type { AbilityKey } from '../config'

type Events = {
  'build-structure': BuildingKind
  'produce-unit': UnitKind
  'research-upgrade': UpgradeKey
  'cancel-production': string
  'restart-game': undefined
  'placement-pointer-move': { u: number; v: number }
  'placement-pointer-down': { u: number; v: number }
  'cancel-placement': undefined
  'stop-selected': undefined
  'center-selected': undefined
  'arm-attack-move': undefined
  'activate-ability': AbilityKey
  'recall-control-group': number
  /** Scene -> HUD, on a fixed low-rate timer, to repaint the DOM minimap. */
  'minimap-snapshot': MinimapSnapshot
  /**
   * HUD -> scene. Normalised 0-1 minimap coordinates plus the intent: `move`
   * recentres the camera, `command` issues an order at that world point.
   */
  'minimap-command': { u: number; v: number; action: 'move' | 'command' }
  /** HUD -> scene, to centre the camera on an alert's world position. */
  'jump-to-world': { x: number; y: number }
  /** HUD -> scene, to reduce the selection to a single entity. */
  'selection-isolate': string
  /** HUD -> scene, to drop a single entity from the selection. */
  'selection-remove': string
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
