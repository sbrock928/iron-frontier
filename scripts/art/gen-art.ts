/**
 * npm run art:gen -- [--force] [--only=units|buildings|terrain|effects] [--filter=<substring>]
 *
 * Reads the prompt manifests in art/prompts/*.json, generates one 1024x1024
 * transparent PNG per asset via an image-generation API, and writes the raw
 * output to art/src/**. Generation is idempotent: any file that already
 * exists is skipped unless --force is passed, so re-running after adding a
 * handful of new prompt entries only pays for the new work.
 *
 * Requires an OPENAI_API_KEY environment variable. The network call is
 * isolated behind `generateImage()` so a different provider (or a future
 * Blender render pipeline that just drops files in art/src/) can be swapped
 * in without touching the manifest-walking logic below.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { ART_ROOT, FACTIONS, PROMPTS_DIR, SRC_DIR, buildPrompt, log, withRetry } from './shared.ts'

interface UnitPrompt {
  faction: string
  role: string
  seed: number
  turret: boolean
  subject: string
  turretSubject?: string
}

interface UnitsManifest {
  units: Record<string, UnitPrompt>
}

interface BuildingsManifest {
  buildings: Record<string, { seedBase: number; aegis: string; noctis: string; veyra: string }>
}

interface TerrainManifest {
  terrain: Record<string, { seed: number; subject: string }>
  effects: Record<string, { seed: number; subject: string }>
}

const args = process.argv.slice(2)
const force = args.includes('--force')
const onlyArg = args.find((arg) => arg.startsWith('--only='))?.split('=')[1]
const filterArg = args.find((arg) => arg.startsWith('--filter='))?.split('=')[1]
const shouldRun = (category: string) => !onlyArg || onlyArg === category
const matchesFilter = (name: string) => !filterArg || name.includes(filterArg)

let generatedCount = 0
let skippedCount = 0

async function readManifest<T>(file: string): Promise<T> {
  const raw = await fs.readFile(path.join(PROMPTS_DIR, file), 'utf-8')
  return JSON.parse(raw) as T
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Calls the OpenAI Images API to produce one transparent PNG. Isolated here
 * so the rest of the pipeline is provider-agnostic.
 */
async function generateImage(prompt: string, seed: number): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set. Export it before running npm run art:gen.')
  }

  return withRetry(async () => {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      // `seed` is included in the prompt metadata for our own bookkeeping;
      // the API itself does not currently accept a seed parameter.
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt: `${prompt} [asset-seed:${seed}]`,
        size: '1024x1024',
        background: 'transparent',
        quality: 'high',
        n: 1,
      }),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`Image API returned ${response.status}: ${text.slice(0, 400)}`)
    }

    const payload = (await response.json()) as { data?: Array<{ b64_json?: string }> }
    const b64 = payload.data?.[0]?.b64_json
    if (!b64) throw new Error('Image API response did not contain image data')
    return Buffer.from(b64, 'base64')
  })
}

async function writeIfNeeded(outPath: string, prompt: string, seed: number, label: string): Promise<void> {
  if (!matchesFilter(label)) return
  if (!force && (await fileExists(outPath))) {
    skippedCount += 1
    return
  }
  log(`generating ${label} -> ${path.relative(ART_ROOT, outPath)}`)
  const image = await generateImage(prompt, seed)
  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await fs.writeFile(outPath, image)
  generatedCount += 1
}

async function genUnits(): Promise<void> {
  if (!shouldRun('units')) return
  const manifest = await readManifest<UnitsManifest>('units.json')

  for (const [kind, entry] of Object.entries(manifest.units)) {
    const hullPrompt = buildPrompt(entry.subject)
    await writeIfNeeded(path.join(SRC_DIR, 'units', `${kind}.png`), hullPrompt, entry.seed, `unit:${kind}`)

    if (entry.turret && entry.turretSubject) {
      const turretPrompt = buildPrompt(entry.turretSubject)
      await writeIfNeeded(
        path.join(SRC_DIR, 'units', `${kind}_turret.png`),
        turretPrompt,
        entry.seed + 1,
        `unit:${kind}_turret`,
      )
    }
  }
}

async function genBuildings(): Promise<void> {
  if (!shouldRun('buildings')) return
  const manifest = await readManifest<BuildingsManifest>('buildings.json')

  for (const [kind, entry] of Object.entries(manifest.buildings)) {
    for (const [index, faction] of FACTIONS.entries()) {
      const subject = entry[faction]
      const prompt = buildPrompt(subject)
      const fileName = faction === 'aegis' ? `${kind}.png` : `${faction}_${kind}.png`
      await writeIfNeeded(
        path.join(SRC_DIR, 'buildings', fileName),
        prompt,
        entry.seedBase + index,
        `building:${faction}_${kind}`,
      )
    }
  }
}

async function genTerrainAndEffects(): Promise<void> {
  const manifest = await readManifest<TerrainManifest>('terrain.json')

  if (shouldRun('terrain')) {
    for (const [key, entry] of Object.entries(manifest.terrain)) {
      const prompt = buildPrompt(entry.subject)
      await writeIfNeeded(path.join(SRC_DIR, 'terrain', `${key}.png`), prompt, entry.seed, `terrain:${key}`)
    }
  }

  if (shouldRun('effects')) {
    for (const [key, entry] of Object.entries(manifest.effects)) {
      const prompt = buildPrompt(entry.subject)
      await writeIfNeeded(path.join(SRC_DIR, 'effects', `${key}.png`), prompt, entry.seed, `effect:${key}`)
    }
  }
}

async function main(): Promise<void> {
  log(`Art generation starting (force=${force}, only=${onlyArg ?? 'all'}, filter=${filterArg ?? 'none'})`)
  await genUnits()
  await genBuildings()
  await genTerrainAndEffects()
  log(`Done. Generated ${generatedCount}, skipped ${skippedCount} already-present asset(s).`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
