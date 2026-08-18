import React, { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, StyleSheet, Switch, Platform } from 'react-native'
import { Picker } from '@react-native-picker/picker'
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { CATEGORIES } from '../../../shared/eventLogic'
import { fetchEvents, createEvent, updateEvent, deleteEvent } from '../api'
import { fetchEventTasks, createEventTask, updateEventTask, deleteEventTask } from '../tasksApi'
import { useThemeMode } from '../theme'


export default function EventDetailScreen({ route, navigation }) {
  const { colors } = useThemeMode()
  const eventId = route.params?.eventId ?? null
  const isEdit = eventId !== null


  const [loading, setLoading] = useState(isEdit)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startTime, setStartTime] = useState(new Date())
  const [endTime, setEndTime] = useState(null)
  const [category, setCategory] = useState('')
  const [requiresAction, setRequiresAction] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [showStartPicker, setShowStartPicker] = useState(false)
  const [showEndPicker, setShowEndPicker] = useState(false)


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


      <Text style={{ fontWeight: '700', fontSize: 13, color: colors.textSecondary, marginBottom: 8, marginTop: 8 }}>
        Sub-tasks {isEdit ? `(${tasks.filter((t) => t.completed).length}/${tasks.length})` : (draftTasks.length > 0 ? `(${draftTasks.length})` : '')}
      </Text>


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


const styles = StyleSheet.create({
  container: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 10 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  taskRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  addTaskRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  taskInput: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 8 },
  addBtn: { borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center' },
  saveBtn: { borderRadius: 8, padding: 12, marginBottom: 10 },
  deleteBtn: { borderRadius: 8, padding: 12 }
})
