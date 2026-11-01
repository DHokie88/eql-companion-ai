import { getProgress, setProgress } from './store'
import { applyLoadoutChange, normalizeLoadoutBook, type LoadoutBook, type LoadoutCapture, type LoadoutId } from '../shared/loadouts'
export function getLoadoutBook(charId: string): LoadoutBook { return normalizeLoadoutBook(getProgress(charId).loadoutBook) }
export function changeLoadoutBook(charId: string, change: unknown): LoadoutBook {
  const progress = getProgress(charId)
  const book = applyLoadoutChange(normalizeLoadoutBook(progress.loadoutBook), change)
  setProgress(charId, { ...progress, loadoutBook: book })
  return book
}
export function captureLoadoutBook(charId: string, id: LoadoutId, capture: LoadoutCapture): LoadoutBook {
  const progress = getProgress(charId)
  const book = normalizeLoadoutBook(progress.loadoutBook)
  book.loadouts = book.loadouts.map((lo) => lo.id === id ? { ...lo, capture } : lo)
  setProgress(charId, { ...progress, loadoutBook: book })
  return book
}
