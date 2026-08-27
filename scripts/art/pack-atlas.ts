/**
 * npm run art:pack
 *
 * Packs the processed textures in art/build/<category>/*.png into one texture
 * atlas per category and writes {category}.png + {category}.json to
 * frontend/public/assets/atlas/, in Phaser 3's multi-atlas JSON format.
 *
 * Replacing ~180 individual loose-file HTTP requests (see BootScene's
 * `preload()`) with four atlas requests is the point: fewer round trips, and
 * a single draw-call-friendly texture per category instead of one texture
 * object per unit/building kind.
 *
 * Normal maps (`_n.png`) are intentionally left out of the colour atlas and
 * packed into a parallel `{category}-normal` atlas, since Phaser's Light2D
 * pipeline expects normal maps as their own texture keyed by convention
 * (`${key}_n`) rather than interleaved frames.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
// free-tex-packer-core ships as CJS; esModuleInterop makes this named import work.
import { packAsync } from 'free-tex-packer-core'
import type { PackerExporterType } from 'free-tex-packer-core'
import { ATLAS_OUT_DIR, BUILD_DIR, log } from './shared.ts'

const CATEGORIES = ['units', 'buildings', 'terrain', 'effects']

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

async function loadCategoryImages(category: string, suffix: '' | '_n'): Promise<PackerInputImage[]> {
  const dir = path.join(BUILD_DIR, category)
  let entries: string[]
  try {
    entries = await fs.readdir(dir)
  } catch {
    return []
  }

  const matches = entries.filter((entry) =>
    suffix === '' ? entry.endsWith('.png') && !entry.endsWith('_n.png') : entry.endsWith('_n.png'),
  )

  return Promise.all(
    matches.map(async (fileName) => ({
      path: fileName,
      contents: await fs.readFile(path.join(dir, fileName)),
    })),
  )
}

async function packCategory(category: string): Promise<void> {
  const colorImages = await loadCategoryImages(category, '')
  if (colorImages.length === 0) {
    log(`skipping ${category}: no processed textures yet (run npm run art:gen && npm run art:process first)`)
    return
  }

  const packedColor = await pack(colorImages, category)
  await writePackedFiles(packedColor)
  log(`packed ${category}: ${colorImages.length} frame(s)`)

  const normalImages = await loadCategoryImages(category, '_n')
  if (normalImages.length > 0) {
    const packedNormal = await pack(normalImages, `${category}-normal`)
    await writePackedFiles(packedNormal)
    log(`packed ${category}-normal: ${normalImages.length} frame(s)`)
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
