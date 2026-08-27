/**
 * Shared constants and helpers for the art pipeline scripts (gen-art.ts,
 * process-art.ts, pack-atlas.ts). This is the machine-readable counterpart to
 * /art/style.md — if you change a hard constraint in one, change the other.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BUILDING_STATS, UNIT_STATS } from '../../frontend/src/game/config.ts'

export const ART_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'art')
export const SRC_DIR = path.join(ART_ROOT, 'src')
export const BUILD_DIR = path.join(ART_ROOT, 'build')
export const PROMPTS_DIR = path.join(ART_ROOT, 'prompts')
export const ATLAS_OUT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'frontend',
  'public',
  'assets',
  'atlas',
)

export type Faction = 'aegis' | 'noctis' | 'veyra'
export const FACTIONS: Faction[] = ['aegis', 'noctis', 'veyra']

export const FACTION_ACCENT: Record<Faction, string> = {
  aegis: '#66e8dd',
  noctis: '#c684ff',
  veyra: '#e5b6ff',
}

/**
 * Supersampling factor applied on top of each asset's configured `spriteSize`
 * when rasterising to art/build. The game always calls `setDisplaySize()` at
 * its configured size, so the texture only needs enough headroom to stay crisp
 * at the maximum camera zoom (1.35) on a HiDPI display. 2x covers both with
 * margin; going to 1x would visibly blur when zoomed in, and the old flat
 * 512px canvas wasted 25-90x the pixels an infantry sprite actually needs.
 */
export const TARGET_SCALE = 2

/** Fixed raster sizes for categories that have no per-asset `spriteSize` in the game config. */
const FIXED_CATEGORY_SIZE: Record<string, number> = {
  terrain: 512,
  effects: 256,
}

const TURRET_SUFFIX = '_turret'

/**
 * Splits a building asset basename into its faction and kind. Aegis is the
 * unprefixed default, matching `buildingAtlasFrame()` in the game config —
 * `conyard` is Aegis, `noctis_conyard` is the Noctis variant.
 */
export function parseBuildingName(name: string): { faction: Faction; kind: string } {
  for (const faction of FACTIONS) {
    if (faction !== 'aegis' && name.startsWith(`${faction}_`)) {
      return { faction, kind: name.slice(faction.length + 1) }
    }
  }
  return { faction: 'aegis', kind: name }
}

/**
 * Square raster edge, in pixels, for a processed asset. Units and buildings are
 * derived from the `spriteSize` the game actually renders them at (times
 * TARGET_SCALE); a unit's turret layer inherits its hull's size so the two
 * layers stay registered when drawn on top of each other.
 */
export function targetSizeFor(category: string, name: string): number {
  if (category === 'units') {
    const kind = name.endsWith(TURRET_SUFFIX) ? name.slice(0, -TURRET_SUFFIX.length) : name
    const stats = UNIT_STATS[kind as keyof typeof UNIT_STATS]
    if (!stats) throw new Error(`No UNIT_STATS entry for "${kind}" (asset units/${name}.png)`)
    return Math.ceil((Math.max(stats.spriteSize.width, stats.spriteSize.height) * TARGET_SCALE) / 2) * 2
  }

  if (category === 'buildings') {
    const { kind } = parseBuildingName(name)
    const stats = BUILDING_STATS[kind as keyof typeof BUILDING_STATS]
    if (!stats) throw new Error(`No BUILDING_STATS entry for "${kind}" (asset buildings/${name}.png)`)
    return Math.ceil((Math.max(stats.spriteSize.width, stats.spriteSize.height) * TARGET_SCALE) / 2) * 2
  }

  const fixed = FIXED_CATEGORY_SIZE[category]
  if (!fixed) throw new Error(`Unknown art category "${category}"`)
  return fixed
}

/**
 * Shared preamble prepended to every per-asset `subject` prompt. Encodes the
 * hard technical constraints from art/style.md#1 so every generation composites
 * consistently regardless of which unit/building/effect is being produced.
 */
export const STYLE_PREAMBLE = [
  'Studio-quality pre-rendered 3D render for a realistic military sci-fi real-time strategy game,',
  'in the visual style of a 1990s pre-rendered RTS sprite (StarCraft, Command & Conquer): grounded,',
  'weathered, physically plausible materials, NOT cartoony, NOT low-poly, NOT cel-shaded, NOT toon-outlined,',
  'NOT flat vector art. Photorealistic PBR materials with micro surface detail, panel lines, rivets, weld seams',
  'and grime. Orthographic top-down camera tilted about fifteen degrees off vertical, no perspective convergence.',
  'The subject faces directly right (east, 0 degrees), its nose or front pointing toward the right edge of the',
  'frame, as if about to move rightward across the screen. Single key light from the upper-left at a shallow',
  'angle casting soft directional highlights, with a subtle cool blue-grey fill from the lower-right. Fully',
  'transparent background. Single centred subject with roughly ten percent margin, no cropping. Do not render a',
  'ground contact shadow. No outlines, no text, no logos, no watermark, no multiple subjects, no motion blur.',
].join(' ')

export function buildPrompt(subject: string): string {
  return `${STYLE_PREAMBLE} ${subject}`
}

/** Simple exponential backoff retry wrapper for flaky network calls. */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 4, baseDelayMs = 1500): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      const delay = baseDelayMs * 2 ** attempt
      console.warn(`  retry ${attempt + 1}/${attempts} after error: ${(error as Error).message} (waiting ${delay}ms)`)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
  throw lastError
}

export function log(message: string): void {
  console.log(message)
}
