import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
test('desktop control room and comparison screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/')
  await page.getByLabel('Replay timeline').fill('6')
  await expect(page.getByTestId('simulation-clock')).toHaveText('19:00')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.getByRole('heading', { name: 'A city on the edge.' }).click()
  await page.screenshot({ path: 'docs/control-room.png', fullPage: true })
  const before = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(before.violations).toEqual([])
  await page.getByRole('button', { name: /^Restore substation/ }).click()
  const dialogAudit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(dialogAudit.violations).toEqual([])
  await page.getByRole('button', { name: 'Dispatch response' }).click()
  await page.getByRole('button', { name: 'Dismiss notification' }).click()
  await page.getByRole('button', { name: 'Compare outcomes', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'The response difference' })).toBeVisible()
  await page.getByRole('heading', { name: 'Every decision leaves a mark.' }).click()
  await page.screenshot({ path: 'docs/comparison.png', fullPage: true })
  const after = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(after.violations).toEqual([])
})
test('mobile screenshot and all responsive widths stay inside the viewport', async ({ page }) => {
  for (const width of [320, 390, 768, 1024, 1920]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'A city on the edge.' })).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      `overflow at ${width}px`,
    ).toBe(true)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'docs/mobile.png', fullPage: true })
})
