const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

export async function fetchEvents() {
  const res = await fetch(`${API_BASE}/api/events`);
  if (!res.ok) throw new Error('Failed to fetch events');
  const data = await res.json();
  return data.events || [];
}

export async function createEvent(payload) {
  const res = await fetch(`${API_BASE}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Create failed');
  return res.json();
}

export async function updateEvent(id, payload) {
  const res = await fetch(`${API_BASE}/api/events/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Update failed');
  return res.json();
}

export async function deleteEvent(id) {
  const res = await fetch(`${API_BASE}/api/events/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Delete failed');
  return res.json();
}
