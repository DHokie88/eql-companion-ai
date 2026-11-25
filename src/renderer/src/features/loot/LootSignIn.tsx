import type { JSX } from 'react'
import { Button } from '@mui/material'
import { saveLootSignedIn } from './lootSession'

export function LootSignIn({ signedIn, onChange }: { signedIn: boolean; onChange: (on: boolean) => void }): JSX.Element {
  return (
    <Button
      size="small"
      data-testid="loot-sign-in"
      onClick={() => onChange(saveLootSignedIn(!signedIn))}
      sx={{ alignSelf: 'flex-start' }}
    >
      {signedIn ? 'Signed in' : 'Sign in to send loot'}
    </Button>
  )
}
