import { useEffect, useState } from 'react'
import {
  EMPTY_SKY_OVERLAY,
  SKY_OVERLAY_KEY,
  SKY_OVERLAY_REQUEST_KEY,
  parseSkyOverlay,
  type SkyOverlayPayload
} from '../../../shared/skyQuestOverlay'

export function useSkyOverlayRows(): SkyOverlayPayload {
  const [payload, setPayload] = useState(EMPTY_SKY_OVERLAY)
  useEffect(() => {
    const request = crypto.randomUUID()
    const onStorage = (event: StorageEvent): void => {
      if (event.key !== SKY_OVERLAY_KEY && event.key !== null) return
      try {
        setPayload(parseSkyOverlay(localStorage.getItem(SKY_OVERLAY_KEY), request))
      } catch {
        setPayload(EMPTY_SKY_OVERLAY)
      }
    }
    window.addEventListener('storage', onStorage)
    try {
      localStorage.setItem(SKY_OVERLAY_REQUEST_KEY, request)
    } catch {
      // Storage is unavailable, so the overlay remains in its waiting state.
    }
    return () => {
      window.removeEventListener('storage', onStorage)
    }
  }, [])
  return payload
}
