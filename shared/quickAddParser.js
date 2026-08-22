import * as chrono from 'chrono-node'

const UNIT_TO_FREQUENCY = {
  day: 'daily',
  week: 'weekly',
  month: 'monthly',
  year: 'yearly'
}

const RECURRENCE_PATTERNS = [
  {
    regex: /\bevery other (day|week|month|year)\b/i,
    build: (m) => ({ type: UNIT_TO_FREQUENCY[m[1].toLowerCase()], interval: 2 })
  },
  {
    regex: /\bevery (\d+) (day|week|month|year)s?\b/i,
    build: (m) => ({ type: UNIT_TO_FREQUENCY[m[2].toLowerCase()], interval: Math.max(1, parseInt(m[1], 10)) })
  },
  {
    regex: /\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    build: (m) => ({ type: 'weekly', interval: 1, byDay: m[1].toLowerCase() })
  },
  { regex: /\bevery\s+day\b|\bdaily\b/i, build: () => ({ type: 'daily', interval: 1 }) },
  { regex: /\bevery\s+week\b|\bweekly\b/i, build: () => ({ type: 'weekly', interval: 1 }) },
  { regex: /\bevery\s+month\b|\bmonthly\b/i, build: () => ({ type: 'monthly', interval: 1 }) },
  { regex: /\bevery\s+year\b|\bannually\b|\byearly\b/i, build: () => ({ type: 'yearly', interval: 1 }) }
]

const UNTIL_DURATION_PATTERN = /\bfor the next (\d+)?\s*(day|week|month|year)s?\b/i
const STANDALONE_DAILY_UNTIL_PATTERN = /\bfor the next (\d+)\s*days?\b/i
const APPROX_DAYS_PER_UNIT = { day: 1, week: 7, month: 30, year: 365 }

const RELATIVE_REMINDER_PATTERN = /\b(?:remind me|notify me)\s+(\d+(?:\.\d+)?)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?|days?|weeks?|months?|years?)\s+before(?:\s+(?:the\s+)?(start|end|event)|\s+it\s+(starts|ends|ending|finishes))?\b/gi
const ABSOLUTE_REMINDER_PATTERN = /\b(?:remind me|notify me)\s+(?:at|on)\s+(.+?)(?=$|[,.;]|\b(?:every|daily|weekly|monthly|yearly|for the next)\b)/gi

const REMINDER_UNITS = {
  min: { unit: 'minutes', minutesPerUnit: 1 },
  mins: { unit: 'minutes', minutesPerUnit: 1 },
  minute: { unit: 'minutes', minutesPerUnit: 1 },
  minutes: { unit: 'minutes', minutesPerUnit: 1 },
  hr: { unit: 'hours', minutesPerUnit: 60 },
  hrs: { unit: 'hours', minutesPerUnit: 60 },
  hour: { unit: 'hours', minutesPerUnit: 60 },
  hours: { unit: 'hours', minutesPerUnit: 60 },
  day: { unit: 'days', minutesPerUnit: 24 * 60 },
  days: { unit: 'days', minutesPerUnit: 24 * 60 },
  week: { unit: 'weeks', minutesPerUnit: 7 * 24 * 60 },
  weeks: { unit: 'weeks', minutesPerUnit: 7 * 24 * 60 },
  month: { unit: 'months', minutesPerUnit: 30 * 24 * 60 },
  months: { unit: 'months', minutesPerUnit: 30 * 24 * 60 }
}

function computeUntilDate(now, amount, unit) {
  const count = amount ? parseInt(amount, 10) : 1
  const days = count * (APPROX_DAYS_PER_UNIT[unit] || 1)
  const until = new Date(now.getTime())
  until.setDate(until.getDate() + days)
  return until
}

function normalizeReminderAnchor(explicitAnchor, pronounAnchor) {
  const value = (explicitAnchor || pronounAnchor || '').toLowerCase()
  return ['end', 'ends', 'ending', 'finishes'].includes(value) ? 'end' : 'start'
}

