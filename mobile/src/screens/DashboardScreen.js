import React, { useCallback, useState } from 'react'
import { View, ScrollView, RefreshControl, StyleSheet, Text } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { getDashboardLanes } from '../../../shared/eventLogic'
import { fetchEvents, updateEvent } from '../api'
import { useThemeMode } from '../theme'
import CollapsibleSection from '../components/CollapsibleSection'
import EventListCard from '../components/EventListCard'


export default function DashboardScreen({ navigation }) {
  const { colors } = useThemeMode()
  const [events, setEvents] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)


  const loadEvents = useCallback(async () => {
    try {
      const list = await fetchEvents()
      setEvents(list)
      setErrorMessage(null)
    } catch (err) {
      console.error(err)
      setErrorMessage(err?.message || 'Failed to load events')
    }
  }, [])


  useFocusEffect(
    useCallback(() => {
      loadEvents()
    }, [loadEvents])
  )


  async function handleRefresh() {
    setRefreshing(true)
    await loadEvents()
    setRefreshing(false)
  }


  async function handleToggleCompleted(event) {
    try {
      await updateEvent(event.id, {
        name: event.name,
        description: event.description || null,
        start_time: event.start_time || null,
        end_time: event.end_time || null,
        category: event.category || null,
        requires_action: !!event.requires_action,
        completed: !event.completed
      })
      await loadEvents()
    } catch (err) {
      console.error(err)
    }
  }


  function openEvent(event) {
    navigation.navigate('EventDetail', { eventId: event.id })
  }


  const now = new Date()
  const lanes = getDashboardLanes(events, now)
  const previewCount = 4


  function renderLane(items) {
    return items.slice(0, previewCount).map((event) => (
      <EventListCard key={event.id} event={event} onPress={openEvent} onToggleCompleted={handleToggleCompleted} />
    ))
  }


  return (
    <ScrollView
      style={{ backgroundColor: colors.surfaceMuted }}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      {errorMessage && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>Couldn't load events: {errorMessage}</Text>
        </View>
      )}
      <CollapsibleSection title="Overdue" count={lanes.overdue.length} tone="danger" emptyText="Nothing overdue" defaultOpen hasItems={lanes.overdue.length > 0}>
        <View>{renderLane(lanes.overdue)}</View>
      </CollapsibleSection>
      <CollapsibleSection title="Due Today" count={lanes.today.length} tone="neutral" emptyText="Nothing due today" defaultOpen hasItems={lanes.today.length > 0}>
        <View>{renderLane(lanes.today)}</View>
      </CollapsibleSection>
      <CollapsibleSection title="Upcoming" count={lanes.upcoming.length} tone="neutral" emptyText="Nothing upcoming" defaultOpen={false} hasItems={lanes.upcoming.length > 0}>
        <View>{renderLane(lanes.upcoming)}</View>
      </CollapsibleSection>
      <CollapsibleSection title="Active Events" count={lanes.active.length} tone="muted" emptyText="No active events" defaultOpen={false} hasItems={lanes.active.length > 0}>
        <View>{renderLane(lanes.active)}</View>
      </CollapsibleSection>
    </ScrollView>
  )
}


const styles = StyleSheet.create({
  container: { padding: 16 },
  errorBanner: { backgroundColor: '#fee2e2', borderRadius: 8, padding: 12, marginBottom: 12 },
  errorText: { color: '#991b1b', fontWeight: '600' }
})
