import React, { useEffect, useMemo, useState } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import {
  fetchEventsWithOccurrences,
  createEvent,
  updateEvent,
  deleteEvent,
  fetchReminders,
  createReminder,
  deleteReminder,
  fetchRecurrence,
  setRecurrence,
  deleteRecurrence
} from './api'
import { fetchEventTasks, createEventTask, updateEventTask, deleteEventTask } from './tasksApi'
import QuickAddBubble from './components/QuickAddBubble'


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
    fetchEventsWithOccurrences()
      .then((list) => {
        const data = list && list.length > 0 ? list : sampleEvents
        setEvents(data)
      })
      .catch(() => setEvents(sampleEvents))
      .finally(() => setLoading(false))
  }, [])


  async function refreshEvents() {
    const updated = await fetchEventsWithOccurrences()
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
          {mode === 'dark' ? '\u2600\ufe0f Light' : '\ud83c\udf19 Dark'}
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
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <input
          value={newTaskName}
          onChange={(e) => setNewTaskName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(e) } }}
          placeholder="Add a sub-task"
          style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--surface)', color: 'var(--text-primary)' }}
        />
        <button type="button" onClick={handleAdd} style={{ padding: '8px 12px', border: 'none', borderRadius: 8, background: 'var(--text-primary)', color: 'var(--surface)', cursor: 'pointer' }}>Add</button>
      </div>
      {!requiresAction && tasks.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Adding a sub-task marks this event as requiring action.</div>
      )}
    </div>
  )
}


