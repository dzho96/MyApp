// shared/quickAddParser.js
//
// Free, offline, rule-based natural language parser for the Quick Add
// bubble. Lives in shared/ (not mobile/src/ or web/src/) following the
// same convention as shared/eventLogic.js.
//
// Uses chrono-node for date/time extraction, plus custom regex for
// recurrence (including interval, "every other", byDay, and end
// conditions). Zero cost, zero network calls.

import * as chrono from 'chrono-node'

const UNIT_TO_FREQUENCY = {
  day: 'daily',
  week: 'weekly',
  month: 'monthly',
  year: 'yearly'
}

// Order matters: more specific patterns must be checked before the bare
// "every X" fallback, otherwise e.g. "every other week" would be caught
// by the generic weekly pattern first and lose the interval-2 meaning.
const RECURRENCE_PATTERNS = [
  // "every other day/week/month/year" -> interval 2
  {
    regex: /\bevery other (day|week|month|year)\b/i,
    build: (m) => ({ type: UNIT_TO_FREQUENCY[m[1].toLowerCase()], interval: 2 })
  },
  // "every 2 days" / "every 3 weeks" etc -> explicit numeric interval
  {
    regex: /\bevery (\d+) (day|week|month|year)s?\b/i,
    build: (m) => ({ type: UNIT_TO_FREQUENCY[m[2].toLowerCase()], interval: Math.max(1, parseInt(m[1], 10)) })
  },
  // "every Friday" -> weekly, anchored to that weekday via start_time
  {
    regex: /\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    build: (m) => ({ type: 'weekly', interval: 1, byDay: m[1].toLowerCase() })
  },
  // Bare "every day" / "daily" etc -> interval 1
  { regex: /\bevery\s+day\b|\bdaily\b/i, build: () => ({ type: 'daily', interval: 1 }) },
  { regex: /\bevery\s+week\b|\bweekly\b/i, build: () => ({ type: 'weekly', interval: 1 }) },
  { regex: /\bevery\s+month\b|\bmonthly\b/i, build: () => ({ type: 'monthly', interval: 1 }) },
  { regex: /\bevery\s+year\b|\bannually\b|\byearly\b/i, build: () => ({ type: 'yearly', interval: 1 }) }
]

// Matches "for the next month" / "for the next 2 weeks" etc. Applied as a
// MODIFIER after a recurrence pattern above has already matched — on its
// own, "for the next month" doesn't imply a repeating schedule.
const UNTIL_DURATION_PATTERN = /\bfor the next (\d+)?\s*(day|week|month|year)s?\b/i

// Fallback: "for the next N days" with NO other recurrence keyword present
// implies daily recurrence ending after N days (e.g. "take medicine for
// the next 5 days"). Deliberately restricted to the "day" unit and
// requires the word "for" — "next 3 days" alone (no "for") reads as a
// one-time multi-day SPAN (e.g. "trip next 3 days"), not a repeating
// schedule, so it must NOT trigger recurrence. Only "days" is safe to
// infer this way; "for the next 2 weeks" alone is genuinely ambiguous
// between daily and weekly intent, so it's left undetected rather than
// guessed at.
const STANDALONE_DAILY_UNTIL_PATTERN = /\bfor the next (\d+)\s*days?\b/i

// Rough day-counts for month/year, matching how the backend already
// treats 'until' as a plain calendar date with no special month-length
// handling (see backend/index.php's occurrence expansion).
const APPROX_DAYS_PER_UNIT = { day: 1, week: 7, month: 30, year: 365 }

function computeUntilDate(now, amount, unit) {
  const count = amount ? parseInt(amount, 10) : 1
  const days = count * (APPROX_DAYS_PER_UNIT[unit] || 1)
  const until = new Date(now.getTime())
  until.setDate(until.getDate() + days)
  return until
}

