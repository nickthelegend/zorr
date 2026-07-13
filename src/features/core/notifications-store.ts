import * as SecureStore from 'expo-secure-store'
import { useSyncExternalStore } from 'react'

import { blastNotification } from './push'

export type NoteKind = 'capture' | 'guardian' | 'wager' | 'swap' | 'system'
export type Note = { id: string; title: string; body: string; kind: NoteKind; ts: number; read: boolean }

const KEY = 'zorr.notes'
const MAX = 20
let notes: Note[] = []
let loaded = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function persist() {
  SecureStore.setItemAsync(KEY, JSON.stringify(notes)).catch(() => {})
}

async function load() {
  if (loaded) return
  loaded = true
  try {
    const raw = await SecureStore.getItemAsync(KEY)
    if (raw) {
      notes = JSON.parse(raw)
      emit()
    }
  } catch {
    /* ignore */
  }
}
load()

/** Record an in-app notification and (unless notify:false) fire an OS one too. */
export function pushNote(n: { title: string; body: string; kind: NoteKind; notify?: boolean }) {
  const note: Note = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: n.title,
    body: n.body,
    kind: n.kind,
    ts: Date.now(),
    read: false,
  }
  notes = [note, ...notes].slice(0, MAX)
  persist()
  emit()
  if (n.notify !== false) blastNotification(n.title, n.body)
}

export function markAllRead() {
  if (!notes.some((x) => !x.read)) return
  notes = notes.map((x) => ({ ...x, read: true }))
  persist()
  emit()
}

export function clearNotes() {
  notes = []
  persist()
  emit()
}

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
const getSnapshot = () => notes

/** Live in-app notifications + unread count. */
export function useNotifications() {
  const list = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return { notes: list, unread: list.filter((n) => !n.read).length }
}
