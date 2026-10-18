import type { EqClientProcess } from '../shared/eqClientProcess'

const listeners = new Set<(clients: EqClientProcess[]) => void>()
let observed: EqClientProcess[] | null = null

export function noteEqClients(clients: EqClientProcess[]): void {
  observed = clients
  for (const listener of listeners) listener(clients)
}

/** The caller also holds a presence subscription to keep its existing worker alive. */
export function onEqClients(listener: (clients: EqClientProcess[]) => void): () => void {
  listeners.add(listener)
  if (observed) listener(observed)
  return () => { listeners.delete(listener) }
}
