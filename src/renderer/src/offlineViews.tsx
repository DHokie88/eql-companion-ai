import type { JSX } from 'react'
import type { View } from './appViews'
import CommunityView from './features/community/CommunityView'
import OracleView from './features/oracle/OracleView'
// OWNER-ONLY. `devTriage` holds the single `DEV_TOOLS ? lazy(() => import(…)) : null` — the
// STRIP, which is a compile-time question and stays on `DEV_TOOLS`; in a build without the flag
// its only use below is dead code, so rollup drops the import and the entire triage feature with
// it. WHETHER TO SHOW IT is a second question and a runtime one (`OWNER_TOOLS`, JOS-72). See
// devTriage.tsx / devFlags.ts.
import DevTriageView from './devTriage'
import { OWNER_TOOLS } from './devFlags'

// These views read reference data rather than a character log. Dev tools still strip at build time.
export const OFFLINE_VIEWS: Partial<Record<View, JSX.Element>> = {
  community: <CommunityView />,
  oracle: <OracleView />,
  ...(OWNER_TOOLS ? { triage: <DevTriageView /> } : {})
}

