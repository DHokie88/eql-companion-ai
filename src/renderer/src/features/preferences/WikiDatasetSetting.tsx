// Startup and manual refresh check the same public item feed. A new pack is used next launch.

import { type JSX, useCallback, useEffect, useState } from 'react'
import { Box, Button, Chip, Stack, Typography } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import type { PrefSection } from './PreferencesView'
import type { WikiDatasetStatus } from '@shared/wikiDataset'
import { formatDateTime } from '../../lib/formatDate'

function showTime(iso: string | null, empty: string): string {
  if (!iso) return empty
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return iso
  return formatDateTime(ms)
}

function sourceLine(status: WikiDatasetStatus): string {
  if (status.restartRequired) {
    return 'Downloaded wiki data is saved. This session still uses the dataset Oracle opened with. Restart Oracle to use the download.'
  }
  if (status.state === 'error') {
    return 'Offline fallback: the last good dataset stays in use. Shipped Oracle corpora still cover records the cache does not replace.'
  }
  if (status.state === 'bundled' || status.version === null) {
    return 'Source: shipped Oracle corpora. Nothing has been downloaded yet.'
  }
  return 'Source: saved wiki dataset merged with Oracle quest, crafting, alias, and era records.'
}

export function WikiDatasetSetting(): JSX.Element {
  const [status, setStatus] = useState<WikiDatasetStatus | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let pushed = false
    const unsubscribe = window.eq.onWikiDatasetStatus((next) => {
      pushed = true
      setLocalError(null)
      setStatus(next)
    })
    window.eq.getWikiDatasetStatus().then(
      (next) => {
        if (!cancelled && !pushed) setStatus(next)
      },
      (err: unknown) => {
        if (!cancelled && !pushed) setLocalError(err instanceof Error ? err.message : 'Wiki dataset status failed.')
      }
    )
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const refresh = useCallback(() => {
    setLocalError(null)
    setStatus((current) => (current ? { ...current, state: 'refreshing' } : current))
    window.eq.refreshWikiDataset().then(
      (next) => setStatus(next),
      (err: unknown) => {
        setLocalError(err instanceof Error ? err.message : 'Wiki dataset refresh failed.')
        setStatus((current) => current ? { ...current, state: 'error' } : current)
      }
    )
  }, [])

  if (!status) {
    return (
      <Typography variant="body2" color="text.secondary">
        {localError ?? 'Loading wiki data…'}
      </Typography>
    )
  }

  return <WikiDatasetCard status={status} localError={localError} refresh={refresh} />
}

function statusChip(status: WikiDatasetStatus) {
  return (
    status.restartRequired && status.state !== 'refreshing'
      ? { label: 'restart required', color: 'warning' as const }
      : status.state === 'ready'
        ? { label: 'saved dataset', color: 'success' as const }
        : status.state === 'refreshing'
          ? { label: 'refreshing', color: 'info' as const }
          : status.state === 'error'
            ? { label: 'refresh failed', color: 'warning' as const }
            : { label: 'shipped corpora', color: 'default' as const }
  )
}

interface CardProps { status: WikiDatasetStatus; localError: string | null; refresh: () => void }
function WikiDatasetCard({ status, localError, refresh }: CardProps): JSX.Element {
  const busy = status.state === 'refreshing'
  const chip = statusChip(status)
  return (
    <Stack spacing={1.25} data-testid="wiki-dataset-setting">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Chip size="small" variant="outlined" color={chip.color === 'default' ? undefined : chip.color} label={chip.label} />
        <Typography variant="caption" color="text.secondary">
          {status.version ? `Dataset ${status.version}` : 'No downloaded dataset'}
        </Typography>
      </Box>
      <Typography variant="body2">{sourceLine(status)}</Typography>
      {status.restartRequired && (
        <Typography variant="body2" color="warning.main">
          Restart required.
        </Typography>
      )}
      <Typography variant="body2">
        Usable wiki item pages {status.items} · NPCs {status.npcs} · Zones {status.zones}
        {identityCounts(status)}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Generated {showTime(status.generatedAt, 'unknown')} · Checked {showTime(status.checkedAt, 'never')}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Oracle checks for new item data when it opens. New downloads are used the next time you open Oracle.
      </Typography>
      {(status.error ?? localError) && (
        <Typography variant="caption" color="warning.main" sx={{ wordBreak: 'break-word' }}>
          {status.error ?? localError}
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary">
        NPC and zone counts describe the export only. This update does not add live NPC data.
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Future-era or unknown records are not proof that an item is available on current EverQuest Legends. A
        Classic tag is not proof of that either.
      </Typography>
      <Box>
        <Button
          size="small"
          variant="outlined"
          startIcon={<RefreshIcon />}
          disabled={busy}
          onClick={refresh}
          data-testid="wiki-dataset-refresh"
        >
          Refresh
        </Button>
      </Box>
    </Stack>
  )
}

export function wikiDatasetSection(): PrefSection {
  return { id: 'wiki-data', label: 'Wiki data', icon: <MenuBookIcon fontSize="small" />,
    items: [{ id: 'wiki-dataset', label: 'Wiki data',
      keywords: 'wiki eoz dataset refresh items npcs zones cache offline restart corpora',
      content: <WikiDatasetSetting /> }] }
}

function identityCounts(status: WikiDatasetStatus): string {
  const conflicts = status.identityConflicts ?? 0, held = status.quarantinedItems ?? 0
  return conflicts > 0 || held > 0 ? ` · Identity conflicts ${conflicts} · Items held for identity review ${held}` : ''
}
