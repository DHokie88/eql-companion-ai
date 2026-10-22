/** Import only validated data, keeping EQO's loader and AI integration intact. */
import { readFile, writeFile, mkdir, rename, rm, stat } from 'node:fs/promises'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { datasetNames } from '../src/main/discordReferenceLoader'
import { validateEnvelope, validateManifest } from '../src/main/discordValidation'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packageRoot = process.argv[2]
if (!packageRoot) throw new Error('Usage: npm run import:discord -- <extracted eqo-import folder>')
const source = resolve(packageRoot, 'src/main/data/discord')
const destination = join(root, 'src/main/data/discord')
const manifestBytes = await readFile(join(source, 'manifest.json'))
const manifest = validateManifest(JSON.parse(manifestBytes.toString()) as unknown, datasetNames)
const files = new Map<string, Buffer>([['manifest.json', manifestBytes]])
for (const name of datasetNames) {
  const path = join(source, `${name}.json`)
  if ((await stat(path)).size > 40_000_000) throw new Error(`${name}: dataset is too large`)
  const bytes = await readFile(path)
  const data: unknown = JSON.parse(bytes.toString())
  const problems = validateEnvelope(name, data)
  if (problems.length) throw new Error(`${name}: ${problems.slice(0, 8).join('; ')}`)
  if ((data as { count: number }).count !== manifest.files[name].count) throw new Error(`${name}: manifest count mismatch`)
  files.set(`${name}.json`, bytes)
}
const stage = `${destination}.stage-${randomUUID()}`
const backup = `${destination}.previous-${randomUUID()}`
if (dirname(stage) !== dirname(destination) || !stage.startsWith(`${destination}.stage-`)) throw new Error('Import staging path escaped the data directory')
await mkdir(stage)
try {
  for (const [name, bytes] of files) await writeFile(join(stage, name), bytes)
  await rename(destination, backup)
  try { await rename(stage, destination) } catch (error) { await rename(backup, destination); throw error }
  // The previous snapshot is recoverable; remove it explicitly after reviewing the import.
  console.log(`Imported ${Object.values(manifest.files).reduce((sum, f) => sum + f.count, 0)} records. Previous snapshot: ${backup}`)
  console.log('Next: npm run build, npm test, and npm run test:startup. Restart EQ Oracle to use the new snapshot.')
} finally { await rm(stage, { recursive: true, force: true }) }
