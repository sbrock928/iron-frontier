import type { CommandAction } from '../types'

/**
 * Hotkeys for the fixed orders that appear on the command card regardless of
 * what is selected. These are deliberately the letters most RTS players already
 * have in muscle memory, which is why BattleScene's camera panning is bound to
 * the arrow keys and screen edges rather than WASD — a WASD pan would make `A`
 * and `S` unusable here.
 */
export const ORDER_HOTKEYS = {
  attackMove: 'A',
  stop: 'S',
  center: 'C',
  build: 'B',
  research: 'R',
  cancel: 'Q',
  back: 'Z',
} as const

/**
 * Letters never auto-assigned to a build/train button, because they are already
 * bound to a fixed order that can appear on the same card.
 */
const RESERVED = new Set<string>(Object.values(ORDER_HOTKEYS))

/**
 * Picks a stable, unique hotkey letter for each entry from its own label.
 *
 * StarCraft hand-authors a letter per unit; deriving it instead keeps the
 * command card correct automatically as units are added or renamed. The result
 * is deterministic for a given input order: each label claims the first letter
 * it contains that is not already taken, so a card's letters only shift when
 * the card's contents actually change.
 *
 * Entries are returned in the order given, so grid positions stay stable.
 *
 * With 7 reserved orders there are 19 assignable letters. Beyond that an entry
 * is returned without a binding rather than sharing one, since a duplicate
 * letter would fire two commands from a single keypress. A command card holds
 * 12 slots, so this ceiling is not reachable in practice.
 */
export function assignHotkeys<T>(entries: T[], labelOf: (entry: T) => string): Map<T, string> {
  const used = new Set(RESERVED)
  const result = new Map<T, string>()

  for (const entry of entries) {
    const letters = labelOf(entry).toUpperCase().replace(/[^A-Z]/g, '')
    let chosen = ''
    for (const letter of letters) {
      if (used.has(letter)) continue
      chosen = letter
      break
    }
    // Every letter of the label was already claimed; fall back to any free key
    // so the button still has a working binding rather than none at all.
    if (!chosen) {
      for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
        if (used.has(letter)) continue
        chosen = letter
        break
      }
    }
    if (chosen) {
      used.add(chosen)
      result.set(entry, chosen)
    }
  }

  return result
}

/** Pads a card to a full grid so button positions stay in fixed places. */
export function padToGrid(actions: CommandAction[], size: number): Array<CommandAction | null> {
  const padded: Array<CommandAction | null> = [...actions.slice(0, size)]
  while (padded.length < size) padded.push(null)
  return padded
}

/**
 * Shape of the command card. These are the single source of truth: the grid's
 * CSS template is generated from them at render time rather than repeated in
 * the stylesheet, so the two can never disagree.
 */
export const COMMAND_GRID_COLUMNS = 3
export const COMMAND_GRID_ROWS = 4
export const COMMAND_GRID_SIZE = COMMAND_GRID_COLUMNS * COMMAND_GRID_ROWS