function extractReminders(text, now, notes) {
  const reminders = []
  let remainingText = text

  remainingText = remainingText.replace(RELATIVE_REMINDER_PATTERN, (match, rawAmount, rawUnit, explicitAnchor, pronounAnchor) => {
    const amount = parseFloat(rawAmount)
    const unitKey = rawUnit.toLowerCase()

    if (/^(seconds?|secs?)$/.test(unitKey)) {
      notes.push(`Reminder “${rawAmount} ${rawUnit} before” was not added because seconds are not supported. Use minutes or set a custom reminder time.`)
      return ' '
    }

    if (/^years?$/.test(unitKey)) {
      notes.push(`Reminder “${rawAmount} ${rawUnit} before” was not added because years are not supported. Use months, weeks, days, or a custom reminder time.`)
      return ' '
    }

    const unit = REMINDER_UNITS[unitKey]
    if (!unit || !Number.isFinite(amount) || amount <= 0) {
      notes.push(`Reminder “${match.trim()}” was not added because its amount or unit could not be understood. Please add it manually.`)
      return ' '
    }

    const anchor = normalizeReminderAnchor(explicitAnchor, pronounAnchor)

    reminders.push({
      kind: 'relative',
      anchor,
      amount,
      unit: unit.unit,
      offsetMinutes: amount * unit.minutesPerUnit
    })

    notes.push(
      `Detected reminder: ${amount} ${unit.unit} before ${anchor === 'end' ? 'end' : 'start'}.`
    )
    return ' '
  })

  remainingText = remainingText.replace(ABSOLUTE_REMINDER_PATTERN, (match, rawDateText) => {
    const dateText = rawDateText.trim()
    if (!dateText) {
      notes.push('A reminder time was not understood. Please add it manually.')
      return ' '
    }

    try {
      const results = chrono.parse(dateText, now, { forwardDate: true })
      const best = results[0]
      const date = best?.start?.date?.()
      if (!date || Number.isNaN(date.getTime()) || date.getTime() <= now.getTime()) {
        notes.push(`Reminder “${match.trim()}” was not added because its date/time is ambiguous or in the past. Please add it manually.`)
      } else {
        reminders.push({ kind: 'absolute', remindAt: date.toISOString() })
        notes.push(`Detected reminder: ${date.toLocaleString()}.`)
      }
    } catch (err) {
      notes.push(`Reminder “${match.trim()}” was not added because its date/time could not be parsed. Please add it manually.`)
    }
    return ' '
  })

  return { reminders, remainingText }
}

export function parseQuickAddText(rawText) {
  const notes = []
  let text = (rawText || '').trim()

  if (!text) {
    return {
      name: '',
      startTime: new Date(),
      endTime: null,
      recurrence: null,
      reminders: [],
      parseNotes: ['No text entered — fill in details manually.']
    }
  }

  const reminderResult = extractReminders(text, new Date(), notes)
  const reminders = reminderResult.reminders
  text = reminderResult.remainingText

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

  if (recurrence) {
    const untilMatch = text.match(UNTIL_DURATION_PATTERN)
    if (untilMatch) {
      const untilDate = computeUntilDate(new Date(), untilMatch[1], untilMatch[2].toLowerCase())
      recurrence.until = untilDate.toISOString().slice(0, 10)
      text = (text.slice(0, untilMatch.index) + text.slice(untilMatch.index + untilMatch[0].length)).trim()
      notes.push(`Recurrence ends: ${recurrence.until}`)
    }
  } else {
    const standaloneMatch = text.match(STANDALONE_DAILY_UNTIL_PATTERN)
    if (standaloneMatch) {
      const untilDate = computeUntilDate(new Date(), standaloneMatch[1], 'day')
      recurrence = { type: 'daily', interval: 1, until: untilDate.toISOString().slice(0, 10) }
      text = (text.slice(0, standaloneMatch.index) + text.slice(standaloneMatch.index + standaloneMatch[0].length)).trim()
      notes.push(`Detected recurrence: daily, ending ${recurrence.until}`)
    }
  }

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
          if (parsedEnd && !Number.isNaN(parsedEnd.getTime())) endTime = parsedEnd
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

  nameText = nameText
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,.\-–:]+|[\s,.\-–:]+$/g, '')
    .trim()

  if (!nameText) {
    nameText = 'Untitled event'
    notes.push('Could not isolate an event name — please edit.')
  }

  return { name: nameText, startTime, endTime, recurrence, reminders, parseNotes: notes }
}
