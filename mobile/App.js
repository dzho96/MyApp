import React, { useEffect, useRef, useState } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { TouchableOpacity, Text } from 'react-native'
import * as Notifications from 'expo-notifications'
import { ThemeProvider, useThemeMode } from './src/theme'
import DashboardScreen from './src/screens/DashboardScreen'
import CalendarScreen from './src/screens/CalendarScreen'
import EventDetailScreen from './src/screens/EventDetailScreen'
import QuickAddBubble from './src/components/QuickAddBubble'
import { snoozeReminder } from './src/api'
import {
  ensureNotificationPermission,
  setupNotificationCategories,
  cancelReminderNotification,
  scheduleReminderNotification
} from './src/notifications'



const Tab = createBottomTabNavigator()
const DashboardStack = createNativeStackNavigator()
const CalendarStack = createNativeStackNavigator()



function HeaderAddButton({ navigation }) {
  const { colors } = useThemeMode()
  return (
    <TouchableOpacity onPress={() => navigation.navigate('EventDetail', { eventId: null })} style={{ marginRight: 12 }}>
      <Text style={{ color: colors.accentPrimary, fontWeight: '700' }}>+ Add</Text>
    </TouchableOpacity>
  )
}



function HeaderThemeToggle() {
  const { mode, toggleMode, colors } = useThemeMode()
  return (
    <TouchableOpacity onPress={toggleMode} style={{ marginLeft: 12 }}>
      <Text style={{ color: colors.textPrimary }}>{mode === 'dark' ? '\u2600\ufe0f' : '\ud83c\udf19'}</Text>
    </TouchableOpacity>
  )
}



function DashboardStackScreen() {
  const { colors } = useThemeMode()
  return (
    <DashboardStack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.textPrimary }}>
      <DashboardStack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={({ navigation }) => ({
          title: 'Schedule',
          headerLeft: () => <HeaderThemeToggle />,
          headerRight: () => <HeaderAddButton navigation={navigation} />
        })}
      />
      <DashboardStack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: 'Event' }} />
    </DashboardStack.Navigator>
  )
}



function CalendarStackScreen() {
  const { colors } = useThemeMode()
  return (
    <CalendarStack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.textPrimary }}>
      <CalendarStack.Screen
        name="Calendar"
        component={CalendarScreen}
        options={({ navigation }) => ({
          title: 'Calendar',
          headerRight: () => <HeaderAddButton navigation={navigation} />
        })}
      />
      <CalendarStack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: 'Event' }} />
    </CalendarStack.Navigator>
  )
}



function Tabs() {
  const { colors } = useThemeMode()
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accentPrimary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.borderDefault }
      }}
    >
      <Tab.Screen name="DashboardTab" component={DashboardStackScreen} options={{ title: 'Dashboard' }} />
      <Tab.Screen name="CalendarTab" component={CalendarStackScreen} options={{ title: 'Calendar' }} />
    </Tab.Navigator>
  )
}



// Handles taps on the Snooze 15m / Snooze 1h / Open notification action
// buttons (registered in setupNotificationCategories). Snoozing calls the
// backend, which dismisses the original reminder and inserts a new one
// with the updated remind_at — we then mirror that by cancelling the old
// local notification and scheduling a fresh one at the new time.
function useReminderNotificationResponses(navigationRef) {
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const { actionIdentifier, notification } = response
      const data = notification.request.content.data || {}
      const reminderId = data.reminderId


      if (!reminderId) return


      if (actionIdentifier === 'snooze-15' || actionIdentifier === 'snooze-60') {
        const minutes = actionIdentifier === 'snooze-15' ? 15 : 60
        try {
          const result = await snoozeReminder(reminderId, { minutes })
          await cancelReminderNotification(reminderId)
          if (result?.id && result?.remind_at) {
            await scheduleReminderNotification(
              { id: result.id, remind_at: result.remind_at },
              { name: notification.request.content.title, description: notification.request.content.body }
            )
          }
        } catch (e) {
          // Snooze failed server-side; leave original notification's fate
          // as-is rather than silently losing the reminder.
        }
        return
      }


      if (actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER || actionIdentifier === 'open') {
        if (data.eventId && navigationRef.current) {
          navigationRef.current.navigate('DashboardTab', {
            screen: 'EventDetail',
            params: { eventId: data.eventId }
          })
        }
      }
    })


    return () => subscription.remove()
  }, [navigationRef])
}



export default function App() {
  const navigationRef = useRef(null)
  // Tracked at this level (rather than via useNavigationState inside
  // QuickAddBubble) because QuickAddBubble is mounted as a SIBLING of
  // <Tabs />, not as a descendant inside a Tab/Stack Navigator's screen
  // tree. useNavigationState requires being inside a navigator's screen
  // tree to read state and throws "Couldn't get the navigation state. Is
  // your component inside a navigator?" when used from a position like
  // QuickAddBubble's. Tracking the active route name here via
  // onStateChange and passing it down as a plain prop avoids that entirely.
  const [activeRouteName, setActiveRouteName] = useState(null)


  function updateActiveRouteName() {
    setActiveRouteName(navigationRef.current?.getCurrentRoute()?.name ?? null)
  }


  useEffect(() => {
    async function initNotifications() {
      await setupNotificationCategories()
      await ensureNotificationPermission()
    }
    initNotifications()
  }, [])


  useReminderNotificationResponses(navigationRef)


  return (
    <ThemeProvider>
      <NavigationContainer
        ref={navigationRef}
        onReady={updateActiveRouteName}
        onStateChange={updateActiveRouteName}
      >
        <Tabs />
        <QuickAddBubble activeRouteName={activeRouteName} />
      </NavigationContainer>
    </ThemeProvider>
  )
}
