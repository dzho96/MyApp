import React, { useCallback, useMemo, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { getMonthGrid, getVisibleDayEvents, eventMatchesDate, startOfDay, getCategoryColor } from '../../../shared/eventLogic'
import { fetchEvents } from '../api'
import { useThemeMode } from '../theme'
import CollapsibleSection from '../components/CollapsibleSection'

function formatMonthYear(date) {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export default function CalendarScreen({ navigation }) {
  const { mode, colors } = useThemeMode()
  const [events, setEvents] = useState([])
  const [selectedDate, setSelectedDate] = useState(new Date())

  const loadEvents = useCallback(async () => {
    try {
      setEvents(await fetchEvents())
    } catch (err) {
      console.error(err)
    }
  }, [])

  useFocusEffect(useCallback(() => { loadEvents() }, [loadEvents]))

  const monthGrid = useMemo(() => getMonthGrid(selectedDate), [selectedDate])
  const selectedDayEvents = useMemo(() => getVisibleDayEvents(events, selectedDate), [events, selectedDate])

  function changeMonth(offset) {
    const next = new Date(selectedDate)
    next.setMonth(next.getMonth() + offset)
    setSelectedDate(next)
  }

  function openEvent(event) {
    navigation.navigate('EventDetail', { eventId: event.id })
  }

  const weeks = []
  for (let i = 0; i < monthGrid.length; i += 7) weeks.push(monthGrid.slice(i, i + 7))

  return (
    <ScrollView style={{ backgroundColor: colors.surfaceMuted }} contentContainerStyle={styles.container}>
      <View style={[styles.monthHeader, { backgroundColor: colors.surface, borderColor: colors.borderDefault }]}>
        <TouchableOpacity onPress={() => changeMonth(-1)}>
          <Text style={{ color: colors.textPrimary, fontSize: 16 }}>‹ Prev</Text>
        </TouchableOpacity>
        <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 16 }}>{formatMonthYear(selectedDate)}</Text>
        <TouchableOpacity onPress={() => changeMonth(1)}>
          <Text style={{ color: colors.textPrimary, fontSize: 16 }}>Next ›</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.grid, { backgroundColor: colors.surface, borderColor: colors.borderDefault }]}>
        {weeks.map((week, wi) => (
          <View key={wi} style={styles.weekRow}>
            {week.map((date) => {
              const isCurrentMonth = date.getMonth() === selectedDate.getMonth()
              const isSelected = startOfDay(date).getTime() === startOfDay(selectedDate).getTime()
              const dayEvents = events.filter((event) => eventMatchesDate(event, date))
              return (
                <TouchableOpacity
                  key={date.toISOString()}
                  onPress={() => setSelectedDate(date)}
                  style={[
                    styles.dayCell,
                    {
                      borderColor: isSelected ? colors.accentPrimary : colors.borderDefault,
                      borderWidth: isSelected ? 2 : 1,
                      backgroundColor: isCurrentMonth ? colors.surface : colors.surfaceMuted
                    }
                  ]}
                >
                  <Text style={{ color: isCurrentMonth ? colors.textPrimary : colors.textMuted, fontWeight: '700', fontSize: 12 }}>
                    {date.getDate()}
                  </Text>
                  {dayEvents.slice(0, 2).map((event) => (
                    <View key={event.id} style={[styles.eventDot, { backgroundColor: getCategoryColor(event.category, mode) }]} />
                  ))}
                </TouchableOpacity>
              )
            })}
          </View>
        ))}
      </View>

      <CollapsibleSection
        title={selectedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        count={selectedDayEvents.length}
        tone="neutral"
        emptyText="No events for this date."
        defaultOpen
        hasItems={selectedDayEvents.length > 0}
      >
        {selectedDayEvents.map((event) => (
          <TouchableOpacity key={event.id} onPress={() => openEvent(event)} style={[styles.dayEventRow, { backgroundColor: colors.surfaceMuted }]}>
            <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{event.name}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{event.category}</Text>
          </TouchableOpacity>
        ))}
      </CollapsibleSection>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  monthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderWidth: 1, borderRadius: 12, marginBottom: 12 },
  grid: { borderWidth: 1, borderRadius: 12, padding: 8, marginBottom: 16 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCell: { width: '13.5%', aspectRatio: 1, borderRadius: 6, padding: 4, marginVertical: 2 },
  eventDot: { width: 5, height: 5, borderRadius: 3, marginTop: 3 },
  dayEventRow: { borderRadius: 6, padding: 10, marginBottom: 6 }
})
