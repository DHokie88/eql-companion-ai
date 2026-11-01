import { ensureWikiDatasetLoaded } from '../wikiDataset'
import { ipcMain } from 'electron'
import { IPC } from '../../shared/ipc'
import { LOADOUT_IDS, type LoadoutId, type LoadoutState } from '../../shared/loadouts'
import { activeCharId, getActiveCharacter } from '../session'
import { changeLoadoutBook, getLoadoutBook, captureLoadoutBook } from '../storeLoadouts'
import { buildCharacterSheet } from './characterSheet'
import { loadInventoryDump } from '../outputs'
import { equippedHosts } from '../../shared/planner/inventorySlots'
import { itemKey } from '../itemsDb'
function current(): LoadoutState { const characterId = activeCharId(); return { characterId, book: getLoadoutBook(characterId) } }
function guard(characterId: unknown): string {
  if (!getActiveCharacter() || typeof characterId !== 'string' || characterId !== activeCharId()) throw new Error('The character changed. Reopen the loadout and try again.')
  return characterId
}
export function registerLoadoutsIpc(): void {
  ipcMain.handle(IPC.loadoutsGet, () => current())
  ipcMain.handle(IPC.loadoutsUpdate, (_event, id: unknown, change: unknown): LoadoutState => {
    const characterId = guard(id)
    return { characterId, book: changeLoadoutBook(characterId, change) }
  })
  ipcMain.handle(IPC.loadoutsCapture, async (_event, rawCharacterId: unknown, rawId: unknown): Promise<LoadoutState> => {
    guard(rawCharacterId)
    await ensureWikiDatasetLoaded()
    const characterId = guard(rawCharacterId)
    if (typeof rawId !== 'string' || !(LOADOUT_IDS as readonly string[]).includes(rawId)) throw new Error('Choose a saved loadout.')
    const id = rawId as LoadoutId
    const lo = getLoadoutBook(characterId).loadouts.find((v) => v.id === id)
    if (!lo || lo.classes.length === 0) throw new Error('Set this loadout’s classes first.')
    const character = getActiveCharacter()
    const loaded = loadInventoryDump(character?.name, character?.server)
    const sheet = buildCharacterSheet()
    if (!loaded || !sheet) throw new Error('Export inventory in EQL before saving equipment.')
    if (sheet.path !== loaded.path || sheet.loadedAt !== loaded.loadedAt) throw new Error('Inventory changed during capture. Save current equipment again.')
    const equipment = { path: sheet.path, loadedAt: sheet.loadedAt, cells: sheet.cells, unplaced: sheet.unplaced, totals: sheet.totals }
    const capture = { capturedAt: new Date().toISOString(), classes: lo.classes.slice(), sheet: equipment,
      inventory: { path: loaded.path, loadedAt: loaded.loadedAt, hosts: equippedHosts(loaded.dump).map((h) => ({ ...h, key: itemKey(h.name) })) } }
    return { characterId, book: captureLoadoutBook(characterId, id, capture) }
  })
}
