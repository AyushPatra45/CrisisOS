import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { validateFile } from './sharing'
import { scenarios } from './scenarios'
import { simulate } from './engine'
describe('bundled sample scenarios', () => {
  for (const name of readdirSync(new URL('../../public/scenarios/', import.meta.url))) {
    it(`validates and simulates ${name}`, () => {
      const config = validateFile(
        JSON.parse(
          readFileSync(new URL(`../../public/scenarios/${name}`, import.meta.url), 'utf8'),
        ),
      )
      const scenario = scenarios.find((s) => s.id === config.scenario)!
      const run = simulate(scenario, config.seed, config.actions)
      expect(run).toHaveLength(37)
      expect(run[36].events.length).toBeGreaterThan(0)
    })
  }
})
