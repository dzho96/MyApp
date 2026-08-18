import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useThemeMode } from '../theme'

const TONE_KEYS = {
  danger: { border: 'dangerBorder', header: 'dangerText', badgeBg: 'dangerBg' },
  neutral: { border: 'borderDefault', header: 'textPrimary', badgeBg: 'surfaceMuted' },
  muted: { border: 'borderDefault', header: 'textSecondary', badgeBg: 'surfaceMuted' }
}

export default function CollapsibleSection({ title, count, tone = 'neutral', emptyText, defaultOpen, hasItems, children }) {
  const { colors } = useThemeMode()
  const [open, setOpen] = useState(defaultOpen && hasItems)

  useEffect(() => {
    setOpen(defaultOpen && hasItems)
  }, [hasItems, defaultOpen])

  const toneKey = TONE_KEYS[tone] || TONE_KEYS.neutral
  const borderColor = colors[toneKey.border]
  const headerColor = colors[toneKey.header]
  const badgeBg = colors[toneKey.badgeBg]

  return (
    <View style={[styles.section, { backgroundColor: colors.surface, borderColor }]}>
      <TouchableOpacity style={styles.header} onPress={() => setOpen((prev) => !prev)}>
        <Text style={[styles.title, { color: headerColor }]}>{title}</Text>
        <View style={styles.headerRight}>
          <Text style={[styles.badge, { color: headerColor, backgroundColor: badgeBg }]}>{count}</Text>
          <Text style={{ color: colors.textMuted, marginLeft: 8 }}>{open ? '▲' : '▼'}</Text>
        </View>
      </TouchableOpacity>
      {open && (
        <View style={styles.body}>
          {hasItems ? children : <Text style={{ color: colors.textMuted, fontSize: 13 }}>{emptyText}</Text>}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  section: { borderWidth: 1, borderRadius: 12, marginBottom: 14, overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  title: { fontWeight: '700', fontSize: 16 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  badge: { fontSize: 13, fontWeight: '700', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2, overflow: 'hidden' },
  body: { paddingHorizontal: 16, paddingBottom: 16 }
})
