let changed: (() => void) | null = null

/** Leaf notification seam: session/engine code never needs to import its runtime consumer. */
export function notifySpellModifierInputs(): void { changed?.() }

export function setSpellModifierInputsObserver(observer: (() => void) | null): void { changed = observer }
