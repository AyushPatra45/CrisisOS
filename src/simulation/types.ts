export type StationId = 'west' | 'north' | 'central' | 'east'
export type ActionKind = 'restore' | 'reroute' | 'shelter'
export interface Scenario {
  id: string
  name: string
  subtitle: string
  description: string
  initialFailures: StationId[]
  demand: number
  cascadeThreshold: number
  backupDrain: number
  trafficBase: number
  seed: number
}
export interface Intervention {
  id: string
  kind: ActionKind
  target: string
  tick: number
}
export interface Station {
  id: StationId
  name: string
  x: number
  y: number
  neighbors: StationId[]
}
export interface District {
  id: string
  name: string
  station: StationId
  population: number
  x: number
  y: number
}
export interface Road {
  id: string
  name: string
  from: string
  to: string
}
export interface Hospital {
  id: string
  name: string
  district: string
  x: number
  y: number
}
export type EventKind =
  'outage' | 'cascade' | 'restore' | 'reroute' | 'shelter' | 'backup' | 'capacity'
export interface CityEvent {
  id: string
  tick: number
  kind: EventKind
  title: string
  detail: string
}
export interface Snapshot {
  tick: number
  stations: Record<string, { online: boolean; stress: number; reinforced: boolean }>
  districts: Record<string, { powered: boolean; displaced: number; sheltered: number }>
  roads: Record<string, { congestion: number; rerouted: boolean }>
  hospitals: Record<string, { backup: number; pressure: number; powered: boolean }>
  metrics: {
    power: number
    affected: number
    pressure: number
    delay: number
    sheltered: number
    resilience: number
  }
  events: CityEvent[]
}
export interface ScenarioFile {
  version: 1
  scenario: string
  seed: number
  actions: Intervention[]
}
