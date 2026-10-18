// resistTableWorker.ts — read and parse the client's `spells_us.txt` OFF the main thread
// (JOS-382). Keep it this small.
//
// WHY A WHOLE THREAD. The file is 38 MB and 73,963 rows; reading and splitting it is a few
// hundred milliseconds of pure CPU with no await inside it, and the thread that would otherwise
// spend them is the one tailing the log (JOS-371: no synchronous multi-MB reads on main). It runs
// for each activated immutable captured revision. The spell-library writer owns the complete
// three-file content identity and durable cache; this worker creates only the compatibility table.
//
// It speaks exactly once and exits. Captured library generations use validated UTF-8. The optional
// legacy caller retains latin1 decoding; both interpret numeric fields through the same parser.

import { readFileSync } from 'node:fs'
import { parentPort, workerData } from 'node:worker_threads'
import { parseSpellsUs } from './resist/spellsUsParse'
import type { SpellResistTable } from '../shared/resistTypes'

export interface ResistTableWorkerInit {
  path: string
  utf8?: boolean
}

export interface ResistTableWorkerReply {
  ok: boolean
  table?: SpellResistTable
  error?: string
}

const init = workerData as ResistTableWorkerInit
const port = parentPort

let reply: ResistTableWorkerReply
try {
  const table = parseSpellsUs(readFileSync(init.path, init.utf8 ? 'utf8' : 'latin1'))
  reply = { ok: true, table }
} catch (err) {
  reply = { ok: false, error: err instanceof Error ? err.message : String(err) }
}
port?.postMessage(reply)
