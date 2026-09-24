import type { EventKind } from './types'
// Register an event's presentation here; emit it from engine.ts and add a rule test.
export const eventTypes: Record<
  EventKind,
  { label: string; tone: 'danger' | 'warning' | 'success' }
> = {
  outage: { label: 'Grid failure', tone: 'danger' },
  cascade: { label: 'Cascade', tone: 'danger' },
  restore: { label: 'Recovery', tone: 'success' },
  reroute: { label: 'Traffic response', tone: 'success' },
  shelter: { label: 'Civil response', tone: 'success' },
  backup: { label: 'Backup power', tone: 'warning' },
  capacity: { label: 'Hospital capacity', tone: 'warning' },
}
