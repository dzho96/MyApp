const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'http://localhost:8000'

export async function fetchEventTasks(eventId) {
  const res = await fetch(`${API_BASE}/api/events/${eventId}/tasks`)
  if (!res.ok) throw new Error('Failed to fetch tasks')
  const data = await res.json()
  return data.tasks || []
}

export async function createEventTask(eventId, payload) {
  const res = await fetch(`${API_BASE}/api/events/${eventId}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error('Failed to create task')
  return res.json()
}

export async function updateEventTask(eventId, taskId, payload) {
  const res = await fetch(`${API_BASE}/api/events/${eventId}/tasks/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error('Failed to update task')
  return res.json()
}

export async function deleteEventTask(eventId, taskId) {
  const res = await fetch(`${API_BASE}/api/events/${eventId}/tasks/${taskId}`, {
    method: 'DELETE'
  })
  if (!res.ok) throw new Error('Failed to delete task')
  return res.json()
}
