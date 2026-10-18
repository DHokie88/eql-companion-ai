import { app } from 'electron'
import { join } from 'node:path'
import { effectiveEqRoot } from '../log/config'
import { sendToMain } from '../windows'
import { logError } from '../errorLog'
import { engineRequest } from '../dataServer/engineClientHost'
import { subscribePresence } from '../presence'
import { onEqClients } from '../presenceClients'
import { EqClientLaunches } from '../../shared/eqClientProcess'
import { IPC } from '../../shared/ipc'
import { SpellLibraryService } from './service'
import { activateCapturedSpellTable, prepareCapturedSpellTable, selectSpellInstallation } from '../resist/spellTable'
import { getModifierContext, stopModifierContext } from './modifierRuntime'
import { notifySpellModifierInputs } from './modifierEvents'

let service: SpellLibraryService | null = null
let releasePresence: (() => void) | null = null
let releaseClients: (() => void) | null = null
let modifierSource = ''

export function spellLibrary(): SpellLibraryService {
  service ??= new SpellLibraryService({
    userData: app.getPath('userData'), workerDirectory: __dirname, root: effectiveEqRoot,
    changed: (status) => {
      sendToMain(IPC.spellLibraryStatusChanged, status)
      const source = `${status.installation ?? ''}:${status.dataset?.snapshotId ?? ''}`
      if (source !== modifierSource) { modifierSource = source; notifySpellModifierInputs() }
    },
    modifierContext: getModifierContext,
    log: (error) => logError('main:spellLibrary', error),
    selectInstallation: selectSpellInstallation,
    prepareReference: prepareCapturedSpellTable,
    installReference: activateCapturedSpellTable,
    activateEngine: async (root, snapshotId, directory) => {
      const result = await engineRequest('clientSpells.activate', {
        root, snapshotId, spellsPath: join(directory, 'spells_us.txt'), dbstrPath: join(directory, 'dbstr_us.txt')
      })
      return result.clientSpellsActivated
    }
  })
  return service
}

export function startSpellLibrary(): void {
  const library = spellLibrary()
  const launches = new EqClientLaunches()
  void library.start()
  releasePresence = subscribePresence(() => { /* The library consumes process identities on the same worker. */ })
  releaseClients = onEqClients((clients) => {
    if (launches.observe(clients).length > 0) void library.check('game-launch')
  })
}
export function stopSpellLibrary(): void {
  stopModifierContext()
  releaseClients?.()
  releasePresence?.()
  releaseClients = releasePresence = null
  service?.stop()
  service = null
}
