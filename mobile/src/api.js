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
