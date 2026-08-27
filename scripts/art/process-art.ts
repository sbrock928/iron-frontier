/**
 * npm run art:process [-- --force]
 *
 * Deterministic post-process pass over the raw generations in art/src/**:
 *
 *  1. Repairs the colour of transparent and near-transparent pixels by
 *     bleeding opaque neighbour colour outward ("despill"). The image model
 *     leaves a bright halo in the RGB of fully-transparent background pixels;
 *     without this pass, downscaling interpolates that halo back into the
 *     silhouette edge and every sprite gets a pale outline.
 *  2. Trims transparent padding, then re-centres the subject on a square
 *     canvas with a fixed margin so every asset in a category shares the same
 *     framing regardless of how the generator cropped it.
 *  3. Resizes onto the resolution the game actually renders the asset at —
 *     each unit's and building's `spriteSize` from the game config, times
 *     TARGET_SCALE for zoom/HiDPI headroom. Terrain and effects use fixed
 *     sizes since they have no per-asset entry.
 *  4. For units and buildings, derives two companion layers:
 *       - {name}_n.png       normal map (Sobel-style gradient over luminance)
 *       - {name}_shadow.png  soft contact shadow from the alpha silhouette
 *  5. Terrain tiles skip the trim/re-centre step entirely since they are
 *     meant to fill their canvas edge-to-edge for seamless tiling.
 *
 * This step never calls the network and is fully deterministic: given the
 * same art/src/** inputs it always produces byte-identical art/build/** output.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { BUILD_DIR, SRC_DIR, log, targetSizeFor } from './shared.ts'

const args = process.argv.slice(2)
const force = args.includes('--force')

/** Fraction of empty canvas kept around the trimmed subject on each side. */
const MARGIN_FRACTION = 0.1

const CATEGORIES = ['units', 'buildings', 'terrain', 'effects']

/** Categories whose assets are re-centred on transparent padding before resize. */
const TRIM_CATEGORIES = new Set(['units', 'buildings', 'effects'])
/** Categories that also get normal map and contact shadow layers. */
const LAYERED_CATEGORIES = new Set(['units', 'buildings'])

/** Alpha at or above which a pixel is trusted as a real colour source for despill. */
const DESPILL_ALPHA_THRESHOLD = 250
/** How many pixels outward opaque colour is bled into the transparent region. */
const DESPILL_ITERATIONS = 4

/** Vertical squash applied to the silhouette when generating a contact shadow. */
const SHADOW_SQUASH = 0.34
/** Peak opacity of the generated contact shadow. */
const SHADOW_OPACITY = 0.5

async function fileNewer(source: string, target: string): Promise<boolean> {
  try {
    const [sourceStat, targetStat] = await Promise.all([fs.stat(source), fs.stat(target)])
    return sourceStat.mtimeMs > targetStat.mtimeMs
  } catch {
    return true
  }
}

/**
 * Bleeds opaque colour outward into transparent pixels so that downscaling
 * cannot interpolate the generator's background halo into the sprite edge.
 * Alpha is left completely untouched — only the RGB of pixels that are already
 * (near-)transparent is rewritten, so the visible silhouette is unchanged.
 */
async function despill(buffer: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height } = info
  const pixels = new Uint8ClampedArray(data)

  // Pixels at or above the threshold are trusted colour sources from the start.
  let known = new Uint8Array(width * height)
  for (let i = 0; i < width * height; i += 1) {
    known[i] = (pixels[i * 4 + 3] as number) >= DESPILL_ALPHA_THRESHOLD ? 1 : 0
  }

  for (let pass = 0; pass < DESPILL_ITERATIONS; pass += 1) {
    const next = new Uint8Array(known)
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x
        if (known[index]) continue

        let r = 0
        let g = 0
        let b = 0
        let count = 0
        for (let dy = -1; dy <= 1; dy += 1) {
          const ny = y + dy
          if (ny < 0 || ny >= height) continue
          for (let dx = -1; dx <= 1; dx += 1) {
            const nx = x + dx
            if (nx < 0 || nx >= width) continue
            const neighbour = ny * width + nx
            if (!known[neighbour]) continue
            r += pixels[neighbour * 4] as number
            g += pixels[neighbour * 4 + 1] as number
            b += pixels[neighbour * 4 + 2] as number
            count += 1
          }
        }
        if (count === 0) continue

        const offset = index * 4
        pixels[offset] = Math.round(r / count)
        pixels[offset + 1] = Math.round(g / count)
        pixels[offset + 2] = Math.round(b / count)
        next[index] = 1
      }
    }
    known = next
  }

  return sharp(Buffer.from(pixels.buffer), { raw: { width, height, channels: 4 } }).png().toBuffer()
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

/**
 * Renders a soft contact shadow from the sprite's own alpha silhouette: the
 * silhouette is squashed vertically, blurred, dimmed, and composited near the
 * bottom of a canvas the same size as the colour frame. Drawing it at the same
 * position and display size as the body then lands it under the subject.
 */
async function buildContactShadow(colorBuffer: Buffer, size: number): Promise<Buffer> {
  const squashedHeight = Math.max(2, Math.round(size * SHADOW_SQUASH))

  const silhouette = await sharp(colorBuffer)
    .ensureAlpha()
    .extractChannel('alpha')
    .resize(size, squashedHeight, { fit: 'fill' })
    .blur(Math.max(1, size * 0.03))
    .toColourspace('b-w')
    .raw()
    .toBuffer()

  // Dim in raw pixel space rather than with .linear(): sharp applies linear()
  // earlier in its fixed internal pipeline than extractChannel(), so it would
  // scale the discarded colour channels and leave the alpha at full strength.
  for (let i = 0; i < silhouette.length; i += 1) {
    silhouette[i] = Math.round((silhouette[i] as number) * SHADOW_OPACITY)
  }

  const shadowLayer = await sharp({
    create: { width: size, height: squashedHeight, channels: 3, background: { r: 4, g: 6, b: 5 } },
  })
    .joinChannel(silhouette, { raw: { width: size, height: squashedHeight, channels: 1 } })
    .png()
    .toBuffer()

  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: shadowLayer, left: 0, top: Math.round(size * 0.62 - squashedHeight / 2) }])
    .png()
    .toBuffer()
}

async function processFile(category: string, sourcePath: string): Promise<void> {
  const name = path.basename(sourcePath, '.png')
  const targetDir = path.join(BUILD_DIR, category)
  const targetPath = path.join(targetDir, `${name}.png`)

  if (!force && !(await fileNewer(sourcePath, targetPath))) return

  await fs.mkdir(targetDir, { recursive: true })
  const raw = await fs.readFile(sourcePath)
  const size = targetSizeFor(category, name)

  const repaired = await despill(raw)
  const processed = TRIM_CATEGORIES.has(category)
    ? await trimAndCenter(repaired, size)
    : await fitToCanvas(repaired, size)
  await fs.writeFile(targetPath, processed)
  log(`processed ${category}/${name}.png (${size}x${size})`)

  if (!LAYERED_CATEGORIES.has(category)) return

  await fs.writeFile(path.join(targetDir, `${name}_n.png`), await buildNormalMap(processed))
  await fs.writeFile(path.join(targetDir, `${name}_shadow.png`), await buildContactShadow(processed, size))
  log(`  + normal, shadow`)
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
  for (const category of CATEGORIES) {
    await processCategory(category)
  }
  log('Done.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
