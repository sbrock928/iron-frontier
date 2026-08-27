import type { Point } from '../../types'

export interface TerrainObstacle {
  x: number
  y: number
  width: number
  height: number
}

export interface TerrainDecoration {
  /** Frame name within the `'terrain'` atlas. */
  frame: string
  x: number
  y: number
  scale: number
  alpha: number
  /** Whether this decoration also occupies a pathfinding obstacle rectangle. */
  blocking: boolean
}

export interface TerrainFeatures {
  obstacles: TerrainObstacle[]
  decorations: TerrainDecoration[]
}

const CLIFF_FRAME = 'cliff_face'
const RAMP_FRAME = 'ramp'
const GROUND_VARIANT_FRAMES = ['ground_ash', 'ground_crystal', 'ground_metal', 'ground_rock'] as const
const DOODAD_FRAMES = ['doodad_crate_cluster', 'doodad_rock_cluster', 'doodad_wreck'] as const

/** Cheap FNV-1a style string hash used to seed the deterministic scatter below. */
function hashSeed(text: string): number {
  let hash = 2166136261
  for (let i = 0; i < text.length; i += 1) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619)
  return hash >>> 0
}

/** Mulberry32 PRNG: tiny, fast, and fully deterministic given a 32-bit seed. */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Builds a deterministic set of decorative and blocking terrain features for
 * a mission map: cliff clusters that behave like impassable ridgelines
 * framing the corners of the play area, ramp accents that break up their
 * silhouette, soft ground-texture variation patches, and scattered
 * rock/crate/wreck doodads for visual interest.
 *
 * Everything is seeded from the mission id, so a given mission always
 * generates the same layout on every playthrough, and every placement is
 * checked against `avoidZones` (spawns, resource fields) so nothing overlaps
 * a base or blocks a harvester's route to ore.
 */
export function generateTerrainFeatures(
  missionId: string,
  width: number,
  height: number,
  avoidZones: ReadonlyArray<Point & { radius: number }>,
): TerrainFeatures {
  const random = mulberry32(hashSeed(missionId))
  const obstacles: TerrainObstacle[] = []
  const decorations: TerrainDecoration[] = []

  const tooClose = (x: number, y: number, margin: number) =>
    avoidZones.some((zone) => Math.hypot(x - zone.x, y - zone.y) < zone.radius + margin)

  // Cliff clusters anchor to the map's four corners so they read as a ridge
  // framing the play area rather than random blobs dropped in open ground.
  const cornerMargin = 190
  const corners: Point[] = [
    { x: cornerMargin, y: cornerMargin },
    { x: width - cornerMargin, y: cornerMargin },
    { x: cornerMargin, y: height - cornerMargin },
    { x: width - cornerMargin, y: height - cornerMargin },
  ]
  for (const corner of corners) {
    if (tooClose(corner.x, corner.y, 220)) continue
    const scale = 1.1 + random() * 0.5
    obstacles.push({ x: corner.x, y: corner.y, width: 260 * scale, height: 220 * scale })
    decorations.push({ frame: CLIFF_FRAME, x: corner.x, y: corner.y, scale, alpha: 1, blocking: true })

    // A ramp accent just inside the cliff, breaking up its silhouette.
    const rampX = corner.x + (corner.x < width / 2 ? 190 : -190) * scale
    const rampY = corner.y + (corner.y < height / 2 ? 60 : -60) * scale
    if (!tooClose(rampX, rampY, 120)) {
      decorations.push({ frame: RAMP_FRAME, x: rampX, y: rampY, scale: 0.8 + random() * 0.2, alpha: 1, blocking: false })
    }
  }

  // Ground-texture patches: soft, semi-transparent overlays scattered across
  // the field so the ground isn't one flat repeating tile.
  const patchCount = Math.max(6, Math.round((width * height) / 480000))
  for (let i = 0; i < patchCount; i += 1) {
    const x = 120 + random() * Math.max(1, width - 240)
    const y = 120 + random() * Math.max(1, height - 240)
    if (tooClose(x, y, 90)) continue
    const frame = GROUND_VARIANT_FRAMES[i % GROUND_VARIANT_FRAMES.length] as string
    decorations.push({ frame, x, y, scale: 0.9 + random() * 0.7, alpha: 0.5 + random() * 0.22, blocking: false })
  }

  // Scattered doodads: small non-blocking props for visual read, kept clear
  // of spawns, base footprints, and ore fields.
  const doodadCount = Math.max(8, Math.round((width * height) / 300000))
  for (let i = 0; i < doodadCount; i += 1) {
    const x = 80 + random() * Math.max(1, width - 160)
    const y = 80 + random() * Math.max(1, height - 160)
    if (tooClose(x, y, 70)) continue
    const frame = DOODAD_FRAMES[i % DOODAD_FRAMES.length] as string
    decorations.push({ frame, x, y, scale: 0.55 + random() * 0.5, alpha: 0.92, blocking: false })
  }

  return { obstacles, decorations }
}
