import assert from 'node:assert/strict'
import { test } from 'node:test'
import { coverageSummary } from '../src/shared/communityCoverage.ts'

const historicalLong = 'Stored harvest reported fifteen channels permission-blocked (HTTP 403; not rechecked by offline export), including private/staff channels.'
const historicalShort = 'Earlier capture: permission-blocked channels were not rechecked.'
const pricesLong = "The guild's current WTS/WTB price lists are PNG images; numbers were not extracted; text-posted rates and prose prices are present."
const pricesShort = 'WTS/WTB price-list PNG images; numbers were not extracted.'
const pollLong = 'Poll results absent from stored harvest; poll payload not captured; poll-based decisions unavailable.'
const pollShort = 'Poll results were not captured.'

const historical = {
  id: 'historical-channel-access',
  title: 'Historical channel access',
  detail: 'An earlier capture reported restricted channels. This does not confirm their current access.',
}
const prices = {
  id: 'image-only-prices',
  title: 'Image-only prices',
  detail: 'Numbers inside guild price-list images have not been extracted. Prices posted as text are included.',
}
const polls = {
  id: 'poll-results',
  title: 'Poll results',
  detail: 'Poll results are not included in the saved data.',
}

test('six representative variants collapse to three groups', () => {
  const notes = [pricesLong, historicalLong, pollLong, pricesShort, historicalShort, pollShort]
  assert.deepEqual(coverageSummary(notes), [prices, historical, polls])
})

test('a combined historical permission and poll warning contributes both groups', () => {
  const combined = 'Stored harvest reported fifteen channels permission-blocked (HTTP 403; not rechecked by offline export), and poll results were not returned by the user-token API.'
  assert.deepEqual(coverageSummary([combined]), [historical, polls])
})

test('unknown warnings and current access denials stay visible', () => {
  const current = 'HTTP 403 permission denied for the live channel read.'
  const unknown = 'Saved note says <b>check the log</b>.'
  assert.deepEqual(coverageSummary([current, unknown]), [
    { id: 'note-http-403-permission-denied-for-the-live-channel-read', title: current, detail: current },
    { id: 'note-saved-note-says-b-check-the-log-b', title: unknown, detail: unknown },
  ])
  assert.equal(coverageSummary([current]).some(row => row.title === historical.title), false)
})

test('whitespace and case variants deduplicate', () => {
  const notes = [
    `  ${pricesLong.toUpperCase()}  `,
    pricesLong,
    '  Custom Export Warning  ',
    'custom   export warning',
    'CUSTOM EXPORT WARNING',
    'stored-harvest reported permission-blocked channels (HTTP403; not-rechecked by offline export)',
  ]
  assert.deepEqual(coverageSummary(notes), [
    prices,
    { id: 'note-custom-export-warning', title: 'Custom Export Warning', detail: 'Custom Export Warning' },
    historical,
  ])
})

test('blank notes and an empty list produce no rows', () => {
  assert.deepEqual(coverageSummary([]), [])
  assert.deepEqual(coverageSummary(['', '   ', '\n\t', ' \n ']), [])
})

test('coverageSummary does not mutate its input', () => {
  const notes = Object.freeze(['', '  Poll results not captured.  ', historicalLong])
  const before = notes.slice()
  assert.deepEqual(coverageSummary(notes), [polls, historical])
  assert.deepEqual(notes, before)
})
