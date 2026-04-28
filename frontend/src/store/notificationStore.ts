import { create } from 'zustand'
import type { Notification } from '../types'

interface NotificationStore {
  notifications: Notification[]
  unreadCount: number
  add: (n: Omit<Notification, 'id' | 'read' | 'created_at'>) => void
  markRead: (id: string) => void
  markAllRead: () => void
  remove: (id: string) => void
}

let _idCounter = 0

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,

  add: (n) => {
    const notification: Notification = {
      ...n,
      id: `notif-${++_idCounter}`,
      read: false,
      created_at: new Date().toISOString(),
    }
    const updated = [notification, ...get().notifications].slice(0, 50)
    set({
      notifications: updated,
      unreadCount: updated.filter((x) => !x.read).length,
    })
  },

  markRead: (id) => {
    const updated = get().notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    )
    set({ notifications: updated, unreadCount: updated.filter((x) => !x.read).length })
  },

  markAllRead: () => {
    set({
      notifications: get().notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })
  },

  remove: (id) => {
    const updated = get().notifications.filter((n) => n.id !== id)
    set({ notifications: updated, unreadCount: updated.filter((x) => !x.read).length })
  },
}))
