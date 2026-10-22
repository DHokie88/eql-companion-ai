import { spawn } from 'node:child_process'
import type { OracleConnection } from '../../shared/oracle'
import { oracleConnection } from '../../shared/oracle'

// Fixed remote program. Questions are stdin JSON, NEVER shell code. The model remains on aw's loopback.
const remoteProgram = `import sys,json,urllib.request
p=json.load(sys.stdin)
path='/v1/models' if p.get('probe') else '/v1/chat/completions'
body=None if p.get('probe') else json.dumps(p['body']).encode('utf-8')
r=urllib.request.Request('http://127.0.0.1:8001'+path,data=body,headers={'Content-Type':'application/json'})
with urllib.request.urlopen(r,timeout=55) as response:
 sys.stdout.write(response.read(2000000).decode('utf-8'))
`
const command = `python3 -c "import base64;exec(base64.b64decode('${Buffer.from(remoteProgram).toString('base64')}'))"`
export function providerArgs(connection: OracleConnection): string[] {
  const c = oracleConnection(connection)
  return ['-T', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=5', '-o', 'StrictHostKeyChecking=yes',
    ...(c.address ? ['-o', `HostName=${c.address}`] : []), c.host, command]
}
export function requestLocalModel(connection: OracleConnection, payload: unknown, signal?: AbortSignal): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn('ssh', providerArgs(connection), { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
    let output = ''
    let diagnostics = ''
    let settled = false
    const finish = (error?: Error): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      if (error) { child.kill(); reject(error); return }
      try { resolve(JSON.parse(output) as unknown) } catch { reject(new Error('The local model returned an unreadable response.')) }
    }
    const abort = (): void => finish(new Error('Question cancelled.'))
    const timer = setTimeout(() => finish(new Error('The local model timed out. Your reference excerpts are still available.')), 60_000)
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (data: string) => { output += data; if (output.length > 2_000_000) finish(new Error('The local model response was too large.')) })
    child.stderr.on('data', (data: string) => { diagnostics = (diagnostics + data).slice(-4000) })
    child.stdin.on('error', () => finish(new Error('Could not send the question to the local model.')))
    child.on('error', () => finish(new Error('SSH could not start. Check the global assistant connection.')))
    child.on('close', code => finish(code === 0 ? undefined : new Error(connectionError(diagnostics))))
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) { abort(); return }
    child.stdin.end(JSON.stringify(payload))
  })
}
function connectionError(diagnostics: string): string {
  if (/resolve hostname/i.test(diagnostics)) return 'The model computer could not be found. Check the address in the global assistant connection.'
  if (/permission denied|authentication|host key/i.test(diagnostics)) return 'The model connection was refused. Check the VPN route and your existing SSH access.'
  if (/refused|HTTPError|URLError/i.test(diagnostics)) return 'The model service on aw is unavailable. Reference search still works.'
  return 'Could not reach the local model. Check that aw and its model service are running.'
}
export function completionText(response: unknown): string {
  if (!response || typeof response !== 'object') throw new Error('Empty local model response.')
  const choices = (response as { choices?: { message?: { content?: unknown } }[] }).choices
  const text = choices?.[0]?.message?.content
  if (typeof text !== 'string') throw new Error('The local model did not return an answer.')
  return text
}
