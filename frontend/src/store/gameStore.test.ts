import { beforeEach, describe, expect, it } from 'vitest'
import { useGameStore } from './gameStore'
import type { Mission, SelectedEntity } from '../types'

const mission: Mission = {
  id: 'mission_test',
  name: 'Test Op',
  description: 'Fixture',
  definition: {
    world_width: 4000,
    world_height: 3000,
    starting_credits: 5000,
    player_spawn: { x: 100, y: 100 },
    enemy_spawn: { x: 900, y: 900 },
    ore_fields: [],
    objectives: [],
    enemy: { starting_units: 5, wave_interval_ms: 30000, wave_size: 3 },
  },
} as unknown as Mission

const entity = (id: string): SelectedEntity => ({
  id, label: id, kind: 'rifleman', hp: 10, maxHp: 10, team: 'player',
})

beforeEach(() => {
  useGameStore.getState().resetBattleState()
})

describe('alerts', () => {
  it('assigns each alert a distinct id so React keys stay stable', () => {
    const { pushAlert } = useGameStore.getState()
    pushAlert({ message: 'one', severity: 'info' })
    pushAlert({ message: 'two', severity: 'info' })
    const ids = useGameStore.getState().alerts.map((alert) => alert.id)
    expect(new Set(ids).size).toBe(2)
  })

  it('keeps only the most recent alerts once the ring buffer is full', () => {
    const { pushAlert } = useGameStore.getState()
    for (let index = 0; index < 60; index += 1) {
      pushAlert({ message: `alert ${index}`, severity: 'info' })
    }
    const { alerts } = useGameStore.getState()
    expect(alerts.length).toBeLessThanOrEqual(40)
    // The newest must survive; the oldest must have been dropped.
    expect(alerts.at(-1)?.message).toBe('alert 59')
    expect(alerts.some((alert) => alert.message === 'alert 0')).toBe(false)
  })

  it('preserves severity and optional world position', () => {
    useGameStore.getState().pushAlert({ message: 'under attack', severity: 'critical', at_world: { x: 5, y: 6 } })
    const alert = useGameStore.getState().alerts.at(-1)
    expect(alert?.severity).toBe('critical')
    expect(alert?.at_world).toEqual({ x: 5, y: 6 })
  })
})

describe('battle state resets', () => {
  it('clears every per-match field when a mission starts', () => {
    const store = useGameStore.getState()
    store.setEconomy(9999, 40, 50, 300)
    store.setSelected([entity('a')])
    store.pushAlert({ message: 'stale', severity: 'info' })
    store.setAttackMoveArmed(true)
    store.setOwnedBuildingKinds(['barracks'])
    store.setCompletedUpgrades(['aegis_targeting_ai'])

    useGameStore.getState().setMission(mission)

    const next = useGameStore.getState()
    expect(next.selected).toEqual([])
    expect(next.alerts).toEqual([])
    expect(next.attackMoveArmed).toBe(false)
    expect(next.ownedBuildingKinds).toEqual([])
    expect(next.completedUpgrades).toEqual([])
    expect(next.supplyUsed).toBe(0)
    expect(next.supplyCap).toBe(0)
    expect(next.income).toBe(0)
    // Credits are the one field seeded from the mission rather than zeroed.
    expect(next.credits).toBe(5000)
    expect(next.status).toBe('playing')
  })

  it('clears the same fields when the faction changes', () => {
    const store = useGameStore.getState()
    store.setSelected([entity('a')])
    store.pushAlert({ message: 'stale', severity: 'info' })

    useGameStore.getState().setFaction('veyra')

    const next = useGameStore.getState()
    expect(next.faction).toBe('veyra')
    expect(next.selected).toEqual([])
    expect(next.alerts).toEqual([])
  })

  it('returns to loading when a match is abandoned', () => {
    useGameStore.getState().setStatus('victory', 'done')
    useGameStore.getState().resetBattleState()
    expect(useGameStore.getState().status).toBe('loading')
  })
})

describe('economy', () => {
  it('records supply and income together with credits', () => {
    useGameStore.getState().setEconomy(1200, 18, 22, 450)
    const { credits, supplyUsed, supplyCap, income } = useGameStore.getState()
    expect({ credits, supplyUsed, supplyCap, income }).toEqual({
      credits: 1200, supplyUsed: 18, supplyCap: 22, income: 450,
    })
  })
})
