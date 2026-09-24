import { describe, expect, it } from 'vitest'
import { readUrl, shareUrl, validateFile } from './sharing'
import type { ScenarioFile } from './types'
const config: ScenarioFile = {
  version: 1,
  scenario: 'blackout',
  seed: 2049,
  actions: [
    { id: 'r-1', kind: 'reroute', target: 'r1', tick: 1 },
    { id: 's-1', kind: 'shelter', target: 'oldtown', tick: 2 },
    { id: 'p-1', kind: 'restore', target: 'west', tick: 4 },
  ],
}
describe('scenario sharing and validation', () => {
  it('round-trips a response through JSON and a subpath URL', () => {
    expect(validateFile(JSON.parse(JSON.stringify(config)))).toEqual(config)
    const url = new URL(shareUrl(config, 'https://example.com/CrisisOS/?old=1#main'))
    expect(url.pathname).toBe('/CrisisOS/')
    expect(url.hash).toBe('')
    expect(readUrl(url.search)).toEqual({ config, warning: '' })
  })
  it('loads plain scenario and seed links, including zero', () => {
    expect(readUrl('?scenario=heatwave&seed=0').config).toEqual({
      version: 1,
      scenario: 'heatwave',
      seed: 0,
      actions: [],
    })
  })
  it.each([
    '?scenario=unknown',
    '?seed=NaN',
    '?seed=',
    '?seed=-1',
    '?plan=invalid!',
    '?seed=4294967296',
  ])('safely recovers from malformed URL %s', (search) => {
    const result = readUrl(search)
    expect(result.warning).toContain('Could not load')
    expect(result.config.scenario).toBe('blackout')
  })
  it.each([
    null,
    [],
    { ...config, version: 2 },
    { ...config, seed: 1.5 },
    { ...config, actions: [{ ...config.actions[0], kind: '__proto__' }] },
    { ...config, actions: [{ ...config.actions[0], target: 'missing' }] },
    { ...config, actions: [{ ...config.actions[0], tick: 0 }] },
    { ...config, actions: [config.actions[0], config.actions[0]] },
    { ...config, actions: [...config.actions].reverse() },
  ])('rejects invalid configuration %#', (value) => expect(() => validateFile(value)).toThrow())
  it('rejects resource overcommitment even with unique valid targets', () => {
    const actions = ['r1', 'r2', 'r3', 'r4', 'r5'].map((target, i) => ({
      id: `r${i}`,
      kind: 'reroute',
      target,
      tick: 1,
    }))
    actions.push({ id: 'repair', kind: 'restore', target: 'west', tick: 1 })
    expect(() => validateFile({ ...config, actions })).toThrow('budget')
  })
  it('rejects late restoration and restoring healthy stations', () => {
    expect(() =>
      validateFile({
        ...config,
        actions: [{ id: 'x', kind: 'restore', target: 'west', tick: 36 }],
      }),
    ).toThrow()
    expect(() =>
      validateFile({ ...config, actions: [{ id: 'x', kind: 'restore', target: 'east', tick: 1 }] }),
    ).toThrow()
  })
})
