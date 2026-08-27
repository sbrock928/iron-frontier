/**
 * npm run art:process [-- --force]
 *
 * Deterministic post-process pass over the raw generations in art/src/**:
 *
 *  1. Trims transparent padding, then re-centres the subject on a square
 *     canvas with a fixed margin so every asset in a category shares the same
 *     framing regardless of how the generator cropped it.
 *  2. Resizes onto a canonical working resolution per category (the game
 *     always calls `setDisplaySize()` at runtime, so the source resolution
 *     only needs enough headroom for the largest on-screen size).
 *  3. For units and buildings, derives a normal map from a luminance
 *     heightfield via a Sobel-style gradient, for the Phase 2 Light2D pass.
 *  4. Terrain tiles skip the trim/re-centre step entirely since they are
 *     meant to fill their canvas edge-to-edge for seamless tiling.
 *
 * This step never calls the network and is fully deterministic: given the
 * same art/src/** inputs it always produces byte-identical art/build/** output.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { BUILD_DIR, SRC_DIR, log } from './shared.ts'

const args = process.argv.slice(2)
const force = args.includes('--force')

/** Fraction of empty canvas kept around the trimmed subject on each side. */
const MARGIN_FRACTION = 0.1

const WORKING_SIZE: Record<string, number> = {
  units: 512,
  buildings: 512,
  terrain: 512,
  effects: 256,
}

/** Categories whose assets are re-centred on transparent padding before resize. */
const TRIM_CATEGORIES = new Set(['units', 'buildings', 'effects'])
/** Categories that also get a derived normal map for lit rendering. */
const NORMAL_MAP_CATEGORIES = new Set(['units', 'buildings'])

async function fileNewer(source: string, target: string): Promise<boolean> {
  try {
    const [sourceStat, targetStat] = await Promise.all([fs.stat(source), fs.stat(target)])
    return sourceStat.mtimeMs > targetStat.mtimeMs
  } catch {
    return true
  }
}

async function trimAndCenter(buffer: Buffer, size: number): Promise<Buffer> {
  const trimmed = sharp(buffer).trim({ threshold: 12 })
  const { data, info } = await trimmed.raw().ensureAlpha().toBuffer({ resolveWithObject: true })
  const { width, height } = info

  const canvasSize = Math.max(width, height) * (1 + MARGIN_FRACTION * 2)
  const left = Math.round((canvasSize - width) / 2)
  const top = Math.round((canvasSize - height) / 2)

  const padded = await sharp({
    create: {
      width: Math.ceil(canvasSize),
      height: Math.ceil(canvasSize),
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: data, raw: { width, height, channels: 4 }, left, top }])
    .png()
    .toBuffer()

  return sharp(padded).resize(size, size, { fit: 'fill' }).png().toBuffer()
}

async function fitToCanvas(buffer: Buffer, size: number): Promise<Buffer> {
  return sharp(buffer).resize(size, size, { fit: 'cover' }).png().toBuffer()
}

/**
 * Builds a tangent-space-ish normal map from a luminance heightfield using a
 * central-difference gradient (a simplified Sobel operator). Transparent
 * pixels are treated as height zero so the silhouette edge still produces a
 * believable rim gradient, and the source alpha channel is carried through
 * unchanged so the normal map matches the colour texture's silhouette.
 */
async function buildNormalMap(colorBuffer: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(colorBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height } = info
  const pixelCount = width * height

  const heightField = new Float32Array(pixelCount)
  for (let i = 0; i < pixelCount; i += 1) {
    const o = i * 4
    const alpha = data[o + 3] as number
    if (alpha < 10) {
      heightField[i] = 0
      continue
    }
    const r = data[o] as number
    const g = data[o + 1] as number
    const b = data[o + 2] as number
    heightField[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  }

  const STRENGTH = 2.2
  const normal = Buffer.alloc(pixelCount * 4)

  for (let y = 0; y < height; y += 1) {
    const yUp = Math.max(0, y - 1)
    const yDown = Math.min(height - 1, y + 1)
    for (let x = 0; x < width; x += 1) {
      const xLeft = Math.max(0, x - 1)
      const xRight = Math.min(width - 1, x + 1)

      const dx = (heightField[y * width + xRight]! - heightField[y * width + xLeft]!) * STRENGTH
      const dy = (heightField[yDown * width + x]! - heightField[yUp * width + x]!) * STRENGTH

      let nx = -dx
      let ny = -dy
      let nz = 1
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1
      nx /= len
      ny /= len
      nz /= len

      const o = (y * width + x) * 4
      normal[o] = Math.round((nx * 0.5 + 0.5) * 255)
      normal[o + 1] = Math.round((ny * 0.5 + 0.5) * 255)
      normal[o + 2] = Math.round((nz * 0.5 + 0.5) * 255)
      normal[o + 3] = data[o + 3] as number
    }
  }

  return sharp(normal, { raw: { width, height, channels: 4 } }).png().toBuffer()
}

async function processFile(category: string, sourcePath: string): Promise<void> {
  const name = path.basename(sourcePath, '.png')
  const targetDir = path.join(BUILD_DIR, category)
  const targetPath = path.join(targetDir, `${name}.png`)

  if (!force && !(await fileNewer(sourcePath, targetPath))) return

  await fs.mkdir(targetDir, { recursive: true })
  const raw = await fs.readFile(sourcePath)
  const size = WORKING_SIZE[category] ?? 512

  const processed = TRIM_CATEGORIES.has(category) ? await trimAndCenter(raw, size) : await fitToCanvas(raw, size)
  await fs.writeFile(targetPath, processed)
  log(`processed ${category}/${name}.png (${size}x${size})`)

  if (NORMAL_MAP_CATEGORIES.has(category)) {
    const normalPath = path.join(targetDir, `${name}_n.png`)
    const normalMap = await buildNormalMap(processed)
    await fs.writeFile(normalPath, normalMap)
    log(`  + normal map ${category}/${name}_n.png`)
  }
}

async function processCategory(category: string): Promise<void> {
  const dir = path.join(SRC_DIR, category)
  let entries: string[]
  try {
    entries = await fs.readdir(dir)
  } catch {
    log(`skipping ${category}: no art/src/${category} directory yet (run npm run art:gen first)`)
    return
  }

  const pngs = entries.filter((entry) => entry.endsWith('.png'))
  for (const entry of pngs) {
    await processFile(category, path.join(dir, entry))
  }
}

async function main(): Promise<void> {
  log(`Art processing starting (force=${force})`)
  for (const category of Object.keys(WORKING_SIZE)) {
    await processCategory(category)
  }
  log('Done.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
