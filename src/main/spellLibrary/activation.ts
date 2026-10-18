/** Avoid a dependency cycle between session/engine startup and the catalog coordinator. */
let activate: (() => Promise<void>) | null = null
export function setSpellActivation(callback: (() => Promise<void>) | null): void { activate = callback }
export async function replaySpellActivation(): Promise<void> { await activate?.() }
