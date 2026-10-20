// The Combat tab's classification-ring readout — the append-only "Combat log" card at the
// bottom of the view. Split out of CombatView.tsx.

import { memo, useEffect, useRef, useState } from 'react'
import { Box, Button, FormControlLabel, Switch, Typography } from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { DashCard, QuietNote } from './combatShared'
import { formatTime } from '../../lib/formatDate'
import { copyText } from '../../lib/clipboard'
import { isAtBottom } from './followScroll'
import type { ClassifiedLine } from '@shared/combat'
import { PALETTE } from '../../../../shared/palette'

const ROLE_COLOR: Record<string, string> = {
  you: PALETTE.accent,
  pet: PALETTE.cyan,
  enemy: PALETTE.red,
  info: '#9aa0aa',
  dropped: '#e0554f'
}

// One classification-ring line. Memoized by value so that on each tick only the
// newly-appended lines mount — the ~150 stable prior lines skip re-render.
const LogLine = memo(
  function LogLine({ l }: { l: ClassifiedLine }): React.JSX.Element {
    return (
      <Box sx={{ display: 'flex', gap: 1, color: ROLE_COLOR[l.role] ?? 'text.primary', lineHeight: 1.5 }}>
        <span style={{ color: 'var(--mui-palette-text-disabled)', opacity: 0.7 }}>{formatTime(l.ts)}</span>
        <span style={{ minWidth: 62, opacity: 0.8 }}>{l.cat}</span>
        <span style={{ whiteSpace: 'pre-wrap' }}>{l.text}</span>
      </Box>
    )
  },
  (p, n) => p.l.ts === n.l.ts && p.l.cat === n.l.cat && p.l.role === n.l.role && p.l.text === n.l.text
)

export function ProcessingLog({
  lines,
  showUnparsed,
  setShowUnparsed
}: {
  lines: ClassifiedLine[]
  showUnparsed: boolean
  setShowUnparsed: (v: boolean) => void
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])
  const copy = async (): Promise<void> => {
    if (!lines.length) return
    const text = lines.map((l) => `${formatTime(l.ts)} ${l.cat} ${l.text}`).join('\n')
    if (await copyText(text)) setCopied(true)
  }
  // FOLLOW ONLY FROM THE BOTTOM (JOS-95). This used to scroll unconditionally on every append,
  // so during a live tail a reader could never scroll up — the next line yanked them back. The
  // reader's position is measured BEFORE the append moved anything (scroll events), and an
  // append only chases the bottom for a reader who was already there.
  const following = useRef(true)
  useEffect(() => {
    const el = ref.current
    if (el && following.current) el.scrollTop = el.scrollHeight
  }, [lines])
  // FIXED height, not minHeight (Task #56): this card's body is an append-only ring that grows
  // to 150 lines. As `flex: 0 0 auto` it sized to that CONTENT and — being unshrinkable —
  // squeezed the entire dashboard down to its `minHeight: 0`, so a few seconds after the live
  // tail started the Combat tab was JUST a scrolling log. The ring scrolls inside a fixed box.
  return (
    <DashCard
      title="Combat log"
      right={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            size="small"
            data-testid="copy-fight-log"
            disabled={lines.length === 0}
            onClick={() => { void copy() }}
            startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />}
            sx={{ textTransform: 'none' }}
          >
            {copied ? 'Copied' : 'Copy fight log'}
          </Button>
          <FormControlLabel
            control={<Switch size="small" checked={showUnparsed} onChange={(e) => setShowUnparsed(e.target.checked)} />}
            label={<Typography variant="caption">show unparsed</Typography>}
            sx={{ m: 0 }}
          />
        </Box>
      }
      height={220}
    >
      <Box
        ref={ref}
        data-testid="combat-log"
        onScroll={(e) => {
          const el = e.currentTarget
          following.current = isAtBottom(el.scrollTop, el.scrollHeight, el.clientHeight)
        }}
        sx={{ overflow: 'auto', flexGrow: 1, minHeight: 0, fontFamily: '"Consolas","Courier New",monospace', fontSize: 11 }}
      >
        {lines.length === 0 && <QuietNote>Waiting for combat…</QuietNote>}
        {lines.map((l, i) => (
          <LogLine key={`${l.ts}|${l.cat}|${i}`} l={l} />
        ))}
      </Box>
    </DashCard>
  )
}
