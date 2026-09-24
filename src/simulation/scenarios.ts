import type { Scenario } from './types'
export const scenarios: Scenario[] = [
  {
    id: 'blackout',
    name: 'The first domino',
    subtitle: 'Cascading blackout',
    description:
      'A transformer failure at Westhaven threatens the city grid. Contain the cascade before backup systems run dry.',
    initialFailures: ['west'],
    demand: 1,
    cascadeThreshold: 42,
    backupDrain: 5,
    trafficBase: 20,
    seed: 2049,
  },
  {
    id: 'heatwave',
    name: 'Heat under pressure',
    subtitle: 'Peak demand event',
    description:
      'A heatwave pushes demand to its limit. Civic Grid trips offline as hospitals face accelerated battery depletion.',
    initialFailures: ['central'],
    demand: 1.6,
    cascadeThreshold: 38,
    backupDrain: 8,
    trafficBase: 30,
    seed: 7201,
  },
  {
    id: 'double-fault',
    name: 'A city divided',
    subtitle: 'Dual station failure',
    description:
      'Simultaneous failures isolate Westhaven and Eastgate. Congested crossings complicate a response on two fronts.',
    initialFailures: ['west', 'east'],
    demand: 1.2,
    cascadeThreshold: 46,
    backupDrain: 6,
    trafficBase: 35,
    seed: 8192,
  },
]
export function getScenario(id: string): Scenario {
  return scenarios.find((s) => s.id === id) ?? scenarios[0]
}
