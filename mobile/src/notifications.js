// Local notification scheduling for reminders. Uses expo-notifications'
// on-device scheduler — no backend push service or server-side dispatch
// required, so this works fully offline once reminders are synced.
//
// Push notifications (remote, server-triggered) are unavailable in Expo Go
// on Android since SDK 53, but that limitation does not affect this module:
// everything here is a *local* (device-scheduled) notification, which
// Expo Go fully supports on both Android and iOS.

import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
})

// On Android 13+, the OS permission prompt for notifications will not
// reliably appear (and requestPermissionsAsync() can silently resolve to
// denied/no-op) unless a notification channel already exists. This must
// run BEFORE ensureNotificationPermission() is called — see
// setupNotificationCategories below, which does both in the right order.
async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync('reminders', {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default'
  })
}

export async function ensureNotificationPermission() {
  await ensureAndroidChannel()
  const settings = await Notifications.getPermissionsAsync()
  if (settings.granted) return true
  const request = await Notifications.requestPermissionsAsync()
  return !!request.granted
}

// Reminder -> scheduled local notification id is tracked by tagging the
// notification's data payload with the reminder id, then looking it up
// via getAllScheduledNotificationsAsync rather than keeping a separate
// id map in memory (which would not survive an app restart).
function reminderNotificationIdentifier(reminderId) {
  return `reminder-${reminderId}`
}

export async function scheduleReminderNotification(reminder, event) {
  if (reminder.completed || reminder.dismissed) return
  const remindAt = new Date(reminder.remind_at)
  if (remindAt.getTime() <= Date.now()) return

  const granted = await ensureNotificationPermission()
  if (!granted) return

  const identifier = reminderNotificationIdentifier(reminder.id)
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {})

  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: event?.name || 'Reminder',
      body: event?.description || 'This event needs your attention.',
      data: { reminderId: reminder.id, eventId: reminder.event_id },
      categoryIdentifier: 'reminder-actions'
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: remindAt,
      channelId: 'reminders'
    }
  })
}

export async function cancelReminderNotification(reminderId) {
  await Notifications.cancelScheduledNotificationAsync(
    reminderNotificationIdentifier(reminderId)
  ).catch(() => {})
}

// Re-syncs all scheduled notifications against the current set of
// reminders. Call this whenever reminders are fetched (app open, pull to
// refresh, after create/update/delete) so completed/dismissed/deleted
// reminders don't leave stale notifications behind, and new/updated ones
// get (re)scheduled.
export async function syncReminderNotifications(remindersWithEvents) {
  const granted = await ensureNotificationPermission()
  if (!granted) return

  const scheduled = await Notifications.getAllScheduledNotificationsAsync()
  const validIds = new Set(
    remindersWithEvents
      .filter((r) => !r.completed && !r.dismissed)
      .map((r) => reminderNotificationIdentifier(r.id))
  )

  for (const notification of scheduled) {
    if (
      notification.identifier?.startsWith('reminder-') &&
      !validIds.has(notification.identifier)
    ) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier).catch(() => {})
    }
  }

  for (const { reminder, event } of remindersWithEvents.map((r) => ({ reminder: r, event: r.event }))) {
    await scheduleReminderNotification(reminder, event)
  }
}

export async function setupNotificationCategories() {
  await ensureAndroidChannel()

  await Notifications.setNotificationCategoryAsync('reminder-actions', [
    { identifier: 'snooze-15', buttonTitle: 'Snooze 15m', options: { opensAppToForeground: false } },
    { identifier: 'snooze-60', buttonTitle: 'Snooze 1h', options: { opensAppToForeground: false } },
    { identifier: 'open', buttonTitle: 'Open', options: { opensAppToForeground: true } }
  ])
}
