import { actionCosts, BUDGET, eligibleTargets, HORIZON, simulate, spent } from './engine'
import { getScenario, scenarios } from './scenarios'
import type { ActionKind, Intervention, ScenarioFile } from './types'
export function validateFile(input: unknown): ScenarioFile {
  if (!input || typeof input !== 'object') throw new Error('Expected a CrisisOS scenario object.')
  const data = input as Record<string, unknown>
  if (data.version !== 1) throw new Error('Unsupported scenario version. Expected version 1.')
  if (typeof data.scenario !== 'string' || !scenarios.some((s) => s.id === data.scenario))
    throw new Error('Unknown scenario. Choose one of the three installed presets.')
  if (!Number.isInteger(data.seed) || Number(data.seed) < 0 || Number(data.seed) > 4294967295)
    throw new Error('Seed must be an integer between 0 and 4294967295.')
  if (!Array.isArray(data.actions) || data.actions.length > BUDGET)
    throw new Error('Actions must be an array of at most six interventions.')
  const actions: Intervention[] = []
  for (const raw of data.actions) {
    if (!raw || typeof raw !== 'object') throw new Error('Invalid intervention.')
    const a = raw as Record<string, unknown>
    if (typeof a.kind !== 'string' || !Object.hasOwn(actionCosts, a.kind))
      throw new Error('Unknown intervention type.')
    if (
      typeof a.id !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,64}$/.test(a.id) ||
      actions.some((x) => x.id === a.id)
    )
      throw new Error(
        'Intervention IDs must be unique and contain only letters, numbers, hyphens, or underscores.',
      )
    if (
      typeof a.target !== 'string' ||
      !Number.isInteger(a.tick) ||
      Number(a.tick) < 1 ||
      Number(a.tick) > HORIZON - (a.kind === 'restore' ? 1 : 0)
    )
      throw new Error('Invalid intervention target or time.')
    if (actions.length && Number(a.tick) < actions[actions.length - 1].tick)
      throw new Error('Interventions must be ordered by time.')
    const kind = a.kind as ActionKind
    const before = simulate(
      getScenario(data.scenario),
      Number(data.seed),
      actions,
      Number(a.tick) - 1,
    ).at(-1)!
    if (!eligibleTargets(kind, before, actions).some((t) => t.id === a.target))
      throw new Error(
        'This intervention targets an unavailable asset or duplicates an existing response.',
      )
    actions.push({ id: a.id, kind, target: a.target, tick: Number(a.tick) })
  }
  if (spent(actions) > BUDGET)
    throw new Error('This response exceeds the six-unit resource budget.')
  return { version: 1, scenario: data.scenario, seed: Number(data.seed), actions }
}
export function readUrl(search: string): { config: ScenarioFile; warning: string } {
  const params = new URLSearchParams(search)
  const fallback: ScenarioFile = { version: 1, scenario: 'blackout', seed: 2049, actions: [] }
  if (!params.size) return { config: fallback, warning: '' }
  try {
    const scenario = params.get('scenario') ?? 'blackout'
    const rawSeed = params.get('seed')
    if (rawSeed !== null && !/^\d+$/.test(rawSeed))
      throw new Error('URL seed must be a nonnegative integer.')
    const seed = rawSeed === null ? getScenario(scenario).seed : Number(rawSeed)
    const encoded = params.get('plan')
    if (encoded && encoded.length > 12000) throw new Error('Shared response is too large.')
    const actions = encoded ? JSON.parse(atob(encoded)) : []
    return { config: validateFile({ version: 1, scenario, seed, actions }), warning: '' }
  } catch (e) {
    return {
      config: fallback,
      warning: `Could not load shared scenario: ${(e as Error).message} Loaded the default scenario.`,
    }
  }
}
export function shareUrl(config: ScenarioFile, href: string): string {
  const url = new URL(href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('scenario', config.scenario)
  url.searchParams.set('seed', String(config.seed))
  if (config.actions.length) url.searchParams.set('plan', btoa(JSON.stringify(config.actions)))
  return url.toString()
}
