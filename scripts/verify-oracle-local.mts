/** Explicit opt-in live local-model check. No paid API, no changes to aw. */
import assert from 'node:assert/strict'
import { catalogSources } from '../src/main/oracle/catalog'
import { discordIndex } from '../src/main/oracle/discord'
import { OracleIndex } from '../src/main/oracle/search'
import { completionText, requestLocalModel } from '../src/main/oracle/provider'
import { groundedAnswer, oracleMessages } from '../src/main/oracle/prompt'
import { DEFAULT_ORACLE_CONNECTION, oracleConnection } from '../src/shared/oracle'

const addressIndex = process.argv.indexOf('--address')
const connection = oracleConnection({ ...DEFAULT_ORACLE_CONNECTION, address: addressIndex >= 0 ? process.argv[addressIndex + 1] : '' })
const probe = await requestLocalModel(connection, { probe: true }) as { data?: { id: string }[] }
assert.ok(probe.data?.some(m => m.id === connection.model), 'local model not loaded')
const [catalog, discord] = await Promise.all([catalogSources(), discordIndex()])
const index = new OracleIndex([...catalog, ...discord.sources])
for (const question of ['What does Pillar of Fire do?', 'How do I copy UI and hotbars between loadouts?']) {
  const citations = index.search(question)
  assert.ok(citations.length, 'no retrieved evidence')
  const response = await requestLocalModel(connection, { body: { model: connection.model, messages: oracleMessages(question, citations), temperature: 0.15, max_tokens: 1000, chat_template_kwargs: { enable_thinking: false } } })
  const answer = groundedAnswer(completionText(response), citations, connection.model)
  assert.equal(answer.mode, 'ai', answer.notice)
  assert.ok(answer.citations.length)
  console.log(JSON.stringify({ question, answer: answer.answer, sources: answer.citations.map(c => ({ number: c.number, title: c.title, kind: c.kind, url: c.url })) }, null, 2))
}
