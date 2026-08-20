import React, { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, StyleSheet, Switch, Platform } from 'react-native'
import { Picker } from '@react-native-picker/picker'
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { CATEGORIES } from '../../../shared/eventLogic'
import { fetchEvents, createEvent, updateEvent, deleteEvent, fetchReminders, createReminder, deleteReminder, fetchRecurrence, setRecurrence, deleteRecurrence } from '../api'
import { fetchEventTasks, createEventTask, updateEventTask, deleteEventTask } from '../tasksApi'
import { useThemeMode } from '../theme'
import FormSection from '../components/FormSection'




export default function EventDetailScreen({ route, navigation }) {
  const { colors } = useThemeMode()
  const eventId = route.params?.eventId ?? null
  const isEdit = eventId !== null
  const draft = route.params?.draft ?? null
  const parseNotes = route.params?.parseNotes ?? []




  const [loading, setLoading] = useState(isEdit)
  const [name, setName] = useState(draft?.name ?? '')
  const [description, setDescription] = useState('')
  const [startTime, setStartTime] = useState(draft?.startTime ? new Date(draft.startTime) : new Date())
  const [endTime, setEndTime] = useState(draft?.endTime ? new Date(draft.endTime) : null)
  const [category, setCategory] = useState('')
  const [requiresAction, setRequiresAction] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [showStartPicker, setShowStartPicker] = useState(false)
  const [showEndPicker, setShowEndPicker] = useState(false)
  const [showParseNotes, setShowParseNotes] = useState(!!draft && parseNotes.length > 0)




  const [draftTasks, setDraftTasks] = useState([])
  const [newDraftTaskName, setNewDraftTaskName] = useState('')
  const [tasks, setTasks] = useState([])




  useEffect(() => {
    if (!isEdit) return
    setLoading(true)
    fetchEvents()
      .then((list) => {
        const event = list.find((e) => e.id === eventId)
        if (event) {
          setName(event.name)
          setDescription(event.description || '')
          setStartTime(event.start_time ? new Date(event.start_time) : new Date())
          setEndTime(event.end_time ? new Date(event.end_time) : null)
          setCategory(event.category || '')
          setRequiresAction(!!event.requires_action)
          setCompleted(!!event.completed)
        }
      })
      .finally(() => setLoading(false))
    fetchEventTasks(eventId).then(setTasks).catch(() => setTasks([]))
  }, [eventId, isEdit])




  async function refreshTasks() {
    const list = await fetchEventTasks(eventId)
    setTasks(list)
  }




  function addDraftTask() {
    const trimmed = newDraftTaskName.trim()
    if (!trimmed) return
    setDraftTasks((prev) => [...prev, trimmed])
    setNewDraftTaskName('')
  }




  function removeDraftTask(index) {
    setDraftTasks((prev) => prev.filter((_, i) => i !== index))
  }




  async function handleToggleTask(task) {
    try {
      await updateEventTask(eventId, task.id, { completed: !task.completed })
      await refreshTasks()
    } catch (err) {
      Alert.alert('Error', 'Failed to update sub-task')
    }
  }




  async function handleAddExistingTask() {
    const trimmed = newDraftTaskName.trim()
    if (!trimmed) return
    try {
      await createEventTask(eventId, { name: trimmed, sort_order: tasks.length })
      setNewDraftTaskName('')
      await refreshTasks()
    } catch (err) {
      Alert.alert('Error', 'Failed to add sub-task')
    }
  }




  async function handleDeleteTask(task) {
    try {
      await deleteEventTask(eventId, task.id)
      await refreshTasks()
    } catch (err) {
      Alert.alert('Error', 'Failed to delete sub-task')
    }
  }




  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Missing name', 'Name is required')
      return
    }
    if (endTime && startTime > endTime) {
      Alert.alert('Invalid dates', 'Start time must be before end time')
      return
    }




    if (!isEdit && startTime.getTime() < Date.now()) {
      Alert.alert(
        'Event starts in the past',
        'This app is meant to track upcoming things. Create it anyway?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Create anyway', onPress: () => doSave() }
        ]
      )
      return
    }
    doSave()
  }




  async function doSave() {
    const payload = {
      name: name.trim(),
      description: description || null,
      start_time: startTime.toISOString(),
      end_time: endTime ? endTime.toISOString() : null,
      category: category || null,
      requires_action: requiresAction || draftTasks.length > 0,
      completed: isEdit ? completed : false
    }




    if (isEdit) {
      try {
        await updateEvent(eventId, payload)
        navigation.goBack()
      } catch (err) {
        Alert.alert('Save failed', 'Please try again.')
      }
      return
    }




    let newEventId = null
    const createdTaskIds = []
    try {
      const created = await createEvent(payload)
      newEventId = created?.id
      if (draftTasks.length > 0) {
        if (!newEventId) throw new Error('No id returned for new event')
        for (let i = 0; i < draftTasks.length; i += 1) {
          const result = await createEventTask(newEventId, { name: draftTasks[i], sort_order: i })
          if (result?.id) createdTaskIds.push(result.id)
        }
      }
      navigation.goBack()
    } catch (err) {
      if (newEventId) {
        try {
          for (const taskId of createdTaskIds) await deleteEventTask(newEventId, taskId)
          await deleteEvent(newEventId)
        } catch (rollbackErr) {
          Alert.alert('Cleanup failed', `Please manually remove any partially-created "${name}" entry.`)
          return
        }
      }
      Alert.alert('Save failed', 'Nothing was created. Please try again.')
    }
  }




  function handleDelete() {
    Alert.alert('Delete event', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteEvent(eventId)
            navigation.goBack()
          } catch (err) {
            Alert.alert('Delete failed', 'Please try again.')
          }
        }
      }
    ])
  }




  // On Android, DateTimePicker's dialog mode must be driven via the
  // imperative DateTimePickerAndroid.open() API rather than mounted
  // directly in JSX. Rendering it as a normal component works on iOS
  // (inline picker, no native dialog) but on Android throws
  // "Cannot read property 'dismiss' of undefined" once a second picker
  // instance (Start vs End) exists on the same screen — a known library
  // issue (react-native-datetimepicker/datetimepicker#907). iOS keeps the
  // declarative component since it has no such conflict.
  function openStartPicker() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: startTime,
        mode: 'date',
        onChange: (event, date) => {
          if (event.type !== 'set' || !date) return
          DateTimePickerAndroid.open({
            value: date,
            mode: 'time',
            onChange: (timeEvent, time) => {
              if (timeEvent.type !== 'set' || !time) return
              const combined = new Date(date)
              combined.setHours(time.getHours(), time.getMinutes())
              setStartTime(combined)
            }
          })
        }
      })
    } else {
      setShowStartPicker(true)
    }
  }




  function openEndPicker() {
    const base = endTime || startTime
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: base,
        mode: 'date',
        onChange: (event, date) => {
          if (event.type !== 'set' || !date) return
          DateTimePickerAndroid.open({
            value: date,
            mode: 'time',
            onChange: (timeEvent, time) => {
              if (timeEvent.type !== 'set' || !time) return
              const combined = new Date(date)
              combined.setHours(time.getHours(), time.getMinutes())
              setEndTime(combined)
            }
          })
        }
      })
    } else {
      setShowEndPicker(true)
    }
  }




  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.surfaceMuted }]}>
        <Text style={{ color: colors.textPrimary }}>Loading...</Text>
      </View>
    )
  }




  return (
    <ScrollView style={{ backgroundColor: colors.surfaceMuted }} contentContainerStyle={styles.container}>
      {showParseNotes && parseNotes.length > 0 && (
        <View style={[styles.parseBanner, { backgroundColor: colors.surfaceMuted, borderColor: colors.borderDefault }]}>
          {parseNotes.map((note, i) => (
            <Text key={i} style={{ color: colors.textSecondary, fontSize: 12 }}>• {note}</Text>
          ))}
          <TouchableOpacity onPress={() => setShowParseNotes(false)} style={{ alignSelf: 'flex-end', marginTop: 4 }}>
            <Text style={{ color: colors.accentPrimary, fontSize: 12, fontWeight: '600' }}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}


      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Event name"
        placeholderTextColor={colors.textMuted}
        style={[styles.input, { borderColor: colors.borderDefault, color: colors.textPrimary, backgroundColor: colors.surface }]}
      />




      <View style={[styles.input, { borderColor: colors.borderDefault, backgroundColor: colors.surface, padding: 0 }]}>
        <Picker selectedValue={category} onValueChange={setCategory} style={{ color: colors.textPrimary }}>
          <Picker.Item label="Select category" value="" />
          {CATEGORIES.map((c) => <Picker.Item key={c} label={c} value={c} />)}
        </Picker>
      </View>




      <TouchableOpacity onPress={openStartPicker} style={[styles.input, { borderColor: colors.borderDefault, backgroundColor: colors.surface }]}>
        <Text style={{ color: colors.textPrimary }}>Start: {startTime.toLocaleString()}</Text>
      </TouchableOpacity>
      {Platform.OS === 'ios' && showStartPicker && (
        <DateTimePicker
          value={startTime}
          mode="datetime"
          onChange={(event, date) => { setShowStartPicker(false); if (date) setStartTime(date) }}
        />
      )}




      <TouchableOpacity onPress={openEndPicker} style={[styles.input, { borderColor: colors.borderDefault, backgroundColor: colors.surface }]}>
        <Text style={{ color: colors.textPrimary }}>End: {endTime ? endTime.toLocaleString() : 'Not set'}</Text>
      </TouchableOpacity>
      {Platform.OS === 'ios' && showEndPicker && (
        <DateTimePicker
          value={endTime || startTime}
          mode="datetime"
          onChange={(event, date) => { setShowEndPicker(false); if (date) setEndTime(date) }}
        />
      )}




      <View style={styles.switchRow}>
        <Text style={{ color: colors.textSecondary }}>Requires action</Text>
        <Switch value={requiresAction} onValueChange={setRequiresAction} />
      </View>




      {isEdit && (
        <View style={styles.switchRow}>
          <Text style={{ color: colors.textSecondary }}>Completed</Text>
          <Switch value={completed} onValueChange={setCompleted} />
        </View>
      )}




      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Description"
        placeholderTextColor={colors.textMuted}
        multiline
        style={[styles.input, styles.textArea, { borderColor: colors.borderDefault, color: colors.textPrimary, backgroundColor: colors.surface }]}
      />




      {isEdit && (
        <FormSection title="Repeats" subtitle="Make this a recurring event" defaultOpen={false}>
          <RecurrenceSection eventId={eventId} colors={colors} />
        </FormSection>
      )}




      {isEdit && (
        <FormSection title="Reminders" subtitle="Get notified before this event" defaultOpen={false}>
          <ReminderSection eventId={eventId} startTime={startTime} endTime={endTime} colors={colors} />
        </FormSection>
      )}




      <FormSection title="Sub-tasks" subtitle={isEdit ? `${tasks.filter((t) => t.completed).length}/${tasks.length} complete` : (draftTasks.length > 0 ? `${draftTasks.length} added` : null)}>
        {isEdit ? (
          tasks.map((task) => (
            <View key={task.id} style={styles.taskRow}>
              <Switch value={task.completed} onValueChange={() => handleToggleTask(task)} />
              <Text style={{ flex: 1, color: colors.textPrimary, marginLeft: 8, textDecorationLine: task.completed ? 'line-through' : 'none' }}>
                {task.name}
              </Text>
              <TouchableOpacity onPress={() => handleDeleteTask(task)}>
                <Text style={{ color: colors.textMuted, fontSize: 18 }}>×</Text>
              </TouchableOpacity>
            </View>
          ))
        ) : (
          draftTasks.map((taskName, index) => (
            <View key={`${taskName}-${index}`} style={styles.taskRow}>
              <Text style={{ flex: 1, color: colors.textPrimary }}>{taskName}</Text>
              <TouchableOpacity onPress={() => removeDraftTask(index)}>
                <Text style={{ color: colors.textMuted, fontSize: 18 }}>×</Text>
              </TouchableOpacity>
            </View>
          ))
        )}



        <View style={styles.addTaskRow}>
          <TextInput
            value={newDraftTaskName}
            onChangeText={setNewDraftTaskName}
            placeholder="Add a sub-task"
            placeholderTextColor={colors.textMuted}
            style={[styles.taskInput, { borderColor: colors.borderDefault, color: colors.textPrimary, backgroundColor: colors.surface }]}
          />
          <TouchableOpacity
            onPress={isEdit ? handleAddExistingTask : addDraftTask}
            style={[styles.addBtn, { backgroundColor: colors.textPrimary }]}
          >
            <Text style={{ color: colors.surface, fontWeight: '700' }}>Add</Text>
          </TouchableOpacity>
        </View>
      </FormSection>




      <TouchableOpacity onPress={handleSave} style={[styles.saveBtn, { backgroundColor: colors.textPrimary }]}>
        <Text style={{ color: colors.surface, fontWeight: '700', textAlign: 'center' }}>Save</Text>
      </TouchableOpacity>




      {isEdit && (
        <TouchableOpacity onPress={handleDelete} style={[styles.deleteBtn, { backgroundColor: colors.accentDanger }]}>
          <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>Delete</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  )
}




// --- Recurrence ---
// Frequency and interval are unified into a single "Every [N] [unit]" row
// instead of a separate Daily/Weekly/Monthly picker above it, mirroring
// how the Reminders section pairs its amount input with a unit picker.
const RECURRENCE_UNITS = [
  { label: 'day(s)', value: 'daily' },
  { label: 'week(s)', value: 'weekly' },
  { label: 'month(s)', value: 'monthly' }
]



function RecurrenceSection({ eventId, colors }) {
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [frequency, setFrequency] = useState('weekly')
  const [interval, setIntervalValue] = useState('1')
  const [endMode, setEndMode] = useState('never')
  const [untilDate, setUntilDate] = useState(null)
  const [count, setCount] = useState('10')
  const [showUntilPicker, setShowUntilPicker] = useState(false)
  const [saving, setSaving] = useState(false)



  useEffect(() => {
    fetchRecurrence(eventId)
      .then((rule) => {
        if (rule) {
          setEnabled(true)
          setFrequency(rule.frequency || 'weekly')
          setIntervalValue(String(rule.interval || 1))
          if (rule.until) {
            setEndMode('until')
            setUntilDate(new Date(rule.until))
          } else if (rule.count) {
            setEndMode('count')
            setCount(String(rule.count))
          } else {
            setEndMode('never')
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [eventId])



  async function handleToggleEnabled(next) {
    setEnabled(next)
    if (!next) {
      setSaving(true)
      try {
        await deleteRecurrence(eventId)
      } catch (err) {
        Alert.alert('Error', 'Failed to remove recurrence')
      } finally {
        setSaving(false)
      }
    }
  }



  function openUntilPicker() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: untilDate || new Date(),
        mode: 'date',
        minimumDate: new Date(),
        onChange: (event, date) => {
          if (event.type === 'set' && date) setUntilDate(date)
        }
      })
    } else {
      setShowUntilPicker(true)
    }
  }



  async function handleSaveRecurrence() {
    const intervalNum = parseInt(interval, 10)
    if (!intervalNum || intervalNum < 1) {
      Alert.alert('Invalid interval', 'Repeat interval must be at least 1')
      return
    }
    if (endMode === 'until' && !untilDate) {
      Alert.alert('Missing end date', 'Pick an end date or choose a different end condition')
      return
    }
    const countNum = endMode === 'count' ? parseInt(count, 10) : null
    if (endMode === 'count' && (!countNum || countNum < 1)) {
      Alert.alert('Invalid count', 'Number of occurrences must be at least 1')
      return
    }



    setSaving(true)
    try {
      await setRecurrence(eventId, {
        frequency,
        interval: intervalNum,
        until: endMode === 'until' && untilDate ? untilDate.toISOString().slice(0, 10) : null,
        count: countNum
      })
      Alert.alert('Saved', 'Recurrence rule updated')
    } catch (err) {
      Alert.alert('Error', 'Failed to save recurrence')
    } finally {
      setSaving(false)
    }
  }



  if (loading) return null



  return (
    <View>
      <View style={styles.switchRow}>
        <Text style={{ color: colors.textSecondary }}>Enable</Text>
        <Switch value={enabled} onValueChange={handleToggleEnabled} disabled={saving} />
      </View>



      {enabled && (
        <>
          <View style={styles.customOffsetRow}>
            <Text style={{ color: colors.textSecondary }}>Every</Text>
            <TextInput
              value={interval}
              onChangeText={setIntervalValue}
              keyboardType="numeric"
              style={[styles.offsetAmountInput, { borderColor: colors.borderDefault, color: colors.textPrimary, backgroundColor: colors.surface }]}
            />
            <View style={[styles.offsetUnitPicker, { borderColor: colors.borderDefault, backgroundColor: colors.surface }]}>
              <Picker selectedValue={frequency} onValueChange={setFrequency} style={{ color: colors.textPrimary }}>
                {RECURRENCE_UNITS.map((u) => <Picker.Item key={u.value} label={u.label} value={u.value} />)}
              </Picker>
            </View>
          </View>



          <View style={styles.anchorRow}>
            {[
              { label: 'Never ends', value: 'never' },
              { label: 'Until date', value: 'until' },
              { label: 'Count', value: 'count' }
            ].map((opt) => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setEndMode(opt.value)}
                style={[
                  styles.anchorChip,
                  { borderColor: colors.borderDefault, backgroundColor: endMode === opt.value ? colors.accentPrimary : colors.surface }
                ]}
              >
                <Text style={{ color: endMode === opt.value ? colors.surface : colors.textPrimary, fontWeight: '600', fontSize: 12 }}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>



          {endMode === 'until' && (
            <TouchableOpacity
              onPress={openUntilPicker}
              style={[styles.input, { borderColor: colors.borderDefault, backgroundColor: colors.surface }]}
            >
              <Text style={{ color: colors.textPrimary }}>
                {untilDate ? `Ends: ${untilDate.toLocaleDateString()}` : 'Pick end date'}
              </Text>
            </TouchableOpacity>
          )}
          {Platform.OS === 'ios' && showUntilPicker && (
            <DateTimePicker
              value={untilDate || new Date()}
              mode="date"
              minimumDate={new Date()}
              onChange={(event, date) => {
                setShowUntilPicker(false)
                if (event.type === 'set' && date) setUntilDate(date)
              }}
            />
          )}



          {endMode === 'count' && (
            <View style={styles.customOffsetRow}>
              <Text style={{ color: colors.textSecondary }}>Stop after</Text>
              <TextInput
                value={count}
                onChangeText={setCount}
                keyboardType="numeric"
                style={[styles.offsetAmountInput, { borderColor: colors.borderDefault, color: colors.textPrimary, backgroundColor: colors.surface }]}
              />
              <Text style={{ color: colors.textSecondary }}>occurrences</Text>
            </View>
          )}



          <TouchableOpacity
            onPress={handleSaveRecurrence}
            disabled={saving}
            style={[styles.sectionSubmitBtn, { backgroundColor: colors.accentPrimary, opacity: saving ? 0.6 : 1, alignSelf: 'flex-start', paddingHorizontal: 16 }]}
          >
            <Text style={{ color: colors.surface, fontWeight: '700' }}>
              {saving ? 'Saving\u2026' : 'Save repeat rule'}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  )
}




// --- Reminders ---
// Reminders are split into two tabs (Quick / Custom) rather than stacking
// presets, custom offset, and exact date/time all in one scroll — mirrors
// the request to make this feel like two clear modes rather than one long
// form. An "Enable" toggle mirrors the Repeats section: off by default
// unless reminders already exist, matching the Repeats on/off pattern for
// visual consistency between the two sections.
const REMINDER_OFFSETS = [
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



function ReminderSection({ eventId, startTime, endTime, colors }) {
  const [reminders, setReminders] = useState([])
  const [enabled, setEnabled] = useState(false)
  const [tab, setTab] = useState('quick')
  const [showCustomPicker, setShowCustomPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [offsetAmount, setOffsetAmount] = useState('15')
  const [offsetUnitIndex, setOffsetUnitIndex] = useState(0)
  // Which event boundary the offsets below are relative to. Defaults to
  // 'start' (the common "remind me before this begins" case), but End is
  // only selectable when the event actually has an end time set.
  const [anchor, setAnchor] = useState('start')



  const anchorTime = anchor === 'end' && endTime ? endTime : startTime



  async function loadReminders() {
    try {
      const list = await fetchReminders(eventId)
      const active = list.filter((r) => !r.dismissed)
      setReminders(active)
      if (active.length > 0) setEnabled(true)
    } catch (err) {
      setReminders([])
    }
  }



  useEffect(() => {
    loadReminders()
  }, [eventId])



  async function handleToggleEnabled(next) {
    setEnabled(next)
    if (!next && reminders.length > 0) {
      setSaving(true)
      try {
        await Promise.all(reminders.map((r) => deleteReminder(r.id)))
        await loadReminders()
      } catch (err) {
        Alert.alert('Error', 'Failed to remove reminders')
      } finally {
        setSaving(false)
      }
    }
  }



  async function handleAddReminder(remindAt) {
    if (remindAt.getTime() <= Date.now()) {
      Alert.alert('Invalid time', 'Reminder time must be in the future')
      return
    }
    setSaving(true)
    try {
      await createReminder(eventId, { remind_at: remindAt.toISOString() })
      await loadReminders()
    } catch (err) {
      Alert.alert('Error', 'Failed to create reminder')
    } finally {
      setSaving(false)
    }
  }



  function handleOffsetPress(minutes) {
    const remindAt = new Date(anchorTime.getTime() - minutes * 60 * 1000)
    handleAddReminder(remindAt)
  }



  function handleCustomOffsetSubmit() {
    const amount = parseFloat(offsetAmount)
    if (!amount || amount <= 0) {
      Alert.alert('Invalid amount', 'Enter a number greater than 0')
      return
    }
    const minutesPerUnit = OFFSET_UNITS[offsetUnitIndex].minutesPerUnit
    const totalMinutes = amount * minutesPerUnit
    const remindAt = new Date(anchorTime.getTime() - totalMinutes * 60 * 1000)
    handleAddReminder(remindAt)
  }



  function openCustomPicker() {
    if (Platform.OS === 'android') {
      const now = new Date()
      DateTimePickerAndroid.open({
        value: now,
        mode: 'date',
        minimumDate: now,
        onChange: (event, date) => {
          if (event.type !== 'set' || !date) return
          DateTimePickerAndroid.open({
            value: date,
            mode: 'time',
            onChange: async (timeEvent, time) => {
              if (timeEvent.type !== 'set' || !time) return
              const combined = new Date(date)
              combined.setHours(time.getHours(), time.getMinutes(), 0, 0)
              await handleAddReminder(combined)
            }
          })
        }
      })
    } else {
      setShowCustomPicker(true)
    }
  }



  async function handleDeleteReminder(reminder) {
    try {
      await deleteReminder(reminder.id)
      await loadReminders()
    } catch (err) {
      Alert.alert('Error', 'Failed to delete reminder')
    }
  }



  return (
    <View>
      <View style={styles.switchRow}>
        <Text style={{ color: colors.textSecondary }}>Enable</Text>
        <Switch value={enabled} onValueChange={handleToggleEnabled} disabled={saving} />
      </View>



      {enabled && (
        <>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 10 }}>
            Start: {startTime.toLocaleString()}
            {endTime ? `  \u00b7  End: ${endTime.toLocaleString()}` : '  \u00b7  End: Not set'}
          </Text>



          {reminders.map((reminder) => (
            <View key={reminder.id} style={styles.taskRow}>
              <Text style={{ flex: 1, color: colors.textPrimary }}>
                {new Date(reminder.remind_at).toLocaleString()}
              </Text>
              <TouchableOpacity onPress={() => handleDeleteReminder(reminder)}>
                <Text style={{ color: colors.textMuted, fontSize: 18 }}>×</Text>
              </TouchableOpacity>
            </View>
          ))}



          <View style={styles.tabRow}>
            <TouchableOpacity
              onPress={() => setTab('quick')}
              style={[styles.tabBtn, { borderColor: colors.borderDefault, backgroundColor: tab === 'quick' ? colors.accentPrimary : colors.surface }]}
            >
              <Text style={{ color: tab === 'quick' ? colors.surface : colors.textPrimary, fontWeight: '700', fontSize: 13 }}>Quick</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTab('custom')}
              style={[styles.tabBtn, { borderColor: colors.borderDefault, backgroundColor: tab === 'custom' ? colors.accentPrimary : colors.surface }]}
            >
              <Text style={{ color: tab === 'custom' ? colors.surface : colors.textPrimary, fontWeight: '700', fontSize: 13 }}>Custom</Text>
            </TouchableOpacity>
          </View>



          {tab === 'quick' && (
            <>
              <View style={styles.anchorRow}>
                <TouchableOpacity
                  onPress={() => setAnchor('start')}
                  style={[
                    styles.anchorChip,
                    { borderColor: colors.borderDefault, backgroundColor: anchor === 'start' ? colors.accentPrimary : colors.surface }
                  ]}
                >
                  <Text style={{ color: anchor === 'start' ? colors.surface : colors.textPrimary, fontWeight: '600', fontSize: 12 }}>
                    Before start
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => endTime && setAnchor('end')}
                  disabled={!endTime}
                  style={[
                    styles.anchorChip,
                    {
                      borderColor: colors.borderDefault,
                      backgroundColor: anchor === 'end' ? colors.accentPrimary : colors.surface,
                      opacity: endTime ? 1 : 0.4
                    }
                  ]}
                >
                  <Text style={{ color: anchor === 'end' ? colors.surface : colors.textPrimary, fontWeight: '600', fontSize: 12 }}>
                    Before end{!endTime ? ' (no end time)' : ''}
                  </Text>
                </TouchableOpacity>
              </View>



              <View style={styles.offsetRow}>
                {REMINDER_OFFSETS.map((opt) => (
                  <TouchableOpacity
                    key={opt.minutes}
                    onPress={() => handleOffsetPress(opt.minutes)}
                    disabled={saving}
                    style={[styles.offsetChip, { borderColor: colors.borderDefault, backgroundColor: colors.surface, opacity: saving ? 0.6 : 1 }]}
                  >
                    <Text style={{ color: colors.textPrimary, fontSize: 12 }}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>



              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6 }}>
                Or set a custom amount before {anchor === 'end' ? 'end' : 'start'}:
              </Text>
              <View style={styles.customOffsetRow}>
                <TextInput
                  value={offsetAmount}
                  onChangeText={setOffsetAmount}
                  keyboardType="numeric"
                  placeholder="15"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.offsetAmountInput, { borderColor: colors.borderDefault, color: colors.textPrimary, backgroundColor: colors.surface }]}
                />
                <View style={[styles.offsetUnitPicker, { borderColor: colors.borderDefault, backgroundColor: colors.surface }]}>
                  <Picker
                    selectedValue={offsetUnitIndex}
                    onValueChange={setOffsetUnitIndex}
                    style={{ color: colors.textPrimary }}
                  >
                    {OFFSET_UNITS.map((unit, index) => (
                      <Picker.Item key={unit.label} label={unit.label} value={index} />
                    ))}
                  </Picker>
                </View>
              </View>


              <TouchableOpacity
                onPress={handleCustomOffsetSubmit}
                disabled={saving}
                style={[styles.sectionSubmitBtn, { backgroundColor: colors.accentPrimary, opacity: saving ? 0.6 : 1 }]}
              >
                <Text style={{ color: colors.surface, fontWeight: '700' }}>
                  {saving ? 'Setting\u2026' : 'Set custom reminder'}
                </Text>
              </TouchableOpacity>
            </>
          )}



          {tab === 'custom' && (
            <>
              <TouchableOpacity
                onPress={openCustomPicker}
                disabled={saving}
                style={[styles.sectionSubmitBtn, { backgroundColor: colors.accentPrimary, opacity: saving ? 0.6 : 1, alignSelf: 'flex-start', paddingHorizontal: 16 }]}
              >
                <Text style={{ color: colors.surface, fontWeight: '700' }}>
                  {saving ? 'Adding\u2026' : 'Pick date & time'}
                </Text>
              </TouchableOpacity>



              {Platform.OS === 'ios' && showCustomPicker && (
                <DateTimePicker
                  value={new Date(Date.now() + 15 * 60 * 1000)}
                  mode="datetime"
                  minimumDate={new Date()}
                  onChange={(event, date) => {
                    setShowCustomPicker(false)
                    if (event.type === 'set' && date) handleAddReminder(date)
                  }}
                />
              )}
            </>
          )}
        </>
      )}
    </View>
  )
}




const styles = StyleSheet.create({
  container: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 10 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  taskRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  addTaskRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  taskInput: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 8 },
  addBtn: { borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center' },
  saveBtn: { borderRadius: 8, padding: 12, marginBottom: 10 },
  deleteBtn: { borderRadius: 8, padding: 12 },
  anchorRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  anchorChip: { flex: 1, borderWidth: 1, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  offsetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  offsetChip: { borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12 },
  customOffsetRow: { flexDirection: 'row', gap: 8, marginBottom: 10, alignItems: 'center' },
  offsetAmountInput: { width: 60, borderWidth: 1, borderRadius: 8, padding: 8, textAlign: 'center' },
  offsetUnitPicker: { flex: 1, borderWidth: 1, borderRadius: 8 },
  sectionSubmitBtn: { borderRadius: 8, paddingVertical: 10, justifyContent: 'center', alignItems: 'center' },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tabBtn: { flex: 1, borderWidth: 1, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  parseBanner: { borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 10 }
})
