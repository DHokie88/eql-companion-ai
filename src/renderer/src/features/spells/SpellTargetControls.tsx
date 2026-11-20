import { useState, type JSX } from 'react'
import { FormControl, InputLabel, MenuItem, Select, Tooltip } from '@mui/material'
import type { SpellTargetCount } from '@shared/spellAnalysis'
import { SPELL_PREVIEW_MAX_TARGETS, spellPreviewTargets } from '@shared/spellAnalysis'

const TARGET_HELP = "Enemies in the area. Totals respect each spell's cap. A three-wave/four-hit rain offers 1+1+1 hits against one target, 2+2 against two, 3+1 against three, or 4 against four. Mana is paid once; healing stays per recipient."

export function SpellTargetControls({ targets, onChange, disabled = false }: { targets: SpellTargetCount; onChange: (targets: SpellTargetCount) => void; disabled?: boolean }): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  return <Tooltip disableInteractive title={menuOpen ? '' : TARGET_HELP} open={helpOpen && !menuOpen}
    onOpen={() => { if (!menuOpen) setHelpOpen(true) }} onClose={() => setHelpOpen(false)}>
    <span><FormControl size="small" sx={{ width: 130 }}><InputLabel id="spell-target-count-label">Targets</InputLabel>
      <Select labelId="spell-target-count-label" label="Targets" value={spellPreviewTargets(targets)} disabled={disabled} data-testid="spells-target-count"
        open={menuOpen} onOpen={() => { setMenuOpen(true); setHelpOpen(false) }} onClose={() => setMenuOpen(false)}
        onChange={(event) => onChange(Number(event.target.value))}>
        {Array.from({ length: SPELL_PREVIEW_MAX_TARGETS }, (_, n) => <MenuItem key={n + 1} value={n + 1}>{n + 1} target{n ? 's' : ''}</MenuItem>)}
      </Select>
    </FormControl></span>
  </Tooltip>
}
