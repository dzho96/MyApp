import React, { useEffect, useMemo, useState } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import { fetchEvents, createEvent, updateEvent, deleteEvent } from './api'

const CATEGORIES = ['personal', 'work', 'games']

const sampleEvents = [
  { id: 1, name: 'Team sync', description: 'Review project plan', category: 'work', start_time: new Date(new Date().setHours(9, 0, 0, 0)).toISOString(), end_time: new Date(new Date().setHours(10, 0, 0, 0)).toISOString(), requires_action: false, completed: false },
  { id: 2, name: 'Assignment deadline', description: 'Submit coursework', category: 'work', start_time: new Date(new Date().setHours(17, 0, 0, 0)).toISOString(), end_time: new Date(new Date().setHours(17, 30, 0, 0)).toISOString(), requires_action: true, completed: false },
  { id: 3, name: 'Genshin weekly reset', description: 'Daily/weekly reset', category: 'games', start_time: new Date(new Date().setDate(new Date().getDate() + 2)).toISOString(), end_time: new Date(new Date().setDate(new Date().getDate() + 2 + 1)).toISOString(), requires_action: false, completed: false },
  { id: 4, name: 'Doctor appointment', description: 'Health checkup', category: 'personal', start_time: new Date(new Date().setDate(new Date().getDate() + 5)).toISOString(), end_time: new Date(new Date().setDate(new Date().getDate() + 5)).toISOString(), requires_action: true, completed: false }
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
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(dateString))
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

function getDueTime(event) {
  if (event.end_time) return new Date(event.end_time)
  if (event.start_time) return new Date(event.start_time)
  return null
}

function isOverdue(event, now) {
  if (!event.requires_action || event.completed) return false
  const due = getDueTime(event)
  if (!due) return false
  return due.getTime() < now.getTime()
}

function isDueToday(event, now) {
  if (!event.requires_action || event.completed) return false
  const due = getDueTime(event)
  if (!due) return false
  return due.getTime() >= now.getTime() && startOfDay(due).getTime() === startOfDay(now).getTime()
}

function isUpcoming(event, now) {
  if (!event.requires_action || event.completed) return false
  const due = getDueTime(event)
  if (!due) return false
  return due.getTime() >= now.getTime() && startOfDay(due).getTime() > startOfDay(now).getTime()
}

// Active Events: anything currently visible/ongoing, including informational
// time-range events (e.g. a Genshin banner) that are not actionable and so
// never appear in the Overdue/Today/Upcoming lanes.
function isActiveEvent(event, now) {
  if (event.completed) return false
  const start = event.start_time ? new Date(event.start_time) : null
  const end = event.end_time ? new Date(event.end_time) : null
  if (start && end) return start.getTime() <= now.getTime() && now.getTime() <= end.getTime()
  if (start && !end) return startOfDay(start).getTime() >= startOfDay(now).getTime()
  if (!start && end) return now.getTime() <= end.getTime()
  return false
}

function getDashboardLanes(eventsList, now) {
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

function categoryColor(category) {
  if (category === 'work') return '#dbeafe'
  if (category === 'personal') return '#fce7f3'
  if (category === 'games') return '#fef3c7'
  return '#e2e8f0'
}

// ---------- Shared data/event hook ----------

function useEventsData() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchEvents()
      .then((list) => {
        const data = list && list.length > 0 ? list : sampleEvents
        setEvents(data)
      })
      .catch(() => setEvents(sampleEvents))
      .finally(() => setLoading(false))
  }, [])

  async function refreshEvents() {
    const updated = await fetchEvents()
    setEvents(updated.length ? updated : sampleEvents)
  }

  async function handleToggleCompleted(event) {
    await updateEvent(event.id, {
      name: event.name,
      description: event.description || null,
      start_time: event.start_time || null,
      end_time: event.end_time || null,
      category: event.category || null,
      requires_action: !!event.requires_action,
      completed: !event.completed
    })
    await refreshEvents()
  }

  return { events, loading, refreshEvents, handleToggleCompleted }
}

// ---------- Top navigation ----------

