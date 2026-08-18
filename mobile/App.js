import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { TouchableOpacity, Text } from 'react-native'
import { ThemeProvider, useThemeMode } from './src/theme'
import DashboardScreen from './src/screens/DashboardScreen'
import CalendarScreen from './src/screens/CalendarScreen'
import EventDetailScreen from './src/screens/EventDetailScreen'

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
      <Text style={{ color: colors.textPrimary }}>{mode === 'dark' ? '☀️' : '🌙'}</Text>
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

export default function App() {
  return (
    <ThemeProvider>
      <NavigationContainer>
        <Tabs />
      </NavigationContainer>
    </ThemeProvider>
  )
}
