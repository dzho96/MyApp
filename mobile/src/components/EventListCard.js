import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { getCategoryColor } from '../../../shared/eventLogic'
import { fetchEventTasks } from '../tasksApi'
import { useThemeMode } from '../theme'


function formatDateTime(dateString) {
  if (!dateString) return 'Not set'
  const d = new Date(dateString)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}


function OutstandingTasks({ eventId, taskCount, colors }) {
  const [tasks, setTasks] = useState(null)


  useEffect(() => {
    if (!taskCount) return
    fetchEventTasks(eventId).then(setTasks).catch(() => setTasks([]))
  }, [eventId, taskCount])


  if (!taskCount) return null
  if (tasks === null) {
    return <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 6 }}>Loading tasks...</Text>
  }


  const outstanding = tasks.filter((t) => !t.completed)
  if (outstanding.length === 0) {
    return <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 6 }}>All sub-tasks complete.</Text>
  }


  return (
    <View style={{ marginTop: 6 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginBottom: 4 }}>
        Outstanding
      </Text>
      {outstanding.map((task) => (
        <View key={task.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.textMuted, marginRight: 6 }} />
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>{task.name}</Text>
        </View>
      ))}
    </View>
  )
}


export default function EventListCard({ event, onPress, onToggleCompleted }) {
  const { mode, colors } = useThemeMode()
  const hasSubtasks = event.task_count > 0
  const categoryColor = getCategoryColor(event.category, mode)


  return (
    <TouchableOpacity
      onPress={() => onPress(event)}
      style={[styles.card, { backgroundColor: colors.surfaceMuted, borderLeftColor: categoryColor }]}
    >
      <View style={styles.topRow}>
        <View style={styles.nameRow}>
          <View style={[styles.dot, { backgroundColor: categoryColor }]} />
          <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>{event.name}</Text>
          {event.isRecurringInstance && (
            <Text style={[styles.recurringIcon, { color: colors.textMuted }]} accessibilityLabel="Repeating event">↻</Text>
          )}
          {hasSubtasks && (
            <Text style={[styles.badge, { color: colors.textSecondary, borderColor: colors.borderDefault, backgroundColor: colors.surface }]}>
              {event.completed_task_count}/{event.task_count}
            </Text>
          )}
        </View>
        {event.requires_action && (
          hasSubtasks ? (
            <TouchableOpacity onPress={() => onPress(event)} style={[styles.actionBtn, { borderColor: colors.borderDefault, backgroundColor: colors.surface }]}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Open checklist</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => onToggleCompleted(event)}
              style={[styles.actionBtn, { borderColor: colors.borderDefault, backgroundColor: event.completed ? colors.textPrimary : colors.surface }]}
            >
              <Text style={{ color: event.completed ? colors.surface : colors.textPrimary, fontSize: 12 }}>
                {event.completed ? 'Done' : 'Mark done'}
              </Text>
            </TouchableOpacity>
          )
        )}
      </View>


      <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
        {(event.category || 'uncategorized')} &middot; Start: {formatDateTime(event.start_time)} &middot; End: {formatDateTime(event.end_time)}
      </Text>


      {event.description && (
        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 6 }} numberOfLines={2}>
          {event.description}
        </Text>
      )}


      <OutstandingTasks eventId={event.id} taskCount={event.task_count} colors={colors} />
    </TouchableOpacity>
  )
}


const styles = StyleSheet.create({
  card: { borderRadius: 8, borderLeftWidth: 4, padding: 10, marginBottom: 8 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  name: { fontWeight: '700', fontSize: 14, flexShrink: 1 },
  recurringIcon: { fontSize: 13, marginLeft: 4 },
  badge: { fontSize: 11, fontWeight: '700', borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1, marginLeft: 6, overflow: 'hidden' },
  actionBtn: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }
})
