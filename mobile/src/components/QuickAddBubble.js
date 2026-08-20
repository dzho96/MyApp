// mobile/src/components/QuickAddBubble.js
//
// Floating "PA" quick-add bubble. Persists across all tabs (mounted once
// in App.js, above <Tabs />, inside NavigationContainer).
//
// Tap the bubble -> modal with a text input -> "Parse" runs the free,
// offline chrono-node based parser (shared/quickAddParser.js) -> navigates
// to EventDetail with a pre-filled DRAFT (nothing is saved yet). The
// existing Save button on EventDetailScreen remains the one and only
// approval step.

import React, { useState } from 'react'
import { View, Modal, TouchableOpacity, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useThemeMode } from '../theme'
import { parseQuickAddText } from '../../../shared/quickAddParser'

export default function QuickAddBubble() {
  const { colors } = useThemeMode()
  const navigation = useNavigation()
  const [visible, setVisible] = useState(false)
  const [text, setText] = useState('')

  function handleOpen() {
    setText('')
    setVisible(true)
  }

  function handleClose() {
    setVisible(false)
  }

  function handleParse() {
    const draft = parseQuickAddText(text)
    setVisible(false)
    setText('')

    // Navigate into the Dashboard stack's EventDetail screen with a draft
    // payload. eventId stays null so EventDetailScreen treats this as a
    // new, unsaved event — user reviews/edits and taps Save to approve.
    navigation.navigate('DashboardTab', {
      screen: 'EventDetail',
      params: {
        eventId: null,
        draft: {
          name: draft.name,
          startTime: draft.startTime.toISOString(),
          endTime: draft.endTime ? draft.endTime.toISOString() : null,
          recurrence: draft.recurrence
        },
        parseNotes: draft.recurrence
          ? [...draft.parseNotes, 'Recurrence detected but not yet set — save this event first, then open "Repeats" below to configure it.']
          : draft.parseNotes
      }
    })
  }

  return (
    <>
      <TouchableOpacity
        onPress={handleOpen}
        style={[styles.bubble, { backgroundColor: colors.accentPrimary }]}
        activeOpacity={0.85}
      >
        <Text style={styles.bubbleIcon}>💬</Text>
      </TouchableOpacity>

      <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.overlay}
        >
          <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.borderDefault }]}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Quick Add</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Type what you want scheduled, e.g. "Team sync every Friday at 3pm"
            </Text>

            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Type an event..."
              placeholderTextColor={colors.textMuted}
              multiline
              autoFocus
              style={[
                styles.input,
                { color: colors.textPrimary, borderColor: colors.borderDefault, backgroundColor: colors.surfaceMuted }
              ]}
            />

            <View style={styles.row}>
              <TouchableOpacity onPress={handleClose} style={[styles.button, styles.cancelButton, { borderColor: colors.borderDefault }]}>
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleParse}
                disabled={!text.trim()}
                style={[
                  styles.button,
                  { backgroundColor: text.trim() ? colors.accentPrimary : colors.textMuted }
                ]}
              >
                <Text style={{ color: '#ffffff', fontWeight: '700' }}>Parse</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    right: 20,
    bottom: 90,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    zIndex: 999
  },
  bubbleIcon: {
    fontSize: 24
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end'
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    padding: 20,
    paddingBottom: 32
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4
  },
  subtitle: {
    fontSize: 13,
    marginBottom: 12
  },
  input: {
    minHeight: 70,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    textAlignVertical: 'top'
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 10
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8
  },
  cancelButton: {
    borderWidth: 1,
    backgroundColor: 'transparent'
  }
})
