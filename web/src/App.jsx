import React, { useEffect, useMemo, useState } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import { fetchEvents, createEvent, updateEvent, deleteEvent } from './api'
import { fetchEventTasks, createEventTask, updateEventTask, deleteEventTask } from './tasksApi'

const CATEGORIES = ['personal', 'work', 'games']

const sampleEvents = [
  { id: 1, name: 'Team sync', description: 'Review project plan', category: 'work', start_time: new Date(new Date().setHours(9, 0, 0, 0)).toISOString(), end_time: new Date(new Date().setHours(10, 0, 0, 0)).toISOString(), requires_action: false, completed: false, task_count: 0, completed_task_count: 0 },
  { id: 2, name: 'Assignment deadline', description: 'Submit coursework', category: 'work', start_time: new Date(new Date().setHours(17, 0, 0, 0)).toISOString(), end_time: new Date(new Date().setHours(17, 30, 0, 0)).toISOString(), requires_action: true, completed: false, task_count: 3, completed_task_count: 1 },
  { id: 3, name: 'Genshin weekly reset', description: 'Daily/weekly reset', category: 'games', start_time: new Date(new Date().setDate(new Date().getDate() + 2)).toISOString(), end_time: new Date(new Date().setDate(new Date().getDate() + 2 + 1)).toISOString(), requires_action: false, completed: false, task_count: 0, completed_task_count: 0 },
  { id: 4, name: 'Doctor appointment', description: 'Health checkup', category: 'personal', start_time: new Date(new Date().setDate(new Date().getDate() + 5)).toISOString(), end_time: new Date(new Date().setDate(new Date().getDate() + 5)).toISOString(), requires_action: true, completed: false, task_count: 0, completed_task_count: 0 }
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

function toLocalInputValue(isoString) {
  if (!isoString) return ''
  const date = new Date(isoString)
  const offsetMs = date.getTimezoneOffset() * 60000
  const local = new Date(date.getTime() - offsetMs)
  return local.toISOString().slice(0, 16)
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

function isEventComplete(event) {
  if (event.task_count > 0) return event.completed_task_count >= event.task_count
  return !!event.completed
}

function isOverdue(event, now) {
  if (!event.requires_action || isEventComplete(event)) return false
  const due = getDueTime(event)
  if (!due) return false
  return due.getTime() < now.getTime()
}

function isDueToday(event, now) {
  if (!event.requires_action || isEventComplete(event)) return false
  const due = getDueTime(event)
  if (!due) return false
  return due.getTime() >= now.getTime() && startOfDay(due).getTime() === startOfDay(now).getTime()
}

function isUpcoming(event, now) {
  if (!event.requires_action || isEventComplete(event)) return false
  const due = getDueTime(event)
  if (!due) return false
  return due.getTime() >= now.getTime() && startOfDay(due).getTime() > startOfDay(now).getTime()
}

function isActiveEvent(event, now) {
  if (isEventComplete(event)) return false
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

function categoryVar(category) {
  if (category === 'work') return 'var(--category-work)'
  if (category === 'personal') return 'var(--category-personal)'
  if (category === 'games') return 'var(--category-games)'
  return 'var(--category-default)'
}

function CategoryDot({ category }) {
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: categoryVar(category), marginRight: 6, flexShrink: 0 }} />
}

function categoryBorderStyle(category, extra = {}) {
  return { borderLeft: `4px solid ${categoryVar(category)}`, ...extra }
}

function TaskBadge({ event }) {
  if (!event.task_count) return null
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', background: 'var(--surface-muted)', border: '1px solid var(--border-default)', borderRadius: 999, padding: '1px 8px', marginLeft: 6 }}>
      {event.completed_task_count}/{event.task_count}
    </span>
  )
}

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

function useThemeMode() {
  const [mode, setMode] = useState(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('pti-theme-mode') : null
    if (stored === 'light' || stored === 'dark') return stored
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark'
    return 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-mode', mode)
    document.documentElement.setAttribute('data-theme', 'default')
    window.localStorage.setItem('pti-theme-mode', mode)
  }, [mode])

  function toggleMode() {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

  return { mode, toggleMode }
}

