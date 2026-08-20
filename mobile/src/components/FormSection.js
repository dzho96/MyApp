import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useThemeMode } from '../theme'


// A lighter sibling of CollapsibleSection for form-style groupings (e.g.
// "Repeats", "Reminders") rather than list-style groupings (e.g.
// "Overdue", "Due Today"). CollapsibleSection always shows a numeric count
// badge and an empty-state text, which doesn't map cleanly onto a toggle-
// driven settings section — this component keeps the same bordered-card
// visual language (for consistency with the rest of the app) without
// forcing those list-specific pieces.
export default function FormSection({ title, subtitle, defaultOpen = true, children }) {
  const { colors } = useThemeMode()
  const [open, setOpen] = useState(defaultOpen)

  return (
    <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.borderDefault }]}>
      <TouchableOpacity style={styles.header} onPress={() => setOpen((prev) => !prev)}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
        </View>
        <Text style={{ color: colors.textMuted, marginLeft: 8 }}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && <View style={styles.body}>{children}</View>}
    </View>
  )
}


const styles = StyleSheet.create({
  section: { borderWidth: 1, borderRadius: 12, marginBottom: 14, overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  title: { fontWeight: '700', fontSize: 15 },
  subtitle: { fontSize: 12, marginTop: 2 },
  body: { paddingHorizontal: 16, paddingBottom: 16 }
})
