import { createHash } from 'node:crypto'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { datasetNames } from '../src/main/discordReferenceLoader.ts'

export async function runtimeFixture(root: string, checked = '2026-10-24T12:45:28Z'): Promise<void> {
  await mkdir(join(root, 'runtime'), { recursive: true })
  for (const name of ['manifest', ...datasetNames]) {
    await writeFile(join(root, 'runtime', `${name}.json`), await readFile(new URL(`../src/main/data/discord/${name}.json`, import.meta.url)))
  }
  await updateRuntimeCheck(root, checked)
}
export async function updateRuntimeCheck(root: string, lastCheckedAt: string | null): Promise<void> {
  await writeFile(join(root, 'runtime/refresh.json'), JSON.stringify({ lastCheckedAt }))
  const files: Record<string, string> = {}
  for (const name of ['manifest', 'refresh', ...datasetNames]) {
    const relative = `runtime/${name}.json`
    files[relative] = createHash('sha256').update(await readFile(join(root, relative))).digest('hex')
  }
  const digestPath = join(root, 'runtime/mustRead.json')
  if (await stat(digestPath).then(() => true, () => false)) {
    files['runtime/mustRead.json'] = createHash('sha256').update(await readFile(digestPath)).digest('hex')
  }
  await writeFile(join(root, 'SHA256SUMS.json'), JSON.stringify({ algorithm: 'sha256', files }))
}