function TopNav({ onAddEvent, mode, onToggleMode }) {
  const linkStyle = ({ isActive }) => ({
    padding: '8px 14px',
    borderRadius: 8,
    textDecoration: 'none',
    fontWeight: 600,
    color: isActive ? '#fff' : 'var(--text-primary)',
    background: isActive ? 'var(--accent-primary)' : 'transparent'
  })
  return (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 22, color: 'var(--text-primary)' }}>Schedule</h1>
        <nav style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <NavLink to="/" end style={linkStyle}>Dashboard</NavLink>
          <NavLink to="/calendar" style={linkStyle}>Calendar</NavLink>
        </nav>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onToggleMode}
          aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{ padding: '10px 12px', background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
        >
          {mode === 'dark' ? '☀️ Light' : '🌙 Dark'}
        </button>
        <button type="button" onClick={onAddEvent} style={{ padding: '10px 16px', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
          + Add Event
        </button>
      </div>
    </header>
  )
}

function TaskChecklist({ eventId, requiresAction }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [newTaskName, setNewTaskName] = useState('')

  async function refresh() {
    if (!eventId) return
    setLoading(true)
    try {
      const list = await fetchEventTasks(eventId)
      setTasks(list)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [eventId])

  async function handleAdd(e) {
    e.preventDefault()
    if (!newTaskName.trim()) return
    try {
      await createEventTask(eventId, { name: newTaskName.trim(), sort_order: tasks.length })
      setNewTaskName('')
      await refresh()
    } catch (err) {
      console.error(err)
      alert('Failed to add sub-task')
    }
  }

  async function handleToggle(task) {
    try {
      await updateEventTask(eventId, task.id, { completed: !task.completed })
      await refresh()
    } catch (err) {
      console.error(err)
      alert('Failed to update sub-task')
    }
  }

  async function handleDelete(task) {
    try {
      await deleteEventTask(eventId, task.id)
      await refresh()
    } catch (err) {
      console.error(err)
      alert('Failed to delete sub-task')
    }
  }

  if (!eventId) return null

  return (
    <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: 12, marginTop: 4 }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
        Sub-tasks {tasks.length > 0 && `(${tasks.filter((t) => t.completed).length}/${tasks.length})`}
      </div>
      {loading ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading...</div>
      ) : (
        <>
          {tasks.map((task) => (
            <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <input type="checkbox" checked={task.completed} onChange={() => handleToggle(task)} />
              <span style={{ flex: 1, fontSize: 14, color: task.completed ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: task.completed ? 'line-through' : 'none' }}>{task.name}</span>
              <button type="button" onClick={() => handleDelete(task)} aria-label="Remove sub-task" style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>&times;</button>
            </div>
          ))}
          {tasks.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>No sub-tasks yet.</div>}
        </>
      )}
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <input
          value={newTaskName}
          onChange={(e) => setNewTaskName(e.target.value)}
          placeholder="Add a sub-task"
          style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border-default)' }}
        />
        <button type="submit" style={{ padding: '8px 12px', border: 'none', borderRadius: 8, background: 'var(--text-primary)', color: 'var(--surface)', cursor: 'pointer' }}>Add</button>
      </form>
      {!requiresAction && tasks.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Adding a sub-task marks this event as requiring action.</div>
      )}
    </div>
  )
}

