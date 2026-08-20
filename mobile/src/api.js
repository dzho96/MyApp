// API base URL is read from Expo's public env var so it can be configured
// per environment without code changes. On a physical device, "localhost"
// refers to the phone itself, not your dev machine — set this to your
// machine's LAN IP (e.g. http://192.168.1.23:8000) in mobile/.env.
// See docs/SETUP_MOBILE.md for details.
const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'http://localhost:8000'


export async function fetchEvents() {
  const res = await fetch(`${API_BASE}/api/events`)
  if (!res.ok) throw new Error('Failed to fetch events')
  const data = await res.json()
  return data.events || []
}


export async function createEvent(payload) {
  const res = await fetch(`${API_BASE}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error('Failed to create event')
  return res.json()
}


export async function updateEvent(id, payload) {
  const res = await fetch(`${API_BASE}/api/events/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error('Failed to update event')
  return res.json()
}


export async function deleteEvent(id) {
  const res = await fetch(`${API_BASE}/api/events/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete event')
  return res.json()
}


export async function fetchReminders(eventId) {
  const res = await fetch(`${API_BASE}/api/events/${eventId}/reminders`)
  if (!res.ok) throw new Error('Failed to fetch reminders')
  const data = await res.json()
  return data.reminders || []
}


export async function createReminder(eventId, payload) {
  const res = await fetch(`${API_BASE}/api/events/${eventId}/reminders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error('Failed to create reminder')
  return res.json()
}


export async function updateReminder(id, payload) {
  const res = await fetch(`${API_BASE}/api/reminders/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error('Failed to update reminder')
  return res.json()
}


export async function deleteReminder(id) {
  const res = await fetch(`${API_BASE}/api/reminders/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete reminder')
  return res.json()
}


export async function snoozeReminder(id, { minutes, until } = {}) {
  const res = await fetch(`${API_BASE}/api/reminders/${id}/snooze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(minutes ? { minutes } : { until })
  })
  if (!res.ok) throw new Error('Failed to snooze reminder')
  return res.json()
}


export async function fetchAllReminders(events) {
  const results = await Promise.all(
    events.map((event) =>
      fetchReminders(event.id)
        .then((reminders) => reminders.map((r) => ({ ...r, event })))
        .catch(() => [])
    )
  )
  return results.flat()
}


export async function fetchRecurrence(eventId) {
  const res = await fetch(`${API_BASE}/api/events/${eventId}/recurrence`)
  if (!res.ok) throw new Error('Failed to fetch recurrence')
  const data = await res.json()
  return data.recurrence || null
}


export async function setRecurrence(eventId, payload) {
  const res = await fetch(`${API_BASE}/api/events/${eventId}/recurrence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error('Failed to set recurrence')
  return res.json()
}


export async function deleteRecurrence(eventId) {
  const res = await fetch(`${API_BASE}/api/events/${eventId}/recurrence`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete recurrence')
  return res.json()
}


export async function fetchOccurrences(eventId) {
  const res = await fetch(`${API_BASE}/api/events/${eventId}/occurrences`)
  if (!res.ok) throw new Error('Failed to fetch occurrences')
  const data = await res.json()
  return data.occurrences || []
}


// Expands recurring events into virtual occurrence copies for calendar/
// dashboard display. Each virtual occurrence keeps the SAME event id as
// its base event (so tapping any instance opens the one real, editable
// event — no separate "occurrence" entity, no special-casing in
// EventDetailScreen). Non-recurring events pass through unchanged.
//
// occurrenceKey is added for React list keys only (since id is shared
// across all instances of a recurring event) and is NOT sent to the
// backend or used for navigation.
export async function fetchEventsWithOccurrences() {
  const events = await fetchEvents()

  const expansions = await Promise.all(
    events.map(async (event) => {
      let recurrence = null
      try {
        recurrence = await fetchRecurrence(event.id)
      } catch (err) {
        recurrence = null
      }
      if (!recurrence || !recurrence.frequency) {
        return [{ ...event, occurrenceKey: `${event.id}-base`, isRecurringInstance: false }]
      }

      let occurrences = []
      try {
        occurrences = await fetchOccurrences(event.id)
      } catch (err) {
        occurrences = []
      }
      if (occurrences.length === 0) {
        return [{ ...event, occurrenceKey: `${event.id}-base`, isRecurringInstance: false }]
      }

      return occurrences.map((occ, index) => ({
        ...event,
        start_time: occ.start_time,
        end_time: occ.end_time,
        occurrenceKey: `${event.id}-occ-${index}`,
        isRecurringInstance: true,
        occurrenceIndex: index
      }))
    })
  )

  return expansions.flat()
}