function ReminderSection({ eventId, startTime, endTime }) {
  const [reminders, setReminders] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('quick')
  const [anchor, setAnchor] = useState('start')
  const [offsetAmount, setOffsetAmount] = useState('15')
  const [offsetUnit, setOffsetUnit] = useState('minutes')
  const [customValue, setCustomValue] = useState('')
  const [saving, setSaving] = useState(false)


  const OFFSET_PRESETS = [
    { label: '10 min', minutes: 10 },
    { label: '30 min', minutes: 30 },
    { label: '1 hour', minutes: 60 },
    { label: '1 day', minutes: 24 * 60 }
  ]


  const OFFSET_UNITS = [
    { label: 'minutes', minutesPerUnit: 1 },
    { label: 'hours', minutesPerUnit: 60 },
    { label: 'days', minutesPerUnit: 24 * 60 },
    { label: 'weeks', minutesPerUnit: 7 * 24 * 60 },
    { label: 'months', minutesPerUnit: 30 * 24 * 60 }
  ]


  const anchorTime = anchor === 'end' && endTime ? new Date(endTime) : (startTime ? new Date(startTime) : new Date())


  async function refresh() {
    setLoading(true)
    try {
      const list = await fetchReminders(eventId)
      setReminders(list.filter((r) => !r.dismissed))
    } catch (err) {
      setReminders([])
    } finally {
      setLoading(false)
    }
  }


  useEffect(() => { refresh() }, [eventId])


  async function addReminder(remindAt) {
    if (remindAt.getTime() <= Date.now()) {
      alert('Reminder time must be in the future')
      return
    }
    setSaving(true)
    try {
      await createReminder(eventId, { remind_at: remindAt.toISOString() })
      await refresh()
    } catch (err) {
      console.error(err)
      alert('Failed to create reminder')
    } finally {
      setSaving(false)
    }
  }


  function handlePresetClick(minutes) {
    addReminder(new Date(anchorTime.getTime() - minutes * 60 * 1000))
  }


  function handleCustomOffsetSubmit() {
    const amount = parseFloat(offsetAmount)
    if (!amount || amount <= 0) {
      alert('Enter a number greater than 0')
      return
    }
    const unit = OFFSET_UNITS.find((u) => u.label === offsetUnit) || OFFSET_UNITS[0]
    const totalMinutes = amount * unit.minutesPerUnit
    addReminder(new Date(anchorTime.getTime() - totalMinutes * 60 * 1000))
  }


  function handleCustomDateSubmit() {
    if (!customValue) return
    const remindAt = new Date(customValue)
    if (Number.isNaN(remindAt.getTime())) {
      alert('Pick a valid date/time')
      return
    }
    addReminder(remindAt)
    setCustomValue('')
  }


  async function handleDelete(reminder) {
    try {
      await deleteReminder(reminder.id)
      await refresh()
    } catch (err) {
      console.error(err)
      alert('Failed to delete reminder')
    }
  }


  const tabBtnStyle = (isActive) => ({
    flex: 1,
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid var(--border-default)',
    background: isActive ? 'var(--accent-primary)' : 'var(--surface)',
    color: isActive ? '#fff' : 'var(--text-primary)',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 13
  })


  const anchorChipStyle = (isActive, disabled) => ({
    flex: 1,
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid var(--border-default)',
    background: isActive ? 'var(--accent-primary)' : 'var(--surface)',
    color: isActive ? '#fff' : 'var(--text-primary)',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    fontWeight: 600,
    fontSize: 12
  })


  return (
    <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: 12, marginTop: 4 }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>Reminders</div>


      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
        Start: {startTime ? new Date(startTime).toLocaleString() : 'Not set'}
        {'  \u00b7  '}
        End: {endTime ? new Date(endTime).toLocaleString() : 'Not set'}
      </div>


      {loading ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading...</div>
      ) : (
        <>
          {reminders.map((reminder) => (
            <div key={reminder.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>
                {new Date(reminder.remind_at).toLocaleString()}
              </span>
              <button type="button" onClick={() => handleDelete(reminder)} aria-label="Remove reminder" style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>&times;</button>
            </div>
          ))}
          {reminders.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>No reminders set.</div>}


          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <button type="button" onClick={() => setTab('quick')} style={tabBtnStyle(tab === 'quick')}>Quick</button>
            <button type="button" onClick={() => setTab('custom')} style={tabBtnStyle(tab === 'custom')}>Custom</button>
          </div>


          {tab === 'quick' && (
            <>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <button type="button" onClick={() => setAnchor('start')} style={anchorChipStyle(anchor === 'start', false)}>
                  Before start
                </button>
                <button
                  type="button"
                  onClick={() => endTime && setAnchor('end')}
                  disabled={!endTime}
                  style={anchorChipStyle(anchor === 'end', !endTime)}
                >
                  Before end{!endTime ? ' (no end time)' : ''}
                </button>
              </div>


              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {OFFSET_PRESETS.map((opt) => (
                  <button
                    key={opt.minutes}
                    type="button"
                    onClick={() => handlePresetClick(opt.minutes)}
                    disabled={saving}
                    style={{ border: '1px solid var(--border-default)', borderRadius: 999, background: 'var(--surface)', color: 'var(--text-primary)', padding: '4px 10px', fontSize: 12, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>


              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Or set a custom amount before {anchor === 'end' ? 'end' : 'start'}:
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="number"
                  min="0"
                  value={offsetAmount}
                  onChange={(e) => setOffsetAmount(e.target.value)}
                  style={{ width: 60, padding: 8, borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--surface)', color: 'var(--text-primary)', textAlign: 'center' }}
                />
                <select
                  value={offsetUnit}
                  onChange={(e) => setOffsetUnit(e.target.value)}
                  style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--surface)', color: 'var(--text-primary)' }}
                >
                  {OFFSET_UNITS.map((u) => <option key={u.label} value={u.label}>{u.label}</option>)}
                </select>
                <button
                  type="button"
                  onClick={handleCustomOffsetSubmit}
                  disabled={saving}
                  style={{ padding: '8px 14px', border: 'none', borderRadius: 8, background: 'var(--accent-primary)', color: '#fff', cursor: 'pointer', fontWeight: 700, opacity: saving ? 0.6 : 1 }}
                >
                  Set
                </button>
              </div>
            </>
          )}


          {tab === 'custom' && (
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="datetime-local"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--surface)', color: 'var(--text-primary)' }}
              />
              <button
                type="button"
                onClick={handleCustomDateSubmit}
                disabled={saving}
                style={{ padding: '8px 12px', border: 'none', borderRadius: 8, background: 'var(--text-primary)', color: 'var(--surface)', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
              >
                Add
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}


function RecurrenceSection({ eventId }) {
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [frequency, setFrequency] = useState('weekly')
  const [interval, setIntervalValue] = useState('1')
  const [saving, setSaving] = useState(false)


  useEffect(() => {
    fetchRecurrence(eventId)
      .then((rule) => {
        if (rule) {
          setEnabled(true)
          setFrequency(rule.frequency || 'weekly')
          setIntervalValue(String(rule.interval || 1))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [eventId])


  async function handleToggle(next) {
    setEnabled(next)
    if (!next) {
      setSaving(true)
      try {
        await deleteRecurrence(eventId)
      } catch (err) {
        alert('Failed to remove recurrence')
      } finally {
        setSaving(false)
      }
    }
  }


  async function handleSave() {
    const intervalNum = parseInt(interval, 10)
    if (!intervalNum || intervalNum < 1) {
      alert('Repeat interval must be at least 1')
      return
    }
    setSaving(true)
    try {
      await setRecurrence(eventId, { frequency, interval: intervalNum, until: null, count: null })
      alert('Recurrence saved')
    } catch (err) {
      alert('Failed to save recurrence')
    } finally {
      setSaving(false)
    }
  }


  if (loading) return null


  return (
    <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: 12, marginTop: 4 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text-secondary)', marginBottom: 10 }}>
        <input type="checkbox" checked={enabled} onChange={(e) => handleToggle(e.target.checked)} disabled={saving} />
        Repeats
      </label>


      {enabled && (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Every</span>
            <input
              type="number"
              min="1"
              value={interval}
              onChange={(e) => setIntervalValue(e.target.value)}
              style={{ width: 60, padding: 8, borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--surface)', color: 'var(--text-primary)', textAlign: 'center' }}
            />
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--surface)', color: 'var(--text-primary)' }}
            >
              <option value="daily">day(s)</option>
              <option value="weekly">week(s)</option>
              <option value="monthly">month(s)</option>
              <option value="yearly">year(s)</option>
            </select>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '8px 14px', border: 'none', borderRadius: 8, background: 'var(--accent-primary)', color: '#fff', cursor: 'pointer', fontWeight: 700, opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Saving\u2026' : 'Save repeat rule'}
          </button>
        </>
      )}
    </div>
  )
}


function EventModal({ mode, initialEvent, initialDraft, onClose, onSaved, onDeleted }) {
  const [name, setName] = useState(initialEvent?.name || initialDraft?.name || '')
  const [description, setDescription] = useState(initialEvent?.description || '')
  const [startTime, setStartTime] = useState(
    mode === 'edit'
      ? toLocalInputValue(initialEvent?.start_time)
      : (initialDraft?.startTime || toLocalInputValue(new Date().toISOString()))
  )
  const [endTime, setEndTime] = useState(
    mode === 'edit' ? toLocalInputValue(initialEvent?.end_time) : (initialDraft?.endTime || '')
  )
  const [category, setCategory] = useState(initialEvent?.category || '')
  const [requiresAction, setRequiresAction] = useState(!!initialEvent?.requires_action)
  const [completed, setCompleted] = useState(!!initialEvent?.completed)
  const [draftTasks, setDraftTasks] = useState([])
  const [newDraftTaskName, setNewDraftTaskName] = useState('')
  const [showDraftNote, setShowDraftNote] = useState(!!initialDraft)


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
        'This event starts in the past. This app is meant to track upcoming things \u2014 create it anyway?'
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


      // Auto-chain: if this event was created from a Quick Add draft that
      // detected recurrence, save the recurrence rule immediately — no
      // separate manual "open Repeats" step, ever. byDay is intentionally
      // NOT sent (setRecurrence has no such field); it's absorbed naturally
      // since start_time is already anchored to the correct weekday by the
      // parser. Failure here is non-fatal: the event itself still exists,
      // the user just needs to set Repeats manually as a fallback.
      if (initialDraft?.recurrence && newEventId) {
        try {
          await setRecurrence(newEventId, {
            frequency: initialDraft.recurrence.type,
            interval: initialDraft.recurrence.interval || 1,
            until: initialDraft.recurrence.until || null,
            count: null
          })
        } catch (recurrenceErr) {
          console.error(recurrenceErr)
          alert('Event was created, but the recurrence rule could not be saved automatically. Open the event and set Repeats manually.')
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


        {showDraftNote && initialDraft && (
          <div style={{ border: '1px solid var(--border-default)', borderRadius: 8, padding: 10, marginBottom: 10, background: 'var(--surface-muted)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Pre-filled from Quick Add — review before saving.
              {initialDraft.recurrence && ' Recurrence will be saved automatically when you save this event.'}
            </div>
            <button type="button" onClick={() => setShowDraftNote(false)} style={{ marginTop: 4, border: 'none', background: 'transparent', color: 'var(--accent-primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
              Dismiss
            </button>
          </div>
        )}


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


          {mode === 'edit' && initialEvent && (
            <>
              <TaskChecklist eventId={initialEvent.id} requiresAction={requiresAction} />
              <ReminderSection eventId={initialEvent.id} startTime={initialEvent.start_time} endTime={initialEvent.end_time} />
              <RecurrenceSection eventId={initialEvent.id} />
            </>
          )}


          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="submit" style={{ flex: 1, padding: '10px 16px', border: 'none', borderRadius: 8, background: 'var(--text-primary)', color: 'var(--surface)', cursor: 'pointer', fontWeight: 600 }}>Save</button>
            {mode === 'edit' && (
              <button type="button" onClick={handleDelete} style={{ flex: 1, padding: '10px 16px', border: 'none', borderRadius: 8, background: 'var(--accent-danger)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Delete</button>
            )}
            <button type="button" onClick={onClose} style={{ padding: '10px 16px', border: '1px solid var(--border-default)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-primary)', cursor: 'pointer' }}>Cancel</button>
          </div>
        </form>
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


function OutstandingTasks({ eventId, taskCount }) {
  const [tasks, setTasks] = useState(null)
  const [loading, setLoading] = useState(false)


  useEffect(() => {
    if (!taskCount) return
    setLoading(true)
    fetchEventTasks(eventId)
      .then((list) => setTasks(list))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false))
  }, [eventId, taskCount])


  if (!taskCount) return null
  if (loading || tasks === null) {
    return <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Loading tasks...</div>
  }


  const outstanding = tasks.filter((t) => !t.completed)
  if (outstanding.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>All sub-tasks complete.</div>
  }


  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 }}>Outstanding</div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {outstanding.map((task) => (
          <li key={task.id} style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--text-muted)', flexShrink: 0 }} />
            {task.name}
          </li>
        ))}
      </ul>
    </div>
  )
}


function EventListCard({ event, onEdit, onToggleCompleted, showMarkDone = true }) {
  const hasSubtasks = event.task_count > 0
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
              title="This event has sub-tasks \u2014 open it to check them off"
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


      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        <span style={{ textTransform: 'capitalize' }}>{event.category || 'uncategorized'}</span>
        <span style={{ color: 'var(--border-default)' }}>&middot;</span>
        <span>Start: {formatDateTime(event.start_time)}</span>
        <span style={{ color: 'var(--border-default)' }}>&middot;</span>
        <span>End: {event.end_time ? formatDateTime(event.end_time) : 'Not set'}</span>
      </div>


      {event.description && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {event.description}
        </div>
      )}


      <OutstandingTasks eventId={event.id} taskCount={event.task_count} />
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


  function handleQuickAddParsed(draft) {
    setModalState({ mode: 'add', draft })
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
            initialDraft={modalState.draft}
            onClose={closeModal}
            onSaved={refreshEvents}
            onDeleted={refreshEvents}
          />
        )}


        <QuickAddBubble onParsed={handleQuickAddParsed} disabled={!!modalState} />
      </div>
    </div>
  )
}