function EventModal({ mode, initialEvent, onClose, onSaved, onDeleted }) {
  const [name, setName] = useState(initialEvent?.name || '')
  const [description, setDescription] = useState(initialEvent?.description || '')
  const [startTime, setStartTime] = useState(
    mode === 'edit' ? toLocalInputValue(initialEvent?.start_time) : toLocalInputValue(new Date().toISOString())
  )
  const [endTime, setEndTime] = useState(toLocalInputValue(initialEvent?.end_time))
  const [category, setCategory] = useState(initialEvent?.category || '')
  const [requiresAction, setRequiresAction] = useState(!!initialEvent?.requires_action)
  const [completed, setCompleted] = useState(!!initialEvent?.completed)
  const [draftTasks, setDraftTasks] = useState([])
  const [newDraftTaskName, setNewDraftTaskName] = useState('')

  function handleAddDraftTask(e) {
    e.preventDefault()
    const trimmed = newDraftTaskName.trim()
    if (!trimmed) return
    setDraftTasks((prev) => [...prev, trimmed])
    setNewDraftTaskName('')
  }

  function handleRemoveDraftTask(index) {
    setDraftTasks((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errors = []
    if (!name) errors.push('Name is required')
    if (startTime && endTime && new Date(startTime) > new Date(endTime)) errors.push('Start time must be before end time')
    if (errors.length) {
      alert(errors.join('\n'))
      return
    }

    if (mode === 'add' && startTime && new Date(startTime).getTime() < Date.now()) {
      const proceed = window.confirm(
        'This event starts in the past. This app is meant to track upcoming things — create it anyway?'
      )
      if (!proceed) return
    }

    const payload = {
      name,
      description: description || null,
      start_time: startTime ? new Date(startTime).toISOString() : null,
      end_time: endTime ? new Date(endTime).toISOString() : null,
      category: category || null,
      requires_action: requiresAction || draftTasks.length > 0,
      completed: mode === 'add' ? false : completed
    }

    if (mode === 'edit' && initialEvent) {
      try {
        await updateEvent(initialEvent.id, payload)
        await onSaved()
        onClose()
      } catch (err) {
        console.error(err)
        alert('Save failed')
      }
      return
    }

    // Add mode: creating the event plus its sub-tasks is treated as one
    // all-or-nothing operation. If any sub-task fails to save, we roll back
    // (delete the event and any sub-tasks that did succeed) rather than
    // leave a partially-created event with some sub-tasks silently missing.
    // The form stays open with everything you typed so you can retry.
    let newEventId = null
    const createdTaskIds = []
    try {
      const created = await createEvent(payload)
      newEventId = created?.id

      if (draftTasks.length > 0) {
        if (!newEventId) {
          throw new Error('Event was created but no id was returned, so sub-tasks cannot be attached.')
        }
        for (let index = 0; index < draftTasks.length; index += 1) {
          const result = await createEventTask(newEventId, { name: draftTasks[index], sort_order: index })
          if (result?.id) createdTaskIds.push(result.id)
        }
      }

      await onSaved()
      onClose()
    } catch (err) {
      console.error(err)
      if (newEventId) {
        try {
          for (const taskId of createdTaskIds) {
            await deleteEventTask(newEventId, taskId)
          }
          await deleteEvent(newEventId)
          await onSaved()
        } catch (rollbackErr) {
          console.error('Rollback failed:', rollbackErr)
          alert('Save failed, and automatic cleanup also failed. Please check your event list for a partially-created "' + name + '" entry and remove it manually.')
          return
        }
      }
      alert('Could not save this event with its sub-tasks, so nothing was created. Please try again.')
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
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'var(--modal-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }} onClick={onClose}>
      <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 20, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>{mode === 'edit' ? 'Edit event' : 'Add event'}</h3>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', lineHeight: 1, color: 'var(--text-primary)' }}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Event name" style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--surface)', color: 'var(--text-primary)' }}>
            <option value="">Select category</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
          <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={requiresAction} onChange={(e) => setRequiresAction(e.target.checked)} />
            Requires action
          </label>
          {mode === 'edit' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={completed} onChange={(e) => setCompleted(e.target.checked)} />
              Completed
            </label>
          )}
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" style={{ minHeight: 80, padding: 10, borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--surface)', color: 'var(--text-primary)' }} />

          {mode === 'add' && (
            <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: 10, marginTop: 2 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Sub-tasks {draftTasks.length > 0 && `(${draftTasks.length})`}
              </div>
              {draftTasks.map((taskName, index) => (
                <div key={`${taskName}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ flex: 1, fontSize: 14, color: 'var(--text-primary)' }}>{taskName}</span>
                  <button type="button" onClick={() => handleRemoveDraftTask(index)} aria-label="Remove sub-task" style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>&times;</button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  value={newDraftTaskName}
                  onChange={(e) => setNewDraftTaskName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddDraftTask(e) } }}
                  placeholder="Add a sub-task"
                  style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--surface)', color: 'var(--text-primary)' }}
                />
                <button type="button" onClick={handleAddDraftTask} style={{ padding: '8px 12px', border: 'none', borderRadius: 8, background: 'var(--text-primary)', color: 'var(--surface)', cursor: 'pointer' }}>Add</button>
              </div>
              {draftTasks.length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Adding sub-tasks marks this event as requiring action. If saving fails, nothing will be created.</div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="submit" style={{ flex: 1, padding: '10px 16px', border: 'none', borderRadius: 8, background: 'var(--text-primary)', color: 'var(--surface)', cursor: 'pointer', fontWeight: 600 }}>Save</button>
            {mode === 'edit' && (
              <button type="button" onClick={handleDelete} style={{ flex: 1, padding: '10px 16px', border: 'none', borderRadius: 8, background: 'var(--accent-danger)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Delete</button>
            )}
            <button type="button" onClick={onClose} style={{ padding: '10px 16px', border: '1px solid var(--border-default)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-primary)', cursor: 'pointer' }}>Cancel</button>
          </div>
        </form>
        {mode === 'edit' && initialEvent && (
          <TaskChecklist eventId={initialEvent.id} requiresAction={requiresAction} />
        )}
      </div>
    </div>
  )
}

function CollapsibleSection({ title, count, tone = 'neutral', emptyText, defaultOpen, children, hasItems }) {
  const [open, setOpen] = useState(defaultOpen && hasItems)

  useEffect(() => {
    setOpen(defaultOpen && hasItems)
  }, [hasItems, defaultOpen])

  const toneStyles = {
    danger: { border: 'var(--danger-border)', headerColor: 'var(--danger-text)', badgeBg: 'var(--danger-bg)' },
    neutral: { border: 'var(--border-default)', headerColor: 'var(--text-primary)', badgeBg: 'var(--surface-muted)' },
    muted: { border: 'var(--border-default)', headerColor: 'var(--text-secondary)', badgeBg: 'var(--surface-muted)' }
  }[tone] || { border: 'var(--border-default)', headerColor: 'var(--text-primary)', badgeBg: 'var(--surface-muted)' }

  return (
    <section style={{ background: 'var(--surface)', border: `1px solid ${toneStyles.border}`, borderRadius: 12, marginBottom: 14, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <span style={{ fontWeight: 700, fontSize: 16, color: toneStyles.headerColor }}>{title}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ background: toneStyles.badgeBg, color: toneStyles.headerColor, borderRadius: 999, padding: '2px 10px', fontSize: 13, fontWeight: 700 }}>{count}</span>
          <span style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', color: 'var(--text-muted)' }}>&#9660;</span>
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 16px 16px' }}>
          {hasItems ? children : <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{emptyText}</div>}
        </div>
      )}
    </section>
  )
}

function DueLabel({ event, now }) {
  const due = getDueTime(event)
  if (!due) return <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No due date</span>
  const overdue = event.requires_action && !isEventComplete(event) && due.getTime() < now.getTime()
  return (
    <span style={{ fontSize: 12, fontWeight: overdue ? 700 : 400, color: overdue ? 'var(--danger-text)' : 'var(--text-secondary)' }}>
      Due {formatDateTime(due.toISOString())}
    </span>
  )
}

function EventListCard({ event, onEdit, onToggleCompleted, showMarkDone = true }) {
  const hasSubtasks = event.task_count > 0
  const now = useMemo(() => new Date(), [event])
  return (
    <div style={{ ...categoryBorderStyle(event.category), background: 'var(--surface-muted)', borderRadius: 8, padding: 10, marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <button type="button" onClick={() => onEdit(event)} style={{ background: 'transparent', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', flex: 1, display: 'flex', alignItems: 'center', minWidth: 0 }}>
          <CategoryDot category={event.category} />
          <span style={{ fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.name}</span>
          <TaskBadge event={event} />
        </button>
        {showMarkDone && event.requires_action && (
          hasSubtasks ? (
            <button
              type="button"
              onClick={() => onEdit(event)}
              title="This event has sub-tasks — open it to check them off"
              style={{ border: '1px solid var(--border-default)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-secondary)', padding: '4px 8px', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              Open checklist
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onToggleCompleted(event)}
              style={{ border: '1px solid var(--border-default)', borderRadius: 6, background: event.completed ? 'var(--text-primary)' : 'var(--surface)', color: event.completed ? 'var(--surface)' : 'var(--text-primary)', padding: '4px 8px', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              {event.completed ? 'Done' : 'Mark done'}
            </button>
          )
        )}
      </div>
      <button type="button" onClick={() => onEdit(event)} style={{ background: 'transparent', border: 'none', padding: 0, marginTop: 4, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{event.category || 'uncategorized'}</span>
        <span style={{ color: 'var(--border-default)' }}>&middot;</span>
        <DueLabel event={event} now={now} />
      </button>
    </div>
  )
}

function DashboardPage({ events, loading, onEdit, onToggleCompleted }) {
  const now = useMemo(() => new Date(), [events])
  const lanes = useMemo(() => getDashboardLanes(events, now), [events, now])
  const previewCount = 4

  const renderLane = (items) => (
    <>
      {items.slice(0, previewCount).map((event) => (
        <EventListCard key={event.id} event={event} onEdit={onEdit} onToggleCompleted={onToggleCompleted} />
      ))}
      {items.length > previewCount && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>+{items.length - previewCount} more</div>
      )}
    </>
  )

  if (loading) return <div>Loading dashboard...</div>

  return (
    <div>
      <CollapsibleSection title="Overdue" count={lanes.overdue.length} tone="danger" emptyText="Nothing overdue" defaultOpen hasItems={lanes.overdue.length > 0}>
        {renderLane(lanes.overdue)}
      </CollapsibleSection>
      <CollapsibleSection title="Due Today" count={lanes.today.length} tone="neutral" emptyText="Nothing due today" defaultOpen hasItems={lanes.today.length > 0}>
        {renderLane(lanes.today)}
      </CollapsibleSection>
      <CollapsibleSection title="Upcoming" count={lanes.upcoming.length} tone="neutral" emptyText="Nothing upcoming" defaultOpen={false} hasItems={lanes.upcoming.length > 0}>
        {renderLane(lanes.upcoming)}
      </CollapsibleSection>
      <CollapsibleSection title="Active Events" count={lanes.active.length} tone="muted" emptyText="No active events" defaultOpen={false} hasItems={lanes.active.length > 0}>
        {renderLane(lanes.active)}
      </CollapsibleSection>
    </div>
  )
}

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
        <div key={label} style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-secondary)', paddingBottom: 8 }}>{label}</div>
      ))}
      {monthGrid.map((date) => {
        const isCurrentMonth = date.getMonth() === selectedDate.getMonth()
        const isSelected = startOfDay(date).getTime() === startOfDay(selectedDate).getTime()
        const dayEvents = events.filter((event) => eventMatchesDate(event, date))
        return (
          <button key={date.toISOString()} onClick={() => setSelectedDate(date)} type="button" style={{ minHeight: 120, border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-default)', background: isCurrentMonth ? 'var(--surface)' : 'var(--surface-muted)', borderRadius: 10, padding: 8, textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontWeight: 700, color: isCurrentMonth ? 'var(--text-primary)' : 'var(--text-muted)' }}>{formatDayNumber(date)}</span>
            {dayEvents.slice(0, 2).map((event) => (
              <span key={event.id} style={{ ...categoryBorderStyle(event.category), display: 'flex', alignItems: 'center', background: 'var(--surface-muted)', color: 'var(--text-primary)', borderRadius: 4, fontSize: 11, padding: '2px 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {event.name}
              </span>
            ))}
            {dayEvents.length > 2 && <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>+{dayEvents.length - 2} more</span>}
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
          <div key={date.toISOString()} style={{ border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-default)', borderRadius: 10, padding: 10, minHeight: 220, background: 'var(--surface)' }}>
            <div style={{ textAlign: 'center', marginBottom: 10 }}>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatShortDay(date)}</div>
              <div style={{ color: 'var(--text-secondary)' }}>{formatDayNumber(date)}</div>
            </div>
            {dayEvents.length === 0 ? <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No events</div> : dayEvents.map((event) => (
              <button key={event.id} type="button" onClick={() => onEdit(event)} style={{ ...categoryBorderStyle(event.category), display: 'block', width: '100%', textAlign: 'left', background: 'var(--surface-muted)', borderRadius: 6, padding: 8, marginBottom: 8, border: 'none', cursor: 'pointer' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }}>{event.name}<TaskBadge event={event} /></div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{formatDateTime(event.start_time)}</div>
              </button>
            ))}
          </div>
        )
      })}
    </div>
  )

  const renderDayView = () => (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-default)', borderRadius: 12, padding: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12, color: 'var(--text-primary)' }}>
        {new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(selectedDate)}
      </div>
      {selectedDayEvents.length === 0 ? <div style={{ color: 'var(--text-secondary)' }}>No events scheduled for this day.</div> : selectedDayEvents.map((event) => (
        <button key={event.id} type="button" onClick={() => onEdit(event)} style={{ ...categoryBorderStyle(event.category), display: 'block', width: '100%', textAlign: 'left', borderTop: '1px solid var(--border-default)', borderRight: '1px solid var(--border-default)', borderBottom: '1px solid var(--border-default)', borderRadius: 8, padding: 12, marginBottom: 10, background: 'var(--surface)', cursor: 'pointer' }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }}>{event.name}<TaskBadge event={event} /></div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{formatDateTime(event.start_time)} to {event.end_time ? formatDateTime(event.end_time) : 'End time not set'}</div>
          {event.description && <div style={{ marginTop: 8, color: 'var(--text-secondary)' }}>{event.description}</div>}
        </button>
      ))}
    </div>
  )

  return (
    <div>
      <section style={{ background: 'var(--surface)', border: '1px solid var(--border-default)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => (view === 'month' ? changeMonth(-1) : view === 'week' ? changeWeek(-1) : changeDay(-1))} style={{ border: '1px solid var(--border-default)', borderRadius: 8, background: 'var(--surface)', padding: '8px 12px', cursor: 'pointer', color: 'var(--text-primary)' }}>Prev</button>
            <strong style={{ fontSize: 18, color: 'var(--text-primary)' }}>
              {view === 'month' ? formatMonth(selectedDate) : view === 'week' ? `Week of ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(weekDates[0])}` : new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(selectedDate)}
            </strong>
            <button type="button" onClick={() => (view === 'month' ? changeMonth(1) : view === 'week' ? changeWeek(1) : changeDay(1))} style={{ border: '1px solid var(--border-default)', borderRadius: 8, background: 'var(--surface)', padding: '8px 12px', cursor: 'pointer', color: 'var(--text-primary)' }}>Next</button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['day', 'week', 'month'].map((option) => (
              <button key={option} type="button" onClick={() => setView(option)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-default)', background: view === option ? 'var(--accent-primary)' : 'var(--surface)', color: view === option ? '#fff' : 'var(--text-primary)', cursor: 'pointer', textTransform: 'capitalize' }}>{option}</button>
            ))}
          </div>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2.2fr) minmax(260px, 0.8fr)', gap: 20 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-default)', borderRadius: 12, padding: 16 }}>
          {loading ? <div>Loading schedule...</div> : (view === 'day' ? renderDayView() : view === 'week' ? renderWeekView() : renderMonthView())}
        </div>

        <aside>
          <CollapsibleSection
            title={new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(selectedDate)}
            count={selectedDayEvents.length}
            tone="neutral"
            emptyText="No events for this date."
            defaultOpen
            hasItems={selectedDayEvents.length > 0}
          >
            {selectedDayEvents.slice(0, 6).map((event) => (
              <button key={event.id} type="button" onClick={() => onEdit(event)} style={{ ...categoryBorderStyle(event.category), width: '100%', background: 'var(--surface-muted)', border: 'none', borderRadius: 6, padding: '10px 12px', marginBottom: 8, textAlign: 'left', cursor: 'pointer' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }}>{event.name}<TaskBadge event={event} /></div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{formatDateTime(event.start_time)}</div>
              </button>
            ))}
            {selectedDayEvents.length > 6 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>+{selectedDayEvents.length - 6} more</div>}
          </CollapsibleSection>

          <CollapsibleSection
            title="This month"
            count={monthEvents.length}
            tone="muted"
            emptyText="No events in this month."
            defaultOpen={false}
            hasItems={monthEvents.length > 0}
          >
            {monthEvents.slice(0, 8).map((event) => (
              <button key={event.id} type="button" onClick={() => onEdit(event)} style={{ ...categoryBorderStyle(event.category), width: '100%', background: 'transparent', border: 'none', borderRadius: 4, padding: '6px 8px', marginBottom: 4, textAlign: 'left', cursor: 'pointer', fontSize: 13 }}>
                <strong style={{ color: 'var(--text-primary)' }}>{event.name}</strong>
                <div style={{ color: 'var(--text-secondary)' }}>{formatDateTime(event.start_time)}</div>
              </button>
            ))}
            {monthEvents.length > 8 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>+{monthEvents.length - 8} more</div>}
          </CollapsibleSection>
        </aside>
      </div>
    </div>
  )
}

export default function App() {
  const { events, loading, refreshEvents, handleToggleCompleted } = useEventsData()
  const { mode, toggleMode } = useThemeMode()
  const [modalState, setModalState] = useState(null)

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
    <div style={{ padding: 20, fontFamily: 'sans-serif', background: 'var(--surface-muted)', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <TopNav onAddEvent={openAddModal} mode={mode} onToggleMode={toggleMode} />

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
