// Shared, framework-agnostic event/dashboard logic used by both the web
// app (web/src/App.jsx) and the mobile app (mobile/src). Pure JavaScript,
// no DOM or React Native dependencies, so it works unmodified on both.

export const CATEGORIES = ['personal', 'work', 'games']

export function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function addDays(date, amount) {
  const d = new Date(date)
  d.setDate(d.getDate() + amount)
  return d
}

export function startOfWeek(date) {
  const d = startOfDay(date)
  d.setDate(d.getDate() - d.getDay())
  return d
}

export function eventMatchesDate(event, date) {
  if (!event.start_time) return false
  const eventDate = new Date(event.start_time)
  return startOfDay(eventDate).getTime() === startOfDay(date).getTime()
}

export function getVisibleDayEvents(eventsList, selectedDate) {
  return [...eventsList]
    .filter((event) => eventMatchesDate(event, selectedDate))
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
}

export function getWeekDates(anchorDate) {
  const start = startOfWeek(anchorDate)
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

export function getMonthGrid(anchorDate) {
  const first = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1)
  const start = startOfWeek(first)
  return Array.from({ length: 42 }, (_, index) => addDays(start, index))
}

export function getMonthEvents(eventsList, anchorDate) {
  const monthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1)
  const monthEnd = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0)
  return eventsList.filter((event) => {
    if (!event.start_time) return false
    const date = new Date(event.start_time)
    return date >= monthStart && date <= monthEnd
  })
}

export function getDueTime(event) {
  if (event.end_time) return new Date(event.end_time)
  if (event.start_time) return new Date(event.start_time)
  return null
}

// An event with sub-tasks is only "done" once every sub-task is complete.
export function isEventComplete(event) {
  if (event.task_count > 0) return event.completed_task_count >= event.task_count
  return !!event.completed
}

export function isOverdue(event, now) {
  if (!event.requires_action || isEventComplete(event)) return false
  const due = getDueTime(event)
  if (!due) return false
  return due.getTime() < now.getTime()
}

export function isDueToday(event, now) {
  if (!event.requires_action || isEventComplete(event)) return false
  const due = getDueTime(event)
  if (!due) return false
  return due.getTime() >= now.getTime() && startOfDay(due).getTime() === startOfDay(now).getTime()
}

export function isUpcoming(event, now) {
  if (!event.requires_action || isEventComplete(event)) return false
  const due = getDueTime(event)
  if (!due) return false
  return due.getTime() >= now.getTime() && startOfDay(due).getTime() > startOfDay(now).getTime()
}

// Active Events: anything currently visible/ongoing, including informational
// time-range events (e.g. a Genshin banner) that are not actionable and so
// never appear in the Overdue/Due Today/Upcoming lanes.
export function isActiveEvent(event, now) {
  if (isEventComplete(event)) return false
  const start = event.start_time ? new Date(event.start_time) : null
  const end = event.end_time ? new Date(event.end_time) : null
  if (start && end) return start.getTime() <= now.getTime() && now.getTime() <= end.getTime()
  if (start && !end) return startOfDay(start).getTime() >= startOfDay(now).getTime()
  if (!start && end) return now.getTime() <= end.getTime()
  return false
}

export function getDashboardLanes(eventsList, now) {
  const overdue = []
  const today = []
  const upcoming = []
  const active = []
  for (const event of eventsList) {
    if (isOverdue(event, now)) overdue.push(event)
    if (isDueToday(event, now)) today.push(event)
    if (isUpcoming(event, now)) upcoming.push(event)
    if (isActiveEvent(event, now)) active.push(event)
  }
  const byDue = (a, b) => (getDueTime(a)?.getTime() ?? 0) - (getDueTime(b)?.getTime() ?? 0)
  const byStart = (a, b) => new Date(a.start_time || 0) - new Date(b.start_time || 0)
  overdue.sort(byDue)
  today.sort(byDue)
  upcoming.sort(byDue)
  active.sort(byStart)
  return { overdue, today, upcoming, active }
}

// Converts a stored UTC ISO string to the local YYYY-MM-DDTHH:mm format
// expected by HTML datetime-local inputs on web. Not needed on mobile
// (native date pickers work with Date objects directly) but kept here
// since it's pure logic that could be reused for display formatting.
export function toLocalInputValue(isoString) {
  if (!isoString) return ''
  const date = new Date(isoString)
  const offsetMs = date.getTimezoneOffset() * 60000
  const local = new Date(date.getTime() - offsetMs)
  return local.toISOString().slice(0, 16)
}

const CATEGORY_COLORS = {
  personal: { light: '#ec4899', dark: '#f472b6' },
  work: { light: '#3b82f6', dark: '#60a5fa' },
  games: { light: '#f59e0b', dark: '#fbbf24' },
  default: { light: '#94a3b8', dark: '#64748b' }
}

export function getCategoryColor(category, mode = 'light') {
  const entry = CATEGORY_COLORS[category] || CATEGORY_COLORS.default
  return entry[mode] || entry.light
}
