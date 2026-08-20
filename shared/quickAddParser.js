// shared/quickAddParser.js
//
// Free, offline, rule-based natural language parser for the Quick Add
// bubble. Lives in shared/ (not mobile/src/ or web/src/) following the
// same convention as shared/eventLogic.js — pure JS, no React Native or
// DOM dependencies, so both platforms import this exact file.
//
// Uses chrono-node (pure JS, no native deps, no network calls) for
// date/time extraction, plus custom regex for recurrence. Zero cost,
// zero network calls.
//
// Install in BOTH mobile/ and web/: npm install chrono-node

import * as chrono from 'chrono-node'

const RECURRENCE_PATTERNS = [
  { regex: /\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, build: (m) => ({ type: 'weekly', byDay: m[1].toLowerCase() }) },
  { regex: /\bevery\s+day\b|\bdaily\b/i, build: () => ({ type: 'daily' }) },
  { regex: /\bevery\s+week\b|\bweekly\b/i, build: () => ({ type: 'weekly' }) },
  { regex: /\bevery\s+month\b|\bmonthly\b/i, build: () => ({ type: 'monthly' }) },
  { regex: /\bevery\s+year\b|\bannually\b|\byearly\b/i, build: () => ({ type: 'yearly' }) }
]

/**
 * Parses free-text input into a draft event object.
 * Never throws — always returns a best-effort draft, even if nothing
 * date/time-like was found (falls back to "now" so the form still opens).
 *
 * @param {string} rawText
 * @returns {{
 *   name: string,
 *   startTime: Date,
 *   endTime: Date | null,
 *   recurrence: { type: string, byDay?: string } | null,
 *   parseNotes: string[]
 * }}
 */
export function parseQuickAddText(rawText) {
  const notes = []
  let text = (rawText || '').trim()

  if (!text) {
    return {
      name: '',
      startTime: new Date(),
      endTime: null,
      recurrence: null,
      parseNotes: ['No text entered — fill in details manually.']
    }
  }

  // 1. Pull out recurrence phrase first, so it doesn't confuse chrono-node
  // or end up left over in the event name.
  let recurrence = null
  for (const { regex, build } of RECURRENCE_PATTERNS) {
    const match = text.match(regex)
    if (match) {
      recurrence = build(match)
      text = (text.slice(0, match.index) + text.slice(match.index + match[0].length)).trim()
      notes.push(`Detected recurrence: ${recurrence.type}${recurrence.byDay ? ' on ' + recurrence.byDay : ''}`)
      break
    }
  }

  // 2. Run chrono-node on what's left to find date/time and figure out
  // which chunk of text it consumed.
  const results = chrono.parse(text, new Date(), { forwardDate: true })

  let startTime = new Date()
  let endTime = null
  let nameText = text

  if (results.length > 0) {
    const best = results[0]
    startTime = best.start.date()
    if (best.end) {
      endTime = best.end.date()
    }
    nameText = (text.slice(0, best.index) + text.slice(best.index + best.text.length)).trim()
    notes.push(`Detected time: "${best.text}"`)
  } else {
    notes.push('No date/time found — defaulted to now, please set manually.')
  }

  // 3. Clean up leftover filler words/punctuation from the name.
  nameText = nameText
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,.\-–:]+|[\s,.\-–:]+$/g, '')
    .trim()

  if (!nameText) {
    nameText = 'Untitled event'
    notes.push('Could not isolate an event name — please edit.')
  }

  return {
    name: nameText,
    startTime,
    endTime,
    recurrence,
    parseNotes: notes
  }
}
