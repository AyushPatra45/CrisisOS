import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
test('complete operator journey: respond, run, replay, compare, share, import and reset', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'A city on the edge.' })).toBeVisible()
  await expect(page.getByTestId('simulation-clock')).toHaveText('18:00')
  await expect(page.getByLabel('Simulation events')).toContainText('Westhaven offline')
  for (const [name, target] of [
    ['Reroute traffic', 'r1'],
    ['Open emergency shelter', 'oldtown'],
    ['Restore substation', 'west'],
  ]) {
    await page.getByRole('button', { name: new RegExp(`^${name}`) }).click()
    const dialog = page.getByRole('dialog')
    await dialog.locator('select').selectOption(target)
    await dialog.getByRole('button', { name: 'Dispatch response' }).click()
    await expect(dialog).not.toBeVisible()
  }
  await expect(page.getByLabel('2 of 6 resource units available')).toBeVisible()
  await page.getByRole('button', { name: 'Next step', exact: true }).click()
  await expect(page.getByTestId('simulation-clock')).toHaveText('18:10')
  await expect(page.getByLabel('Simulation events')).toContainText('Old Town shelter open')
  await expect(page.getByRole('button', { name: 'Westhaven Avenue, 2% congestion' })).toBeVisible()
  await expect(page.locator('.sheltered-stat')).toContainText('750')
  await page.getByRole('button', { name: 'Next step', exact: true }).click()
  await expect(page.getByLabel('Simulation events')).toContainText('Westhaven restored')
  await expect(page.getByRole('button', { name: 'Westhaven substation, online' })).toBeVisible()
  await page.getByLabel('Simulation speed').selectOption('4')
  await page.getByRole('button', { name: 'Start simulation', exact: true }).click()
  await expect(page.getByTestId('simulation-clock')).not.toHaveText('18:20')
  await page.getByRole('button', { name: 'Pause simulation', exact: true }).click()
  const stopped = await page.getByTestId('simulation-clock').textContent()
  await page.waitForTimeout(550)
  await expect(page.getByTestId('simulation-clock')).toHaveText(stopped!)
  await page.getByLabel('Replay timeline').fill('0')
  await expect(page.getByRole('button', { name: 'Westhaven substation, offline' })).toBeVisible()
  await expect(page.getByLabel('Simulation events')).not.toContainText('Westhaven restored')
  await page.getByLabel('Replay timeline').fill('36')
  await page.getByRole('button', { name: 'Compare outcomes', exact: true }).click()
  const coverage = page.getByRole('row', { name: /Grid coverage/ })
  await expect(coverage).toContainText('100%')
  await expect(coverage).toContainText('+100 pp')
  await page.getByRole('button', { name: 'Share scenario' }).click()
  const url = await page.getByLabel('Scenario link').inputValue()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export JSON' }).click()
  const download = await downloadPromise
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await page.goto(url)
  await expect(page.locator('.decision-list > div')).toHaveCount(3)
  await page.getByLabel('Replay timeline').fill('2')
  await expect(page.getByLabel('Simulation events')).toContainText('Westhaven restored')
  await page.getByRole('button', { name: 'Reset simulation', exact: true }).click()
  await expect(page.locator('.empty-state')).toContainText('No interventions yet')
  await expect(page.getByLabel('6 of 6 resource units available')).toBeVisible()
  await page.getByLabel('Import scenario file').setInputFiles((await download.path())!)
  await expect(page.locator('.decision-list > div')).toHaveCount(3)
  await expect(page.getByRole('status')).toContainText('Loaded The first domino')
  expect(errors).toEqual([])
})
test('presets, invalid input, replay lock and resource limits', async ({ page }) => {
  await page.goto('/?seed=broken')
  await expect(page.getByRole('status')).toContainText('Could not load shared scenario')
  await page.getByLabel('Scenario', { exact: true }).selectOption('heatwave')
  await expect(page.getByLabel('Simulation events')).toContainText('Civic Grid offline')
  await page.getByLabel('Scenario', { exact: true }).selectOption('double-fault')
  await expect(page.getByLabel('Simulation events')).toContainText('Eastgate offline')
  await page.getByLabel('Replay timeline').fill('5')
  await page.getByRole('button', { name: /^Reroute traffic/ }).click()
  await page.getByRole('button', { name: 'Dispatch response' }).click()
  await page.getByLabel('Replay timeline').fill('0')
  await expect(page.getByRole('button', { name: /^Open emergency shelter/ })).toBeDisabled()
  await page.getByRole('button', { name: 'Reset simulation', exact: true }).click()
  for (let i = 0; i < 6; i++) {
    await page.getByRole('button', { name: /^Reroute traffic/ }).click()
    await page.getByRole('button', { name: 'Dispatch response' }).click()
  }
  await expect(page.getByLabel('0 of 6 resource units available')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Reroute traffic/ })).toBeDisabled()
  await expect(page.getByRole('button', { name: /^Open emergency shelter/ })).toBeDisabled()
  await page.getByLabel('Import scenario file').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":9}'),
  })
  await expect(page.getByRole('status')).toContainText('Import failed')
  await expect(page.locator('.decision-list > div')).toHaveCount(6)
})
test('mobile layout, keyboard map selection, guide and accessible controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  const hospital = page.getByRole('button', { name: /Mercy General,.*capacity pressure/ })
  await hospital.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.asset-title')).toContainText('Mercy General')
  await page.getByRole('button', { name: 'Simulation guide', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('does not predict real emergencies')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await page.getByRole('button', { name: /^Restore substation/ }).click()
  await page.getByRole('button', { name: 'Dispatch response' }).click()
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])
})

test('the loaded production app runs without network services', async ({ page, context }) => {
  const externalRequests: string[] = []
  page.on('request', (request) => {
    if (!new URL(request.url()).hostname.match(/^(127\.0\.0\.1|localhost)$/))
      externalRequests.push(request.url())
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'A city on the edge.' })).toBeVisible()
  await context.setOffline(true)
  await page.getByRole('button', { name: /^Restore substation/ }).click()
  await page.getByRole('button', { name: 'Dispatch response' }).click()
  await page.getByLabel('Replay timeline').fill('36')
  await expect(page.getByRole('button', { name: 'Westhaven substation, online' })).toBeVisible()
  await page.getByRole('button', { name: 'Compare outcomes', exact: true }).click()
  await expect(page.getByRole('row', { name: /Grid coverage/ })).toContainText('+100 pp')
  expect(externalRequests).toEqual([])
})