function TopNav({ onAddEvent }) {
  const linkStyle = ({ isActive }) => ({
    padding: '8px 14px',
    borderRadius: 8,
    textDecoration: 'none',
    fontWeight: 600,
    color: isActive ? '#fff' : '#0f172a',
    background: isActive ? '#1d4ed8' : 'transparent'
  })
  return (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Schedule</h1>
        <nav style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <NavLink to="/" end style={linkStyle}>Dashboard</NavLink>
          <NavLink to="/calendar" style={linkStyle}>Calendar</NavLink>
        </nav>
      </div>
      <button type="button" onClick={onAddEvent} style={{ padding: '10px 16px', background: '#1d4ed8', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
        + Add Event
      </button>
    </header>
  )
}

// ---------- Add/Edit Event modal ----------

function EventModal({ mode, initialEvent, onClose, onSaved, onDeleted }) {
  const [name, setName] = useState(initialEvent?.name || '')
  const [description, setDescription] = useState(initialEvent?.description || '')
  const [startTime, setStartTime] = useState(initialEvent?.start_time ? new Date(initialEvent.start_time).toISOString().slice(0, 16) : '')
  const [endTime, setEndTime] = useState(initialEvent?.end_time ? new Date(initialEvent.end_time).toISOString().slice(0, 16) : '')
  const [category, setCategory] = useState(initialEvent?.category || '')
  const [requiresAction, setRequiresAction] = useState(!!initialEvent?.requires_action)
  const [completed, setCompleted] = useState(!!initialEvent?.completed)

  async function handleSubmit(e) {
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
      category: category || null,
      requires_action: requiresAction,
      completed
    }
    try {
      if (mode === 'edit' && initialEvent) {
        await updateEvent(initialEvent.id, payload)
      } else {
        await createEvent(payload)
      }
      await onSaved()
      onClose()
    } catch (err) {
      console.error(err)
      alert('Save failed')
    }
  }

  async function handleDelete() {
    if (!initialEvent) return
    try {
      await deleteEvent(initialEvent.id)
      await onDeleted()
      onClose()
    } catch (err) {
      console.error(err)
      alert('Delete failed')
    }
  }

  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 20, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>{mode === 'edit' ? 'Edit event' : 'Add event'}</h3>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Event name" style={{ padding: 10, borderRadius: 8, border: '1px solid #cbd5e1' }} />
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #cbd5e1' }}>
            <option value="">Select category</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #cbd5e1' }} />
          <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #cbd5e1' }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#334155' }}>
            <input type="checkbox" checked={requiresAction} onChange={(e) => setRequiresAction(e.target.checked)} />
            Requires action
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#334155' }}>
            <input type="checkbox" checked={completed} onChange={(e) => setCompleted(e.target.checked)} />
            Completed
          </label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" style={{ minHeight: 80, padding: 10, borderRadius: 8, border: '1px solid #cbd5e1' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="submit" style={{ flex: 1, padding: '10px 16px', border: 'none', borderRadius: 8, background: '#0f172a', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Save</button>
            {mode === 'edit' && (
              <button type="button" onClick={handleDelete} style={{ flex: 1, padding: '10px 16px', border: 'none', borderRadius: 8, background: '#dc2626', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Delete</button>
            )}
            <button type="button" onClick={onClose} style={{ padding: '10px 16px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------- Collapsible dashboard section ----------

function LaneSection({ title, items, tone, emptyText, defaultOpen, onEdit, onToggleCompleted, previewCount = 4 }) {
  const [open, setOpen] = useState(defaultOpen && items.length > 0)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    setOpen(defaultOpen && items.length > 0)
  }, [items.length, defaultOpen])

  const toneStyles = {
    danger: { border: '#fecaca', headerColor: '#b91c1c', badgeBg: '#fee2e2' },
    neutral: { border: '#e2e8f0', headerColor: '#0f172a', badgeBg: '#f1f5f9' },
    muted: { border: '#e2e8f0', headerColor: '#334155', badgeBg: '#f1f5f9' }
  }[tone] || { border: '#e2e8f0', headerColor: '#0f172a', badgeBg: '#f1f5f9' }

  const visibleItems = showAll ? items : items.slice(0, previewCount)

  return (
    <section style={{ background: '#fff', border: `1px solid ${toneStyles.border}`, borderRadius: 12, marginBottom: 14, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <span style={{ fontWeight: 700, fontSize: 16, color: toneStyles.headerColor }}>{title}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ background: toneStyles.badgeBg, color: toneStyles.headerColor, borderRadius: 999, padding: '2px 10px', fontSize: 13, fontWeight: 700 }}>{items.length}</span>
          <span style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', color: '#64748b' }}>&#9660;</span>
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 16px 16px' }}>
          {items.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: 13 }}>{emptyText}</div>
          ) : (
            <>
              {visibleItems.map((event) => (
                <div key={event.id} style={{ background: '#f8fafc', borderRadius: 8, padding: 10, marginBottom: 8, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                  <button type="button" onClick={() => onEdit(event)} style={{ background: 'transparent', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{event.name}</div>
                    <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                      <span style={{ background: categoryColor(event.category), borderRadius: 6, padding: '2px 6px', marginRight: 6 }}>{event.category || 'uncategorized'}</span>
                      {formatDateTime(event.end_time || event.start_time)}
                    </div>
                  </button>
                  {event.requires_action && (
                    <button
                      type="button"
                      onClick={() => onToggleCompleted(event)}
                      style={{ border: '1px solid #cbd5e1', borderRadius: 6, background: event.completed ? '#0f172a' : '#fff', color: event.completed ? '#fff' : '#0f172a', padding: '4px 8px', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}
                    >
                      {event.completed ? 'Done' : 'Mark done'}
                    </button>
                  )}
                </div>
              ))}
              {items.length > previewCount && (
                <button type="button" onClick={() => setShowAll((prev) => !prev)} style={{ border: 'none', background: 'transparent', color: '#1d4ed8', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0 }}>
                  {showAll ? 'Show less' : `View all ${items.length}`}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}

// ---------- Dashboard page ----------

function DashboardPage({ events, loading, onEdit, onToggleCompleted }) {
  const now = useMemo(() => new Date(), [events])
  const lanes = useMemo(() => getDashboardLanes(events, now), [events, now])

  if (loading) return <div>Loading dashboard...</div>

  return (
    <div>
      <LaneSection
        title="Overdue"
        items={lanes.overdue}
        tone="danger"
        emptyText="Nothing overdue"
        defaultOpen
        onEdit={onEdit}
        onToggleCompleted={onToggleCompleted}
      />
      <LaneSection
        title="Today"
        items={lanes.today}
        tone="neutral"
        emptyText="Nothing due today"
        defaultOpen
        onEdit={onEdit}
        onToggleCompleted={onToggleCompleted}
      />
      <LaneSection
        title="Upcoming"
        items={lanes.upcoming}
        tone="neutral"
        emptyText="Nothing upcoming"
        defaultOpen={false}
        onEdit={onEdit}
        onToggleCompleted={onToggleCompleted}
      />
      <LaneSection
        title="Active Events"
        items={lanes.active}
        tone="muted"
        emptyText="No active events"
        defaultOpen={false}
        onEdit={onEdit}
        onToggleCompleted={onToggleCompleted}
      />
    </div>
  )
}

// ---------- Calendar page ----------

function CalendarPage({ events, loading, onEdit }) {
  const [view, setView] = useState('month')
  const [selectedDate, setSelectedDate] = useState(new Date())

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
          <button key={date.toISOString()} onClick={() => setSelectedDate(date)} type="button" style={{ minHeight: 120, border: isSelected ? '2px solid #3b82f6' : '1px solid #e2e8f0', background: isCurrentMonth ? '#fff' : '#f8fafc', borderRadius: 10, padding: 8, textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontWeight: 700, color: isCurrentMonth ? '#0f172a' : '#94a3b8' }}>{formatDayNumber(date)}</span>
            {dayEvents.slice(0, 2).map((event) => (
              <span key={event.id} style={{ display: 'block', background: categoryColor(event.category), color: '#0f172a', borderRadius: 6, fontSize: 11, padding: '2px 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{event.name}</span>
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
            {dayEvents.length === 0 ? <div style={{ color: '#94a3b8', fontSize: 12 }}>No events</div> : dayEvents.map((event) => (
              <button key={event.id} type="button" onClick={() => onEdit(event)} style={{ display: 'block', width: '100%', textAlign: 'left', background: '#f8fafc', borderRadius: 8, padding: 8, marginBottom: 8, border: 'none', cursor: 'pointer' }}>
                <div style={{ fontWeight: 700 }}>{event.name}</div>
                <div style={{ fontSize: 12, color: '#475569' }}>{event.category}</div>
                <div style={{ fontSize: 12, color: '#475569' }}>{formatDateTime(event.start_time)}</div>
              </button>
            ))}
          </div>
        )
      })}
    </div>
  )

  const renderDayView = () => (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>
        {new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(selectedDate)}
      </div>
      {selectedDayEvents.length === 0 ? <div style={{ color: '#64748b' }}>No events scheduled for this day.</div> : selectedDayEvents.map((event) => (
        <button key={event.id} type="button" onClick={() => onEdit(event)} style={{ display: 'block', width: '100%', textAlign: 'left', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, marginBottom: 10, background: '#fff', cursor: 'pointer' }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{event.name}</div>
          <div style={{ color: '#475569', fontSize: 13 }}>{formatDateTime(event.start_time)} to {event.end_time ? formatDateTime(event.end_time) : 'End time not set'}</div>
          {event.description && <div style={{ marginTop: 8, color: '#475569' }}>{event.description}</div>}
        </button>
      ))}
    </div>
  )

  return (
    <div>
      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => (view === 'month' ? changeMonth(-1) : view === 'week' ? changeWeek(-1) : changeDay(-1))} style={{ border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', padding: '8px 12px', cursor: 'pointer' }}>Prev</button>
            <strong style={{ fontSize: 18 }}>
              {view === 'month' ? formatMonth(selectedDate) : view === 'week' ? `Week of ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(weekDates[0])}` : new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(selectedDate)}
            </strong>
            <button type="button" onClick={() => (view === 'month' ? changeMonth(1) : view === 'week' ? changeWeek(1) : changeDay(1))} style={{ border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', padding: '8px 12px', cursor: 'pointer' }}>Next</button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['day', 'week', 'month'].map((option) => (
              <button key={option} type="button" onClick={() => setView(option)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: view === option ? '#1d4ed8' : '#fff', color: view === option ? '#fff' : '#0f172a', cursor: 'pointer', textTransform: 'capitalize' }}>{option}</button>
            ))}
          </div>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2.2fr) minmax(260px, 0.8fr)', gap: 20 }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
          {loading ? <div>Loading schedule...</div> : (view === 'day' ? renderDayView() : view === 'week' ? renderWeekView() : renderMonthView())}
        </div>

        <aside style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>{new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(selectedDate)}</h3>
          {selectedDayEvents.length === 0 ? <div style={{ color: '#64748b' }}>No events for this date.</div> : selectedDayEvents.map((event) => (
            <button key={event.id} type="button" onClick={() => onEdit(event)} style={{ width: '100%', border: '1px solid #dbeafe', background: '#fff', borderRadius: 8, padding: '10px 12px', marginBottom: 10, textAlign: 'left', cursor: 'pointer' }}>
              <div style={{ fontWeight: 700 }}>{event.name}</div>
              <div style={{ fontSize: 12, color: '#475569' }}>{event.category}</div>
              <div style={{ fontSize: 12, color: '#475569' }}>{formatDateTime(event.start_time)}</div>
            </button>
          ))}

          <div style={{ marginTop: 18 }}>
            <h4 style={{ marginBottom: 8 }}>This month</h4>
            {monthEvents.length === 0 ? <div style={{ color: '#64748b' }}>No events in this month.</div> : monthEvents.slice(0, 6).map((event) => (
              <div key={event.id} style={{ fontSize: 13, marginBottom: 8 }}>
                <strong>{event.name}</strong>
                <div style={{ color: '#475569' }}>{formatDateTime(event.start_time)}</div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}

// ---------- App root ----------

export default function App() {
  const { events, loading, refreshEvents, handleToggleCompleted } = useEventsData()
  const [modalState, setModalState] = useState(null) // null | { mode: 'add' | 'edit', event? }

  function openAddModal() {
    setModalState({ mode: 'add' })
  }

  function openEditModal(event) {
    setModalState({ mode: 'edit', event })
  }

  function closeModal() {
    setModalState(null)
  }

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif', background: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <TopNav onAddEvent={openAddModal} />

        <Routes>
          <Route path="/" element={<DashboardPage events={events} loading={loading} onEdit={openEditModal} onToggleCompleted={handleToggleCompleted} />} />
          <Route path="/calendar" element={<CalendarPage events={events} loading={loading} onEdit={openEditModal} />} />
        </Routes>

        {modalState && (
          <EventModal
            mode={modalState.mode}
            initialEvent={modalState.event}
            onClose={closeModal}
            onSaved={refreshEvents}
            onDeleted={refreshEvents}
          />
        )}
      </div>
    </div>
  )
}
