import { app, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import Store from 'electron-store'
import { DEFAULT_ORACLE_CONNECTION, ORACLE_IPC, oracleConnection, oracleQuestion, oracleSourceUrl, type CommunityQuery, type OracleConnection, type OracleStatus } from '../../shared/oracle'
import { closeOracleWorker, communityFeed, searchReferences } from '../oracle/client'
import { completionText, requestLocalModel } from '../oracle/provider'
import { groundedAnswer, oracleMessages, sourcesAnswer } from '../oracle/prompt'

let connectionStore: Store<{ connection: OracleConnection }> | undefined
function settings(): Store<{ connection: OracleConnection }> {
  return connectionStore ??= new Store({ name: 'oracle-connection', defaults: { connection: DEFAULT_ORACLE_CONNECTION } })
}
function connection(): OracleConnection { return oracleConnection(settings().get('connection')) }
const active = new Map<number, { id: string; abort: AbortController }>()
function mainFrame(event: IpcMainInvokeEvent): void {
  if (event.senderFrame !== event.sender.mainFrame) throw new Error('Assistant requests must come from the main window')
}
function feedQuery(input: unknown): CommunityQuery {
  const q = (input ?? {}) as CommunityQuery
  if (!q || typeof q !== 'object') throw new Error('Invalid news filters')
  if (q.scope && !['all', 'official', 'guild'].includes(q.scope)) throw new Error('Invalid server filter')
  if (q.category && !['all', 'patches', 'highlights', 'issues', 'classes', 'guides', 'events'].includes(q.category)) throw new Error('Invalid news category')
  if (q.query !== undefined && (typeof q.query !== 'string' || q.query.length > 200)) throw new Error('Search is limited to 200 characters')
  validatePages(q)
  return { scope: q.scope, category: q.category, query: q.query, offset: q.offset, limit: q.limit }
}
function validatePages(q: CommunityQuery): void {
  for (const n of [q.offset, q.limit]) if (n !== undefined && (!Number.isSafeInteger(n) || n < 0)) throw new Error('Invalid news page')
}
async function ask(event: IpcMainInvokeEvent, input: unknown): Promise<import('../../shared/oracle').OracleAnswer> {
  mainFrame(event)
  const q = oracleQuestion(input)
  const sender = event.sender.id
  if (active.has(sender)) throw new Error('Wait for the current answer or cancel it first')
  const abort = new AbortController()
  const cancel = (): void => abort.abort()
  active.set(sender, { id: q.id, abort })
  event.sender.once('destroyed', cancel)
  try {
    const citations = await searchReferences(q.question, q.scope)
    if (abort.signal.aborted) throw new Error('Question cancelled.')
    if (!citations.length) return sourcesAnswer([])
    try {
      const c = connection()
      const response = await requestLocalModel(c, { body: { model: c.model, messages: oracleMessages(q.question, citations),
        temperature: 0.15, max_tokens: 1200, chat_template_kwargs: { enable_thinking: false } } }, abort.signal)
      if (abort.signal.aborted) throw new Error('Question cancelled.')
      return groundedAnswer(completionText(response), citations, c.model)
    } catch (error) {
      if (abort.signal.aborted) throw new Error('Question cancelled.')
      return sourcesAnswer(citations, error instanceof Error ? error.message : 'The local model is unavailable.')
    }
  } finally { active.delete(sender); event.sender.removeListener('destroyed', cancel) }
}
async function testConnection(): Promise<OracleStatus> {
  const c = connection()
  try {
    const response = await requestLocalModel(c, { probe: true }) as { data?: { id: string }[] }
    const available = response.data?.some(m => m.id === c.model) ?? false
    return { connection: c, available, message: available ? `${c.model} is ready on ${c.host}.` : `The computer responded, but ${c.model} is not loaded.` }
  } catch (error) { return { connection: c, available: false, message: error instanceof Error ? error.message : 'Could not reach the local model.' } }
}
export function registerOracleIpc(): void {
  ipcMain.handle(ORACLE_IPC.feed, (event, input: unknown) => { mainFrame(event); return communityFeed(feedQuery(input)) })
  ipcMain.handle(ORACLE_IPC.ask, ask)
  ipcMain.handle(ORACLE_IPC.cancel, (event, id: unknown) => {
    mainFrame(event)
    const job = active.get(event.sender.id)
    if (job && job.id === id) job.abort.abort()
  })
  ipcMain.handle(ORACLE_IPC.status, (event): OracleStatus => { mainFrame(event); return { connection: connection(), message: 'Shared local model for all EQ Oracle question boxes. Use Test connection to check availability.' } })
  ipcMain.handle(ORACLE_IPC.configure, (event, input: unknown): OracleStatus => {
    mainFrame(event)
    const c = oracleConnection(input)
    settings().set('connection', c)
    return { connection: c, message: 'Global assistant connection saved.' }
  })
  ipcMain.handle(ORACLE_IPC.test, event => { mainFrame(event); return testConnection() })
  ipcMain.handle(ORACLE_IPC.open, async (event, input: unknown) => {
    mainFrame(event)
    const url = oracleSourceUrl(input)
    if (!url) throw new Error('This source link is unavailable')
    await shell.openExternal(url)
  })
  app.once('will-quit', () => { for (const job of active.values()) job.abort.abort(); closeOracleWorker() })
}
