/**
 * npm run art:pack
 *
 * Packs the processed textures in art/build/<category>/*.png into one texture
 * atlas per category and writes {category}.png + {category}.json to
 * frontend/public/assets/atlas/, in Phaser 3's multi-atlas JSON format.
 *
 * Replacing ~180 individual loose-file HTTP requests with four atlas requests
 * is the point: fewer round trips, and a single draw-call-friendly texture per
 * category instead of one texture object per unit/building kind.
 *
 * Companion layers produced by process-art.ts are packed into their own
 * parallel atlases rather than being interleaved as extra frames in the colour
 * atlas:
 *
 *   - `_n.png`      -> `{category}-normal`
 *   - `_shadow.png` -> `{category}-shadow`
 *
 * For normal maps this separation is load-bearing in two ways. Phaser's
 * lighting pipeline wants the normal map as its own texture (bound via
 * `setDataSource`) rather than as sibling frames, and because it samples the
 * normal texture using the *colour* frame's UVs, the normal atlas must have a
 * byte-identical layout to its colour atlas. That holds only because both are
 * packed from the same number of same-sized images whose names sort the same
 * way (the `_n` suffix is uniform), with `allowRotation` and `allowTrim` off
 * and `detectIdentical` off so no frame is reordered, rotated or deduplicated.
 * Adding a layer suffix to the colour atlas would silently desynchronise that
 * layout and every lit sprite would sample the wrong normals.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
// free-tex-packer-core ships as CJS; esModuleInterop makes this named import work.
import { packAsync } from 'free-tex-packer-core'
import type { PackerExporterType } from 'free-tex-packer-core'
import { ATLAS_OUT_DIR, BUILD_DIR, log } from './shared.ts'

const CATEGORIES = ['units', 'buildings', 'terrain', 'effects']

/**
 * Filename suffixes that mark a companion layer. A processed `.png` that ends
 * with none of these is a colour frame. Keep this in sync with the layers
 * process-art.ts emits, or new layers will leak into the colour atlas.
 */
const LAYER_SUFFIXES = ['_n', '_shadow'] as const
type LayerSuffix = (typeof LAYER_SUFFIXES)[number]

/** Atlas name suffix each companion layer is packed under. */
const LAYER_ATLAS_SUFFIX: Record<LayerSuffix, string> = {
  _n: 'normal',
  _shadow: 'shadow',
}

interface PackerInputImage {
  path: string
  contents: Buffer
}

interface PackedFile {
  name: string
  buffer: Buffer
}

function pack(images: PackerInputImage[], textureName: string): Promise<PackedFile[]> {
  return packAsync(images, {
    textureName,
    width: 4096,
    height: 4096,
    fixedSize: false,
    padding: 2,
    extrude: 1,
    allowRotation: false,
    allowTrim: false,
    detectIdentical: false,
    // The package's PackerExporterType enum is declared only in its ambient
    // .d.ts with no matching runtime export, so it can't be imported as a
    // value. The string literal is what the implementation actually checks.
    exporter: 'Phaser3' as unknown as PackerExporterType,
    removeFileExtension: true,
  }) as Promise<PackedFile[]>
}

async function loadCategoryImages(category: string, layer: LayerSuffix | null): Promise<PackerInputImage[]> {
  const dir = path.join(BUILD_DIR, category)
  let entries: string[]
  try {
    entries = await fs.readdir(dir)
  } catch {
    return []
  }

  const matches = entries.filter((entry) => {
    if (!entry.endsWith('.png')) return false
    const base = entry.slice(0, -'.png'.length)
    const matched = LAYER_SUFFIXES.find((suffix) => base.endsWith(suffix)) ?? null
    return matched === layer
  })

  // free-tex-packer's ordering is derived from input order, so sort explicitly
  // rather than relying on readdir order to keep packs reproducible across
  // machines and to preserve colour/normal atlas layout parity.
  matches.sort()

  return Promise.all(
    matches.map(async (fileName) => ({
      path: fileName,
      contents: await fs.readFile(path.join(dir, fileName)),
    })),
  )
}

async function packCategory(category: string): Promise<void> {
  const colorImages = await loadCategoryImages(category, null)
  if (colorImages.length === 0) {
    log(`skipping ${category}: no processed textures yet (run npm run art:gen && npm run art:process first)`)
    return
  }

  const packedColor = await pack(colorImages, category)
  await writePackedFiles(packedColor)
  log(`packed ${category}: ${colorImages.length} frame(s)`)

  for (const layer of LAYER_SUFFIXES) {
    const images = await loadCategoryImages(category, layer)
    if (images.length === 0) continue
    const atlasName = `${category}-${LAYER_ATLAS_SUFFIX[layer]}`
    await writePackedFiles(await pack(images, atlasName))
    log(`packed ${atlasName}: ${images.length} frame(s)`)
  }
}

async function writePackedFiles(files: PackedFile[]): Promise<void> {
  await fs.mkdir(ATLAS_OUT_DIR, { recursive: true })
  for (const file of files) {
    await fs.writeFile(path.join(ATLAS_OUT_DIR, file.name), file.buffer)
  }
}

async function main(): Promise<void> {
  log(`Packing atlases into ${path.relative(process.cwd(), ATLAS_OUT_DIR)}`)
  for (const category of CATEGORIES) {
    await packCategory(category)
  }
  log('Done.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
