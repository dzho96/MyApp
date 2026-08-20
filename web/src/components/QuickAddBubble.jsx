import React, { useState } from 'react'
import { parseQuickAddText } from '../../../shared/quickAddParser'

function toLocalInputValue(date) {
  if (!date) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function QuickAddBubble({ onParsed, disabled }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')

  function handleParse() {
    const draft = parseQuickAddText(text)

    onParsed({
      name: draft.name,
      startTime: toLocalInputValue(draft.startTime),
      endTime: draft.endTime ? toLocalInputValue(draft.endTime) : '',
      recurrence: draft.recurrence,
      reminders: draft.reminders,
      parseNotes: draft.parseNotes
    })

    setOpen(false)
    setText('')
  }

  if (disabled) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={styles.bubble}
        aria-label="Quick add event"
      >
        💬
      </button>

      {open && (
        <div style={styles.overlay} onClick={() => setOpen(false)}>
          <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.title}>Quick Add</h3>
            <p style={styles.subtitle}>
              Type what you want scheduled, e.g. "Team sync every Friday at 3pm"
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type an event..."
              style={styles.textarea}
              autoFocus
            />
            <div style={styles.row}>
              <button onClick={() => setOpen(false)} style={styles.cancelBtn}>
                Cancel
              </button>
              <button
                onClick={handleParse}
                disabled={!text.trim()}
                style={{ ...styles.parseBtn, opacity: text.trim() ? 1 : 0.5 }}
              >
                Parse
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const styles = {
  bubble: {
    position: 'fixed',
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: '50%',
    border: 'none',
    backgroundColor: 'var(--accent-primary)',
    color: '#fff',
    fontSize: 22,
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
    zIndex: 999
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'var(--modal-overlay)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 1000
  },
  sheet: {
    backgroundColor: 'var(--surface)',
    borderRadius: '16px 16px 0 0',
    padding: 20,
    width: '100%',
    maxWidth: 480,
    boxShadow: '0 -4px 16px rgba(0,0,0,0.15)'
  },
  title: { margin: 0, marginBottom: 4, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' },
  subtitle: { margin: 0, marginBottom: 12, fontSize: 13, color: 'var(--text-secondary)' },
  textarea: {
    width: '100%',
    minHeight: 70,
    borderRadius: 10,
    border: '1px solid var(--border-default)',
    padding: 12,
    fontSize: 15,
    fontFamily: 'inherit',
    resize: 'vertical',
    boxSizing: 'border-box',
    background: 'var(--surface)',
    color: 'var(--text-primary)'
  },
  row: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  cancelBtn: {
    padding: '10px 18px',
    borderRadius: 8,
    border: '1px solid var(--border-default)',
    backgroundColor: 'transparent',
    color: 'var(--text-primary)',
    cursor: 'pointer'
  },
  parseBtn: {
    padding: '10px 18px',
    borderRadius: 8,
    border: 'none',
    backgroundColor: 'var(--accent-primary)',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer'
  }
}
