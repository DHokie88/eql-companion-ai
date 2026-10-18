import type { JSX } from 'react'
import type { View } from '../../appViews'
import type { AppRouting } from '../../appRouting'
import { SpellLinkProvider } from '../../lib/spellLink'
import { SpellDrill } from './SpellPage'
import SpellsView from './SpellsView'

/** Both local records and supplementary wiki links are useful before a character log exists. */
export function SpellRoutes({ view, viewKey, routing }: { view: View; viewKey: string; routing: AppRouting }): JSX.Element {
  if (view === 'spells') return <SpellsView key={viewKey} routing={routing} />
  return <SpellLinkProvider open={routing.openSpell}><SpellDrill view={view} viewKey={viewKey} routing={routing} /></SpellLinkProvider>
}
