// "COPY THIS VIEW AS TEXT" — the quiet icon every combat panel header carries.
//
// Extracted VERBATIM from combatShared.tsx when the proc-rate tag pushed that file past the
// 400-code-line ceiling with an EMPTY ratchet (the repo's rule: extract, never widen the
// ratchet). It is the cleanest cut available — this control shares nothing with the bars, the
// colors or the card chrome beside it; it needs no import from its old home, so the split is
// acyclic by construction and combatShared re-exports it so no caller's import path moved.

import { useEffect, useState } from 'react'
import { IconButton } from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { Tooltip } from '../../lib/Tooltip'
import { macroSend } from '../../../../shared/worth'

/**
 * A panel header's copy affordance: it puts the CURRENT view — at whatever drill level it
 * happens to be — on the clipboard as plain text (see copyText.ts).
 *
 * `getText` is a thunk, not a string: serializing a view walks its whole row list, and a panel
 * header re-renders on every snapshot tick — so the text is built when the user actually asks
 * for it and never on the render path.
 *
 * Feedback is the icon itself flashing to a checkmark for ~1.5s. No toast: this app doesn't nag,
 * and a copy is not an event worth a banner. A clipboard that isn't there (or refuses) logs and
 * changes nothing on screen — a failed copy must never look like a successful one.
 *
 * THE COPY GOES THROUGH MAIN (`window.eq.writeClipboard` → `clipboard:write`), not through
 * `navigator.clipboard.writeText`. The web Clipboard API is permission-gated in Chromium
 * ('clipboard-sanitized-write') and this app denies EVERY web permission wholesale
 * (`hardenSession`, src/main/windows.ts), so writeText rejected with `NotAllowedError: Write
 * permission denied.` on every click — measured in the real app, which is exactly why this
 * button did nothing. Electron's main-process clipboard consults no permission, so the fix is a
 * validated IPC hop, never a hole in the permission policy.
 */
export function CopyButton({
  getText,
  title = 'Copy this view as text'
}: {
  getText: () => string
  title?: string
}): React.JSX.Element {
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => setDone(false), 1500)
    return () => clearTimeout(t)
  }, [done])
  const copy = (): void => {
    // The click is the confirmation. An empty body is held, the same as a clipboard that refuses it.
    const sent = macroSend(getText(), true)
    if (!sent.written) return
    window.eq.writeClipboard(sent.body).then(
      (ok) => {
        if (ok) {
          setDone(true)
          return
        }
        // Deliberate console (like lib/ErrorBoundary): main's console-message forwarder is what
        // puts a renderer failure into errors.log, and a failed copy must leave a trace there
        // rather than silently looking like a successful one.
        // eslint-disable-next-line no-console
        console.error('[everquest-companion:error] copy failed: nothing was written')
      },
      // eslint-disable-next-line no-console
      (err: unknown) => console.error('[everquest-companion:error] copy failed', err)
    )
  }
  return (
    <Tooltip title={done ? 'Copied' : title}>
      <IconButton
        size="small"
        data-testid="copy-view"
        onClick={copy}
        sx={{
          p: 0.25,
          alignSelf: 'center',
          flexShrink: 0,
          color: done ? 'success.main' : 'text.disabled',
          '&:hover': { color: 'text.primary' }
        }}
      >
        {done ? <CheckIcon sx={{ fontSize: 15 }} /> : <ContentCopyIcon sx={{ fontSize: 15 }} />}
      </IconButton>
    </Tooltip>
  )
}