/**
 * Parses free-text input into a draft event object.
 * Never throws — always returns a best-effort draft, even if nothing
 * date/time-like was found or chrono returns an unusable result.
 *
 * @param {string} rawText
 * @returns {{
 *   name: string,
 *   startTime: Date,
 *   endTime: Date | null,
 *   recurrence: { type: string, interval: number, byDay?: string, until?: string } | null,
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

  // 1. Recurrence keyword (interval/every-other/byDay variants), removed
  // from the text so it doesn't confuse chrono-node or linger in the name.
  let recurrence = null
  for (const { regex, build } of RECURRENCE_PATTERNS) {
    const match = text.match(regex)
    if (match) {
      recurrence = build(match)
      text = (text.slice(0, match.index) + text.slice(match.index + match[0].length)).trim()
      notes.push(`Detected recurrence: every ${recurrence.interval > 1 ? recurrence.interval + ' ' : ''}${recurrence.type.replace('ly', recurrence.interval > 1 ? '(s)' : '')}${recurrence.byDay ? ' on ' + recurrence.byDay : ''}`)
      break
    }
  }

  // 2a. If recurrence was already found above, look for an end-condition
  // modifier like "for the next 2 weeks" and convert it into an until date.
  if (recurrence) {
    const untilMatch = text.match(UNTIL_DURATION_PATTERN)
    if (untilMatch) {
      const untilDate = computeUntilDate(new Date(), untilMatch[1], untilMatch[2].toLowerCase())
      recurrence.until = untilDate.toISOString().slice(0, 10)
      text = (text.slice(0, untilMatch.index) + text.slice(untilMatch.index + untilMatch[0].length)).trim()
      notes.push(`Recurrence ends: ${recurrence.until}`)
    }
  } else {
    // 2b. No "every X" keyword found at all — check the narrow fallback:
    // "for the next N days" (word "for" required) implies daily
    // recurrence ending after N days, e.g. "take medicine for the next
    // 5 days". Deliberately does NOT fire on "next 3 days" without "for"
    // (that reads as a one-time span, e.g. "trip next 3 days").
    const standaloneMatch = text.match(STANDALONE_DAILY_UNTIL_PATTERN)
    if (standaloneMatch) {
      const untilDate = computeUntilDate(new Date(), standaloneMatch[1], 'day')
      recurrence = { type: 'daily', interval: 1, until: untilDate.toISOString().slice(0, 10) }
      text = (text.slice(0, standaloneMatch.index) + text.slice(standaloneMatch.index + standaloneMatch[0].length)).trim()
      notes.push(`Detected recurrence: daily, ending ${recurrence.until}`)
    }
  }

  // 3. Run chrono-node on what's left to find date/time. Wrapped
  // defensively — under-specified phrases (e.g. a bare weekday with no
  // actual time) have been observed to produce results where
  // best.start.date() can throw, which previously crashed the app.
  let startTime = new Date()
  let endTime = null
  let nameText = text

  try {
    const results = chrono.parse(text, new Date(), { forwardDate: true })

    if (results.length > 0) {
      const best = results[0]
      const parsedStart = best.start && typeof best.start.date === 'function' ? best.start.date() : null
      if (parsedStart && !Number.isNaN(parsedStart.getTime())) {
        startTime = parsedStart
        if (best.end && typeof best.end.date === 'function') {
          const parsedEnd = best.end.date()
          if (parsedEnd && !Number.isNaN(parsedEnd.getTime())) {
            endTime = parsedEnd
          }
        }
        nameText = (text.slice(0, best.index) + text.slice(best.index + best.text.length)).trim()
        notes.push(`Detected time: "${best.text}"`)
      } else {
        notes.push('Date/time was ambiguous — defaulted to now, please set manually.')
      }
    } else {
      notes.push('No date/time found — defaulted to now, please set manually.')
    }
  } catch (err) {
    notes.push('Could not parse a date/time — defaulted to now, please set manually.')
  }

  // 4. Clean up leftover filler words/punctuation from the name.
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
