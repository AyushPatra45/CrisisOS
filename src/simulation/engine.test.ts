import { describe, expect, it } from 'vitest'
import { districts, hospitals, population, roads, stations } from './city'
import { BUDGET, eligibleTargets, HORIZON, noise, simulate, spent, timeLabel } from './engine'
import { scenarios } from './scenarios'
import type { Intervention } from './types'
const scenario = scenarios[0]
const action = (kind: Intervention['kind'], target: string, tick = 1): Intervention => ({
  id: `${kind}-${target}`,
  kind,
  target,
  tick,
})
describe('deterministic simulation', () => {
  it.each(scenarios)('repeats every snapshot for $id, with and without responses', (s) => {
    const plan = [
      action('restore', s.initialFailures[0]),
      action('reroute', 'r1'),
      action('shelter', 'oldtown'),
    ]
    expect(simulate(s, s.seed)).toEqual(simulate(s, s.seed))
    expect(simulate(s, s.seed, plan)).toEqual(simulate(s, s.seed, plan))
  })
  it('uses the seed and produces repeatable, bounded variation', () => {
    expect(simulate(scenario, 2049)).not.toEqual(simulate(scenario, 2050))
    expect(noise(2049, 5, 'west')).toBe(noise(2049, 5, 'west'))
    for (let i = 0; i < 100; i++) expect(noise(i, i, 'test')).toBeGreaterThanOrEqual(0)
    for (let i = 0; i < 100; i++) expect(noise(i, i, 'test')).toBeLessThan(1)
  })
  it('supports deterministic prefixes for seeking without mutating inputs or older snapshots', () => {
    const original = structuredClone(scenario),
      actions = [action('shelter', 'oldtown')],
      copy = structuredClone(actions)
    const full = simulate(scenario, 12, actions)
    expect(simulate(scenario, 12, actions, 12)).toEqual(full.slice(0, 13))
    expect(scenario).toEqual(original)
    expect(actions).toEqual(copy)
    full[HORIZON].stations.west.online = true
    expect(full[0].stations.west.online).toBe(false)
  })
})
describe('failure propagation', () => {
  it('starts with one offline substation and only its districts affected', () => {
    const s = simulate(scenario, scenario.seed, [], 0)[0]
    expect(s.stations.west.online).toBe(false)
    expect(stations.filter((x) => s.stations[x.id].online)).toHaveLength(3)
    expect(s.metrics.affected).toBe(31200)
    expect(s.districts.oldtown.powered).toBe(false)
    expect(s.districts.midtown.powered).toBe(true)
  })
  it('cascades only after accumulated neighboring stress reaches the threshold', () => {
    const history = simulate(scenario, scenario.seed)
    expect(history[1].stations.north.stress).toBeGreaterThanOrEqual(4)
    expect(history[1].stations.east.stress).toBe(0)
    const trip = history.find((s) => !s.stations.north.online)!
    expect(trip.stations.north.stress).toBeGreaterThanOrEqual(scenario.cascadeThreshold)
    expect(history[trip.tick - 1].stations.north.online).toBe(true)
    expect(history.at(-1)!.metrics.power).toBe(0)
  })
  it('depletes hospital batteries, reports low reserves once, and loses power at zero', () => {
    const history = simulate(scenario, scenario.seed)
    expect(history[0].hospitals.mercy.backup).toBe(100)
    expect(history[1].hospitals.mercy.backup).toBe(95)
    expect(history[20].hospitals.mercy.backup).toBe(0)
    expect(history[20].hospitals.mercy.powered).toBe(false)
    expect(
      history.at(-1)!.events.filter((e) => e.kind === 'backup' && e.id.endsWith('mercy')),
    ).toHaveLength(1)
  })
  it.each(scenarios)('keeps every $id snapshot within physical model bounds', (s) => {
    for (const frame of simulate(s, s.seed)) {
      expect(frame.metrics.affected).toBeGreaterThanOrEqual(0)
      expect(frame.metrics.affected).toBeLessThanOrEqual(population)
      for (const d of districts) {
        expect(frame.districts[d.id].sheltered).toBeLessThanOrEqual(frame.districts[d.id].displaced)
        expect(frame.districts[d.id].sheltered).toBeGreaterThanOrEqual(0)
      }
      for (const h of hospitals) {
        expect(frame.hospitals[h.id].backup).toBeGreaterThanOrEqual(0)
        expect(frame.hospitals[h.id].backup).toBeLessThanOrEqual(100)
        expect(frame.hospitals[h.id].pressure).toBeLessThanOrEqual(100)
      }
      for (const r of roads) {
        expect(frame.roads[r.id].congestion).toBeGreaterThanOrEqual(0)
        expect(frame.roads[r.id].congestion).toBeLessThanOrEqual(100)
      }
    }
  })
  it('provides three distinct starting conditions', () => {
    const starts = scenarios.map((s) => simulate(s, s.seed)[0])
    expect(new Set(starts.map((s) => s.metrics.affected)).size).toBe(3)
  })
})
describe('meaningful interventions', () => {
  it('restores power after two steps, reinforces the station, and prevents the early cascade', () => {
    const history = simulate(scenario, scenario.seed, [action('restore', 'west')])
    expect(history[1].stations.west.online).toBe(false)
    expect(history[2].stations.west.online).toBe(true)
    expect(history[2].stations.west.reinforced).toBe(true)
    expect(history[2].metrics.affected).toBe(0)
    expect(history.at(-1)!.metrics.power).toBe(100)
    expect(history[2].hospitals.mercy.backup).toBe(100)
    expect(history.at(-1)!.events.filter((e) => e.kind === 'restore')).toHaveLength(1)
  })
  it('reroutes only the target road and eases connected hospital pressure', () => {
    const baseline = simulate(scenario, scenario.seed),
      response = simulate(scenario, scenario.seed, [action('reroute', 'r1')])
    expect(response[0]).toEqual(baseline[0])
    expect(response[1].roads.r1.congestion).toBe(baseline[1].roads.r1.congestion - 45)
    expect(response[1].roads.r2).toEqual(baseline[1].roads.r2)
    expect(response[1].hospitals.mercy.pressure).toBeLessThan(baseline[1].hospitals.mercy.pressure)
    expect(response[HORIZON].metrics.delay).toBeLessThan(baseline[HORIZON].metrics.delay)
  })
  it('ramps shelter occupancy, caps it, and reduces local hospital demand', () => {
    const baseline = simulate(scenario, scenario.seed),
      response = simulate(scenario, scenario.seed, [action('shelter', 'oldtown')])
    expect(response[1].districts.oldtown.sheltered).toBe(750)
    expect(response[2].districts.oldtown.sheltered).toBe(1398)
    expect(response[HORIZON].districts.oldtown.sheltered).toBe(3000)
    expect(response[10].hospitals.mercy.pressure).toBeLessThan(
      baseline[10].hospitals.mercy.pressure,
    )
  })
  it('counts resources and excludes duplicate or already healthy restoration targets', () => {
    const plan = [action('restore', 'west'), action('reroute', 'r1'), action('shelter', 'oldtown')]
    expect(spent(plan)).toBe(4)
    expect(BUDGET - spent(plan)).toBe(2)
    expect(eligibleTargets('restore', simulate(scenario, 1)[0], plan)).toHaveLength(0)
    expect(
      eligibleTargets('reroute', simulate(scenario, 1)[0], plan).some((t) => t.id === 'r1'),
    ).toBe(false)
  })
  it('formats the full six-hour replay correctly', () => {
    expect(timeLabel(0)).toBe('18:00')
    expect(timeLabel(5)).toBe('18:50')
    expect(timeLabel(HORIZON)).toBe('24:00')
  })
})
