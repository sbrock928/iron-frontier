import { describe, expect, it } from 'vitest'
import { COMMAND_GRID_COLUMNS, COMMAND_GRID_ROWS, COMMAND_GRID_SIZE, ORDER_HOTKEYS, assignHotkeys, padToGrid } from './hotkeys'
import type { CommandAction } from '../types'

const action = (id: string): CommandAction => ({ id, label: id, hotkey: '', icon: '', kind: 'order', key: id })

describe('assignHotkeys', () => {
  it('never assigns the same letter twice', () => {
    const labels = ['Barracks', 'Bunker', 'Beacon', 'Bastion', 'Battery']
    const assigned = assignHotkeys(labels, (label) => label)
    const letters = [...assigned.values()]
    expect(new Set(letters).size).toBe(letters.length)
  })

  it('never assigns a letter reserved by a fixed order', () => {
    const reserved = new Set<string>(Object.values(ORDER_HOTKEYS))
    // Every one of these starts with a reserved letter.
    const labels = ['Attack Ship', 'Stop Gate', 'Cannon', 'Bunker', 'Reactor', 'Quarry', 'Zealot']
    const assigned = assignHotkeys(labels, (label) => label)
    for (const letter of assigned.values()) {
      expect(reserved.has(letter), `${letter} is reserved`).toBe(false)
    }
  })

  it('prefers a letter the label actually contains', () => {
    const assigned = assignHotkeys(['Medic'], (label) => label)
    expect(assigned.get('Medic')).toBe('M')
  })

  it('falls back to the next free letter when every label letter is taken', () => {
    // "Cab" is C, A, B - all reserved orders - so it must still get a binding.
    const assigned = assignHotkeys(['Cab'], (label) => label)
    const letter = assigned.get('Cab')
    expect(letter).toBeTruthy()
    expect(new Set<string>(Object.values(ORDER_HOTKEYS)).has(letter as string)).toBe(false)
  })

  it('is deterministic for the same input order', () => {
    const labels = ['Rifleman', 'Marauder', 'Medic', 'Sniper']
    const first = assignHotkeys(labels, (label) => label)
    const second = assignHotkeys(labels, (label) => label)
    expect([...first.values()]).toEqual([...second.values()])
  })

  it('ignores punctuation and digits when deriving a letter', () => {
    const assigned = assignHotkeys(['7-11 Depot'], (label) => label)
    expect(assigned.get('7-11 Depot')).toBe('D')
  })

  it('assigns a letter to every entry a full command card can hold', () => {
    const labels = Array.from({ length: COMMAND_GRID_SIZE }, (_, index) => `Unit ${index}`)
    const assigned = assignHotkeys(labels, (label) => label)
    expect(assigned.size).toBe(labels.length)
    expect(new Set(assigned.values()).size).toBe(labels.length)
  })

  it('leaves an entry unbound rather than duplicating once the alphabet runs out', () => {
    // 26 letters minus the 7 reserved orders leaves 19 assignable. This is far
    // beyond a 12-slot card, but must degrade to "no hotkey" rather than to a
    // duplicate that would fire two commands at once.
    const labels = Array.from({ length: 25 }, (_, index) => `Unit ${index}`)
    const assigned = assignHotkeys(labels, (label) => label)
    expect(assigned.size).toBe(26 - Object.keys(ORDER_HOTKEYS).length)
    expect(new Set(assigned.values()).size).toBe(assigned.size)
  })
})

describe('padToGrid', () => {
  it('pads short lists with nulls to keep button positions fixed', () => {
    const padded = padToGrid([action('a'), action('b')], 6)
    expect(padded).toHaveLength(6)
    expect(padded.slice(2).every((slot) => slot === null)).toBe(true)
  })

  it('truncates lists longer than the grid', () => {
    const actions = Array.from({ length: 20 }, (_, index) => action(String(index)))
    expect(padToGrid(actions, COMMAND_GRID_SIZE)).toHaveLength(COMMAND_GRID_SIZE)
  })

  it('preserves order so a given command keeps its slot', () => {
    const padded = padToGrid([action('a'), action('b'), action('c')], 4)
    expect(padded.map((slot) => slot?.id ?? null)).toEqual(['a', 'b', 'c', null])
  })
})

describe('command grid shape', () => {
  it('derives its size from its dimensions', () => {
    expect(COMMAND_GRID_SIZE).toBe(COMMAND_GRID_COLUMNS * COMMAND_GRID_ROWS)
  })
})
