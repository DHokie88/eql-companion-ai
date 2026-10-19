import { createContext, useContext, type ReactNode, type JSX } from 'react'
import type { SpellModifiersState } from './useSpellModifiers'

const RankState = createContext<{ state: SpellModifiersState; snapshotId: string | null } | null>(null)
export function SpellRankProvider({ state, snapshotId, children }: { state: SpellModifiersState; snapshotId: string | null; children: ReactNode }): JSX.Element {
  return <RankState.Provider value={{ state, snapshotId }}>{children}</RankState.Provider>
}
export function useSpellRankState(): SpellModifiersState | null { return useContext(RankState)?.state ?? null }
export function useSpellRankSnapshot(): string | null { return useContext(RankState)?.snapshotId ?? null }
