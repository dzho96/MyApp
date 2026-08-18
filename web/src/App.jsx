import React, { useEffect, useMemo, useState } from 'react'
import { fetchEvents, createEvent, updateEvent, deleteEvent } from './api'

const sampleEvents = [
  {
    id: 1,
    name: 'Team sync',
    description: 'Review project plan',
    category: 'work',
    start_time: new Date(new Date().setHours(9, 0, 0, 0)).toISOString(),
    end_time: new Date(new Date().setHours(10, 0, 0, 0)).toISOString()
  },
  {
    id: 2,
    name: 'Assignment deadline',
    description: 'Submit coursework',
    category: 'school',
    start_time: new Date(new Date().setHours(17, 0, 0, 0)).toISOString(),
    end_time: new Date(new Date().setHours(17, 30, 0, 0)).toISOString()
  },
  {
    id: 3,
    name: 'Genshin weekly reset',
    description: 'Daily/weekly reset',
    category: 'game',
    start_time: new Date(new Date().setDate(new Date().getDate() + 2)).toISOString(),
    end_time: new Date(new Date().setDate(new Date().getDate() + 2 + 1)).toISOString()
  },
  {
    id: 4,
    name: 'Doctor appointment',
    description: 'Health checkup',
    category: 'personal',
    start_time: new Date(new Date().setDate(new Date().getDate() + 5)).toISOString(),
    end_time: new Date(new Date().setDate(new Date().getDate() + 5)).toISOString()
  }
]

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date, amount) {
  const d = new Date(date)
  d.setDate(d.getDate() + amount)
  return d
}

function startOfWeek(date) {
  const d = startOfDay(date)
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1 - day)
  d.setDate(d.getDate() + diff)
  return d
}

function formatMonth(date) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date)
}

function formatShortDay(date) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date)
}

function formatDayNumber(date) {
  return new Intl.DateTimeFormat('en-US', { day: 'numeric' }).format(date)
}

function formatDateTime(dateString) {
  if (!dateString) return 'No date'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(dateString))
}

function eventMatchesDate(event, date) {
  if (!event.start_time) return false
  const eventDate = new Date(event.start_time)
  return startOfDay(eventDate).getTime() === startOfDay(date).getTime()
}

function getVisibleDayEvents(eventsList, selectedDate) {
  return [...eventsList].filter((event) => eventMatchesDate(event, selectedDate)).sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
}

function getWeekDates(anchorDate) {
  const start = startOfWeek(anchorDate)
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

function getMonthGrid(anchorDate) {
  const first = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1)
  const start = startOfWeek(first)
  return Array.from({ length: 42 }, (_, index) => addDays(start, index))
}

function getMonthEvents(eventsList, anchorDate) {
  const monthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1)
  const monthEnd = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0)
  return eventsList.filter((event) => {
    if (!event.start_time) return false
    const date = new Date(event.start_time)
    return date >= monthStart && date <= monthEnd
  })
}

