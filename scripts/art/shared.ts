/**
 * Shared constants and helpers for the art pipeline scripts (gen-art.ts,
 * process-art.ts, pack-atlas.ts). This is the machine-readable counterpart to
 * /art/style.md — if you change a hard constraint in one, change the other.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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
