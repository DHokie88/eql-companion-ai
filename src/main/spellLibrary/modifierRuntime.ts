import { app } from 'electron'
import { join } from 'node:path'
import { IPC } from '../../shared/ipc'
import type { SpellModifierContext } from '../../shared/spellModifiers'
import { logError } from '../errorLog'
import { sendToMain } from '../windows'
import { SpellModifierCoordinator, type ModifierFacts, type ModifierSelection } from './modifierContext'
import { modifierProfileFile } from './modifierProfiles'
import { setSpellModifierInputsObserver } from './modifierEvents'
import { modifierRanks } from './modifierRanks'
import { readModifierInventory } from './modifierInventory'

let coordinator: SpellModifierCoordinator | null = null
let initializing: Promise<SpellModifierCoordinator> | null = null
let generation = 0

async function readInputs(who: ModifierSelection): Promise<ModifierFacts> {
  const [{ engineRequest, engineServeReadiness }, outputs, { COMMITTED_ITEMS }] = await Promise.all([
    import('../dataServer/engineClientHost'), import('../outputs'), import('../planner/wornFocusIndex')
  ])
  let ranks: SpellModifierContext['ranks'] = null
  const warnings: string[] = []
  try {
    if (!engineServeReadiness().ok) throw new Error('Engine fold is not ready')
    const snapshot = await engineRequest('module.snapshot', { module: 'observedSpellRanks' })
    if (engineServeReadiness().ok) ranks = modifierRanks(snapshot.state)
  } catch {
    warnings.push('Observed mote ranks are unavailable while the engine is starting or reconnecting.')
  }
  if (ranks === null && warnings.length === 0) warnings.push('Observed mote rank evidence is unavailable.')
  let inventory: SpellModifierContext['inventory']
  try {
    inventory = readModifierInventory(who.character, {
      status: (character) => outputs.outputStatus('inventory', character),
      load: (character) => outputs.loadInventoryDump(character.name, character.server), items: COMMITTED_ITEMS
    })
  } catch (error) {
    logError('main:spellModifiers:inventory', error)
    inventory = { state: 'error', exportedAt: null, candidates: [], warnings: ['The inventory export could not be read. Run /outputfile inventory again.'] }
  }
  return { ranks, inventory, warnings }
}

async function createCoordinator(): Promise<SpellModifierCoordinator> {
  const current = generation
  // Lazy edges avoid booting session/engine through a notification that those modules import.
  const [{ getActiveCharacter }, { effectiveEqRoot }] = await Promise.all([import('../session'), import('../log/config')])
  if (current !== generation) throw new Error('Spell modifier context has stopped')
  coordinator = new SpellModifierCoordinator({
    selection: () => ({ installation: effectiveEqRoot(), character: getActiveCharacter() }), read: readInputs,
    store: modifierProfileFile(join(app.getPath('userData'), 'spell-modifiers.json')),
    changed: (revision) => sendToMain(IPC.spellLibraryModifiersChanged, revision),
    log: (error) => logError('main:spellModifiers', error)
  })
  setSpellModifierInputsObserver(modifierInputsChanged)
  return coordinator
}

async function runtime(): Promise<SpellModifierCoordinator> {
  if (coordinator !== null) return coordinator
  initializing ??= createCoordinator().finally(() => { initializing = null })
  return initializing
}

export async function getModifierContext(): Promise<SpellModifierContext> { return (await runtime()).get() }
export async function updateModifierPreferences(input: unknown): Promise<SpellModifierContext> { return (await runtime()).update(input) }
export function modifierInputsChanged(): void { coordinator?.inputsChanged() }
export async function assertModifierContextRevision(revision: string): Promise<SpellModifierContext> {
  const context = await getModifierContext()
  if (context.revision !== revision) throw new Error('Spell modifier context changed; refresh and try again')
  return context
}
export function stopModifierContext(): void {
  generation++
  coordinator?.stop()
  coordinator = null
  setSpellModifierInputsObserver(null)
}
