import { districts, hospitals, population, roads, stations } from './city'
import type { ActionKind, CityEvent, Intervention, Scenario, Snapshot } from './types'
export const HORIZON = 36
export const BUDGET = 6
export const actionCosts: Record<ActionKind, number> = { restore: 2, reroute: 1, shelter: 1 }
export const actionNames: Record<ActionKind, string> = {
  restore: 'Restore substation',
  reroute: 'Reroute traffic',
  shelter: 'Open emergency shelter',
}
export function noise(seed: number, tick: number, key: string): number {
  let h = (seed ^ Math.imul(tick + 1, 2654435761)) >>> 0
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0
  h ^= h >>> 16
  h = Math.imul(h, 2246822507) >>> 0
  h ^= h >>> 13
  return (h >>> 0) / 4294967296
}
const clamp = (x: number, min = 0, max = 100) => Math.max(min, Math.min(max, x))
export const spent = (actions: Intervention[]) =>
  actions.reduce((n, a) => n + actionCosts[a.kind], 0)
export function eligibleTargets(
  kind: ActionKind,
  state: Snapshot,
  actions: Intervention[],
): { id: string; name: string }[] {
  const taken = (id: string) => actions.some((a) => a.kind === kind && a.target === id)
  if (kind === 'restore')
    return stations.filter((s) => !state.stations[s.id].online && !taken(s.id))
  if (kind === 'reroute') return roads.filter((r) => !taken(r.id))
  return districts.filter((d) => !taken(d.id))
}
export function simulate(
  scenario: Scenario,
  seed: number,
  actions: Intervention[] = [],
  until = HORIZON,
): Snapshot[] {
  let state: Snapshot = {
    tick: 0,
    stations: Object.fromEntries(
      stations.map((s) => [
        s.id,
        { online: !scenario.initialFailures.includes(s.id), stress: 0, reinforced: false },
      ]),
    ),
    districts: {},
    roads: {},
    hospitals: Object.fromEntries(
      hospitals.map((h) => [h.id, { backup: 100, pressure: 35, powered: true }]),
    ),
    metrics: { power: 100, affected: 0, pressure: 35, delay: 0, sheltered: 0, resilience: 100 },
    events: [],
  }
  const snapshots: Snapshot[] = []
  const emit = (kind: CityEvent['kind'], title: string, detail: string, key: string) =>
    state.events.push({ id: `${state.tick}-${kind}-${key}`, tick: state.tick, kind, title, detail })
  for (let tick = 0; tick <= Math.min(HORIZON, Math.max(0, until)); tick++) {
    state = structuredClone(state)
    state.tick = tick
    if (tick === 0)
      for (const id of scenario.initialFailures)
        emit(
          'outage',
          `${stations.find((s) => s.id === id)!.name} offline`,
          'Transformer protection tripped. Local districts have lost grid power.',
          id,
        )
    if (tick > 0) {
      // Restorations complete after two steps and stabilize the repaired station.
      for (const a of actions.filter((a) => a.kind === 'restore' && a.tick + 1 === tick)) {
        state.stations[a.target] = { online: true, stress: 0, reinforced: true }
        emit(
          'restore',
          `${stations.find((s) => s.id === a.target)!.name} restored`,
          'Repair complete. Grid supply restored and protection reinforced.',
          a.target,
        )
      }
      const previous = structuredClone(state.stations)
      for (const s of stations) {
        const cur = state.stations[s.id]
        if (!cur.online || cur.reinforced) continue
        const neighborsDown = s.neighbors.filter((n) => !previous[n].online).length
        cur.stress = clamp(
          cur.stress +
            (neighborsDown
              ? neighborsDown * scenario.demand * (4 + noise(seed, tick, s.id) * 2)
              : -6),
        )
        if (cur.stress >= scenario.cascadeThreshold) {
          cur.online = false
          emit(
            'cascade',
            `${s.name} overloaded`,
            'Load transferred from failed neighbors exceeded the protection threshold.',
            s.id,
          )
        }
      }
    }
    for (const a of actions.filter((a) => a.tick === tick && a.kind !== 'restore')) {
      if (a.kind === 'reroute')
        emit(
          'reroute',
          `${roads.find((r) => r.id === a.target)!.name} rerouted`,
          'Priority lanes activated. Congestion reduced by 45 points.',
          a.target,
        )
      else
        emit(
          'shelter',
          `${districts.find((d) => d.id === a.target)!.name} shelter open`,
          'A local refuge now supports up to 3,000 displaced residents.',
          a.target,
        )
    }
    for (const d of districts) {
      const powered = state.stations[d.station].online
      const displaced = powered ? 0 : Math.round(d.population * Math.min(0.24, 0.06 + tick * 0.008))
      const shelter = actions.find(
        (a) => a.kind === 'shelter' && a.target === d.id && a.tick <= tick,
      )
      const sheltered = shelter ? Math.min(displaced, 3000, (tick - shelter.tick + 1) * 750) : 0
      state.districts[d.id] = { powered, displaced, sheltered }
    }
    for (const r of roads) {
      const failures =
        Number(!state.districts[r.from].powered) + Number(!state.districts[r.to].powered)
      const rerouted = actions.some(
        (a) => a.kind === 'reroute' && a.target === r.id && a.tick <= tick,
      )
      const congestion = Math.round(
        clamp(
          scenario.trafficBase + failures * 26 + noise(seed, tick, r.id) * 8 - (rerouted ? 45 : 0),
        ),
      )
      state.roads[r.id] = { congestion, rerouted }
    }
    for (const h of hospitals) {
      const district = state.districts[h.district]
      const prev = state.hospitals[h.id]
      const backup = district.powered
        ? Math.min(100, prev.backup + (tick > 0 ? 12 : 0))
        : Math.max(0, prev.backup - (tick > 0 ? scenario.backupDrain : 0))
      const connections = roads.filter((r) => r.from === h.district || r.to === h.district)
      const congestion =
        connections.reduce((n, r) => n + state.roads[r.id].congestion, 0) / connections.length
      const pressure = Math.round(
        clamp(
          30 +
            congestion * 0.45 +
            (district.displaced - district.sheltered) / 180 +
            (!district.powered ? 13 : 0) +
            (backup === 0 ? 20 : 0),
        ),
      )
      state.hospitals[h.id] = { backup, pressure, powered: district.powered || backup > 0 }
      if (prev.backup > 25 && backup <= 25)
        emit(
          'backup',
          `${h.name}: reserve low`,
          `${backup}% battery remaining. Restore district power to recharge.`,
          h.id,
        )
      if (prev.pressure < 85 && pressure >= 85)
        emit(
          'capacity',
          `${h.name} under strain`,
          'Capacity pressure has reached 85%. Traffic relief or a shelter can reduce demand.',
          h.id,
        )
    }
    const affected = districts.reduce(
      (n, d) => n + (state.districts[d.id].powered ? 0 : d.population),
      0,
    )
    const power = Math.round((1 - affected / population) * 100)
    const pressure = Math.round(
      hospitals.reduce((n, h) => n + state.hospitals[h.id].pressure, 0) / hospitals.length,
    )
    const delay = Math.round(
      (roads.reduce((n, r) => n + state.roads[r.id].congestion, 0) / roads.length) * 0.4,
    )
    const sheltered = districts.reduce((n, d) => n + state.districts[d.id].sheltered, 0)
    state.metrics = {
      affected,
      power,
      pressure,
      delay,
      sheltered,
      resilience: Math.round(power * 0.6 + (100 - pressure) * 0.4),
    }
    snapshots.push(state)
  }
  return snapshots
}
export function timeLabel(tick: number) {
  return `${String(18 + Math.floor(tick / 6)).padStart(2, '0')}:${String((tick % 6) * 10).padStart(2, '0')}`
}