export default function App() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('month')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [category, setCategory] = useState('')

  useEffect(() => {
    fetchEvents()
      .then((list) => {
        const data = list && list.length > 0 ? list : sampleEvents
        setEvents(data)
      })
      .catch(() => setEvents(sampleEvents))
      .finally(() => setLoading(false))
  }, [])

  const monthEvents = useMemo(() => getMonthEvents(events, selectedDate), [events, selectedDate])
  const selectedDayEvents = useMemo(() => getVisibleDayEvents(events, selectedDate), [events, selectedDate])
  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate])
  const monthGrid = useMemo(() => getMonthGrid(selectedDate), [selectedDate])

  function changeMonth(offset) {
    const next = new Date(selectedDate)
    next.setMonth(next.getMonth() + offset)
    setSelectedDate(next)
  }

  function changeWeek(offset) {
    const next = new Date(selectedDate)
    next.setDate(next.getDate() + offset * 7)
    setSelectedDate(next)
  }

  function changeDay(offset) {
    const next = addDays(selectedDate, offset)
    setSelectedDate(next)
  }

  async function refreshEvents() {
    const updated = await fetchEvents()
    setEvents(updated.length ? updated : sampleEvents)
  }

  async function handleCreate(e) {
    e.preventDefault()
    const errors = []
    if (!name) errors.push('Name is required')
    if (startTime && endTime && new Date(startTime) > new Date(endTime)) errors.push('Start time must be before end time')
    if (errors.length) {
      alert(errors.join('\n'))
      return
    }

    const payload = {
      name,
      description: description || null,
      start_time: startTime ? new Date(startTime).toISOString() : null,
      end_time: endTime ? new Date(endTime).toISOString() : null,
      category: category || null
    }

    try {
      await createEvent(payload)
      await refreshEvents()
      setShowQuickAdd(false)
      setName('')
      setDescription('')
      setStartTime('')
      setEndTime('')
      setCategory('')
    } catch (err) {
      console.error(err)
      alert('Create failed')
    }
  }

  async function handleDeleteEvent(id) {
    try {
      await deleteEvent(id)
      setSelectedEvent(null)
      await refreshEvents()
    } catch (err) {
      console.error(err)
      alert('Delete failed')
    }
  }

  async function handleUpdateEvent(e) {
    e.preventDefault()
    if (!selectedEvent) return

    const errors = []
    if (!selectedEvent.name) errors.push('Name is required')
    if (selectedEvent.start_time && selectedEvent.end_time && new Date(selectedEvent.start_time) > new Date(selectedEvent.end_time)) {
      errors.push('Start time must be before end time')
    }
    if (errors.length) {
      alert(errors.join('\n'))
      return
    }

    try {
      await updateEvent(selectedEvent.id, {
        name: selectedEvent.name,
        description: selectedEvent.description || null,
        start_time: selectedEvent.start_time ? new Date(selectedEvent.start_time).toISOString() : null,
        end_time: selectedEvent.end_time ? new Date(selectedEvent.end_time).toISOString() : null,
        category: selectedEvent.category || null
      })
      await refreshEvents()
    } catch (err) {
      console.error(err)
      alert('Update failed')
    }
  }

  const renderMonthView = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8 }}>
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
        <div key={label} style={{ textAlign: 'center', fontWeight: 700, color: '#475569', paddingBottom: 8 }}>{label}</div>
      ))}
      {monthGrid.map((date) => {
        const isCurrentMonth = date.getMonth() === selectedDate.getMonth()
        const isSelected = startOfDay(date).getTime() === startOfDay(selectedDate).getTime()
        const dayEvents = events.filter((event) => eventMatchesDate(event, date))

        return (
          <button
            key={date.toISOString()}
            onClick={() => setSelectedDate(date)}
            type="button"
            style={{
              minHeight: 120,
              border: isSelected ? '2px solid #3b82f6' : '1px solid #e2e8f0',
              background: isCurrentMonth ? '#fff' : '#f8fafc',
              borderRadius: 10,
              padding: 8,
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: 4
            }}
          >
            <span style={{ fontWeight: 700, color: isCurrentMonth ? '#0f172a' : '#94a3b8' }}>{formatDayNumber(date)}</span>
            {dayEvents.slice(0, 2).map((event) => (
              <span
                key={event.id}
                style={{
                  display: 'block',
                  background: event.category === 'work' ? '#dbeafe' : event.category === 'school' ? '#dcfce7' : event.category === 'game' ? '#fef3c7' : '#fce7f3',
                  color: '#0f172a',
                  borderRadius: 6,
                  fontSize: 11,
                  padding: '2px 6px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {event.name}
              </span>
            ))}
            {dayEvents.length > 2 && <span style={{ fontSize: 11, color: '#475569' }}>+{dayEvents.length - 2} more</span>}
          </button>
        )
      })}
    </div>
  )

  const renderWeekView = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8 }}>
      {weekDates.map((date) => {
        const dayEvents = getVisibleDayEvents(events, date)
        const isSelected = startOfDay(date).getTime() === startOfDay(selectedDate).getTime()
        return (
          <div key={date.toISOString()} style={{ border: isSelected ? '2px solid #3b82f6' : '1px solid #e2e8f0', borderRadius: 10, padding: 10, minHeight: 220, background: '#fff' }}>
            <div style={{ textAlign: 'center', marginBottom: 10 }}>
              <div style={{ fontWeight: 700 }}>{formatShortDay(date)}</div>
              <div style={{ color: '#64748b' }}>{formatDayNumber(date)}</div>
            </div>
            {dayEvents.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: 12 }}>No events</div>
            ) : (
              dayEvents.map((event) => (
                <div key={event.id} style={{ background: '#f8fafc', borderRadius: 8, padding: 8, marginBottom: 8 }}>
                  <div style={{ fontWeight: 700 }}>{event.name}</div>
                  <div style={{ fontSize: 12, color: '#475569' }}>{event.category}</div>
                  <div style={{ fontSize: 12, color: '#475569' }}>{formatDateTime(event.start_time)}</div>
                </div>
              ))
            )}
          </div>
        )
      })}
    </div>
  )

  const renderDayView = () => (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>{new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(selectedDate)}</div>
      {selectedDayEvents.length === 0 ? (
        <div style={{ color: '#64748b' }}>No events scheduled for this day.</div>
      ) : (
        selectedDayEvents.map((event) => (
          <div key={event.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, marginBottom: 10 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{event.name}</div>
            <div style={{ color: '#475569', fontSize: 13 }}>{formatDateTime(event.start_time)} to {event.end_time ? formatDateTime(event.end_time) : 'End time not set'}</div>
            {event.description && <div style={{ marginTop: 8, color: '#475569' }}>{event.description}</div>}
          </div>
        ))
      )}
    </div>
  )

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif', background: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0 }}>Schedule</h1>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setShowQuickAdd((prev) => !prev)} style={{ padding: '10px 16px', background: '#1d4ed8', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              {showQuickAdd ? 'Hide Quick Add' : 'Quick Add'}
            </button>
          </div>
        </header>

        {showQuickAdd && (
          <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <h3 style={{ marginTop: 0 }}>Add event</h3>
            <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Event name" style={{ padding: 10, borderRadius: 8, border: '1px solid #cbd5e1' }} />
              <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" style={{ padding: 10, borderRadius: 8, border: '1px solid #cbd5e1' }} />
              <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #cbd5e1' }} />
              <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #cbd5e1' }} />
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" style={{ gridColumn: '1 / -1', minHeight: 80, padding: 10, borderRadius: 8, border: '1px solid #cbd5e1' }} />
              <div style={{ gridColumn: '1 / -1' }}>
                <button type="submit" style={{ padding: '10px 18px', border: 'none', borderRadius: 8, background: '#0f172a', color: '#fff', cursor: 'pointer' }}>Save event</button>
              </div>
            </form>
          </section>
        )}

        <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => view === 'month' ? changeMonth(-1) : view === 'week' ? changeWeek(-1) : changeDay(-1)} style={{ border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', padding: '8px 12px', cursor: 'pointer' }}>Prev</button>
              <strong style={{ fontSize: 18 }}>{view === 'month' ? formatMonth(selectedDate) : view === 'week' ? `${formatMonth(selectedDate)} — Week of ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(weekDates[0])}` : new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(selectedDate)}</strong>
              <button type="button" onClick={() => view === 'month' ? changeMonth(1) : view === 'week' ? changeWeek(1) : changeDay(1)} style={{ border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', padding: '8px 12px', cursor: 'pointer' }}>Next</button>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {['day', 'week', 'month'].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setView(option)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    background: view === option ? '#1d4ed8' : '#fff',
                    color: view === option ? '#fff' : '#0f172a',
                    cursor: 'pointer',
                    textTransform: 'capitalize'
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2.2fr) minmax(260px, 0.8fr)', gap: 20 }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            {loading ? <div>Loading schedule...</div> : view === 'day' ? renderDayView() : view === 'week' ? renderWeekView() : renderMonthView()}
          </div>

          <aside style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>{new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(selectedDate)}</h3>
            {selectedDayEvents.length === 0 ? (
              <div style={{ color: '#64748b' }}>No events for this date.</div>
            ) : (
              selectedDayEvents.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => setSelectedEvent(event)}
                  style={{
                    width: '100%',
                    border: '1px solid #dbeafe',
                    background: selectedEvent && selectedEvent.id === event.id ? '#eff6ff' : '#fff',
                    borderRadius: 8,
                    padding: '10px 12px',
                    marginBottom: 10,
                    textAlign: 'left',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{event.name}</div>
                  <div style={{ fontSize: 12, color: '#475569' }}>{event.category}</div>
                  <div style={{ fontSize: 12, color: '#475569' }}>{formatDateTime(event.start_time)}</div>
                </button>
              ))
            )}

            {selectedEvent && (
              <div style={{ marginTop: 18, borderTop: '1px solid #e2e8f0', paddingTop: 18 }}>
                <h4 style={{ marginTop: 0 }}>Edit selected event</h4>
                <form onSubmit={handleUpdateEvent} style={{ display: 'grid', gap: 8 }}>
                  <input value={selectedEvent.name || ''} onChange={(e) => setSelectedEvent({ ...selectedEvent, name: e.target.value })} placeholder="Event name" style={{ padding: 8, borderRadius: 8, border: '1px solid #cbd5e1' }} />
                  <input value={selectedEvent.category || ''} onChange={(e) => setSelectedEvent({ ...selectedEvent, category: e.target.value })} placeholder="Category" style={{ padding: 8, borderRadius: 8, border: '1px solid #cbd5e1' }} />
                  <input type="datetime-local" value={selectedEvent.start_time ? new Date(selectedEvent.start_time).toISOString().slice(0, 16) : ''} onChange={(e) => setSelectedEvent({ ...selectedEvent, start_time: e.target.value ? new Date(e.target.value).toISOString() : null })} style={{ padding: 8, borderRadius: 8, border: '1px solid #cbd5e1' }} />
                  <input type="datetime-local" value={selectedEvent.end_time ? new Date(selectedEvent.end_time).toISOString().slice(0, 16) : ''} onChange={(e) => setSelectedEvent({ ...selectedEvent, end_time: e.target.value ? new Date(e.target.value).toISOString() : null })} style={{ padding: 8, borderRadius: 8, border: '1px solid #cbd5e1' }} />
                  <textarea value={selectedEvent.description || ''} onChange={(e) => setSelectedEvent({ ...selectedEvent, description: e.target.value })} placeholder="Description" style={{ minHeight: 70, padding: 8, borderRadius: 8, border: '1px solid #cbd5e1' }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" style={{ flex: 1, padding: '8px 12px', border: 'none', borderRadius: 8, background: '#0f172a', color: '#fff', cursor: 'pointer' }}>Save</button>
                    <button type="button" onClick={() => handleDeleteEvent(selectedEvent.id)} style={{ flex: 1, padding: '8px 12px', border: 'none', borderRadius: 8, background: '#dc2626', color: '#fff', cursor: 'pointer' }}>Delete</button>
                  </div>
                </form>
              </div>
            )}

            <div style={{ marginTop: 18 }}>
              <h4 style={{ marginBottom: 8 }}>This month</h4>
              {monthEvents.length === 0 ? (
                <div style={{ color: '#64748b' }}>No events in this month.</div>
              ) : (
                monthEvents.slice(0, 6).map((event) => (
                  <div key={event.id} style={{ fontSize: 13, marginBottom: 8 }}>
                    <strong>{event.name}</strong>
                    <div style={{ color: '#475569' }}>{formatDateTime(event.start_time)}</div>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
