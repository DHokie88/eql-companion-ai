// Whether this machine may upload loot. Nothing is sent until the player signs in here.

const KEY = 'eq.loot.signedIn'

export interface LootSignStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function loadLootSignedIn(store: LootSignStore = localStorage): boolean {
  return store.getItem(KEY) === '1'
}

export function saveLootSignedIn(on: boolean, store: LootSignStore = localStorage): boolean {
  if (on) store.setItem(KEY, '1')
  else store.removeItem(KEY)
  return on
}
