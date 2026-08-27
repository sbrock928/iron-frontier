import { describe, expect, it } from 'vitest'
import { BUILDING_STATS, MAX_SUPPLY, UNIT_STATS } from './config'
import type { BuildingKind, UnitKind } from '../types'

const unitKinds = Object.keys(UNIT_STATS) as UnitKind[]
const buildingKinds = Object.keys(BUILDING_STATS) as BuildingKind[]

/**
 * These guard the supply economy at the data level.
 *
 * The bug that motivated them: the HUD displayed "Supply" while the underlying
 * model only ever summed building power, so units cost nothing and the cap was
 * unreachable. A test asserting that every unit has a non-zero supply cost
 * would have failed immediately.
 */
describe('supply economy', () => {
  it('charges every unit at least one supply', () => {
    for (const kind of unitKinds) {
      expect(UNIT_STATS[kind].supply, `${kind} must cost supply`).toBeGreaterThanOrEqual(1)
    }
  })

  it('keeps supply cost integral so the cap cannot be fractionally overshot', () => {
    for (const kind of unitKinds) {
      expect(Number.isInteger(UNIT_STATS[kind].supply), `${kind} supply must be a whole number`).toBe(true)
    }
  })

  it('scales supply with credit cost across a faction roster', () => {
    // A Rifleman is the cheapest Aegis unit and a Prism Titan among the most
    // expensive; supply should reflect that rather than being flat.
    expect(UNIT_STATS.rifleman.supply).toBeLessThan(UNIT_STATS.tank.supply)
    expect(UNIT_STATS.tank.supply).toBeLessThan(UNIT_STATS.colossus.supply)
  })

  it('provides supply from the command yard and the dedicated supply structure only', () => {
    const providers = buildingKinds.filter((kind) => BUILDING_STATS[kind].supply > 0)
    expect(providers.sort()).toEqual(['conyard', 'power'])
  })

  it('never lets a structure consume supply', () => {
    for (const kind of buildingKinds) {
      expect(BUILDING_STATS[kind].supply, `${kind} must not have negative supply`).toBeGreaterThanOrEqual(0)
    }
  })

  it('lets a fresh base support its starting army', () => {
    // The player spawns with a command yard and one supply structure. Every
    // faction's opening five units must fit, or the match begins supply-blocked.
    const startingCap = BUILDING_STATS.conyard.supply + BUILDING_STATS.power.supply
    const heaviestOpening = Math.max(
      UNIT_STATS.harvester.supply + UNIT_STATS.rifleman.supply + UNIT_STATS.medic.supply + UNIT_STATS.marauder.supply + UNIT_STATS.tank.supply,
      UNIT_STATS.drone.supply + UNIT_STATS.skitter.supply * 2 + UNIT_STATS.spitter.supply * 2,
      UNIT_STATS.probe.supply + UNIT_STATS.lancer.supply * 2 + UNIT_STATS.adept.supply * 2,
    )
    expect(heaviestOpening).toBeLessThan(startingCap)
  })

  it('caps total supply below what unlimited providers would allow', () => {
    expect(MAX_SUPPLY).toBeGreaterThan(BUILDING_STATS.conyard.supply + BUILDING_STATS.power.supply)
    expect(MAX_SUPPLY).toBeLessThan(1000)
  })
})
