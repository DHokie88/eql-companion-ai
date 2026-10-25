import { spawn } from 'node:child_process'
import { oracleConnection, type OracleConnection } from '../../shared/oracle'
import { oracleRefreshStatus, type OracleRefreshStatus } from '../../shared/oracleRefresh'

/** Neither user text nor a remote result can become a shell command. */
export function refreshArgs(connection: OracleConnection, command: 'request' | 'status', force: boolean): string[] {
  const c = oracleConnection(connection)
  return ['-T', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=5', '-o', 'StrictHostKeyChecking=yes',
    ...(c.address ? ['-o', `HostName=${c.address}`] : []), c.host,
    `python3 /home/andrew/eql-discord-harvest/refresh_control.py ${command}${command === 'request' && force ? ' --force' : ''}`]
}
export function requestDiscordRefresh(connection: OracleConnection, command: 'request' | 'status', force: boolean, signal: AbortSignal): Promise<OracleRefreshStatus> {
  if (signal.aborted) return Promise.reject(new Error('The Discord check stopped.'))
  return new Promise((resolve, reject) => {
    const child = spawn('ssh', refreshArgs(connection, command, force), { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let text = ''
    let settled = false
    const finish = (error?: Error): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      if (error) { child.kill(); reject(error); return }
      try { resolve(oracleRefreshStatus(JSON.parse(text) as unknown)) } catch { reject(new Error('The Discord check returned an unreadable status. Saved updates remain available.')) }
    }
    const abort = (): void => finish(new Error('The Discord check stopped.'))
    const timer = setTimeout(() => finish(new Error('Could not reach the Discord refresh computer. Saved updates remain available.')), 15_000)
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => { text += chunk; if (text.length > 16_000) finish(new Error('The Discord check returned too much data.')) })
    // Consume diagnostics without displaying credential paths or verbose SSH details.
    child.stderr.resume()
    child.once('error', () => finish(new Error('Could not start the Discord check. Check your existing SSH connection.')))
    child.once('close', code => finish(code === 0 ? undefined : new Error('The Discord check could not finish. Saved updates remain available.')))
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
  })
}
