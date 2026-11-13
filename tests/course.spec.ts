import { test, expect } from '@playwright/test';

test('course, editor, exercise, quiz, and browser persistence', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Course overview', exact: true })).toBeVisible();
  await expect(page.locator('.chapter-card')).toHaveCount(10);
  await expect(page.locator('.version')).toHaveText('Go 1.27.4');
  await page.screenshot({ path: '.artifacts/overview.png', fullPage: true });
  await page.getByRole('button', { name: 'Start course' }).click();
  await expect(page).toHaveURL(/#lesson\/toolchain$/);
  await page.getByRole('searchbox', { name: 'Search lessons' }).fill('Your first program');
  await page.locator('.lesson-links button').click();
  await page.getByRole('button', { name: 'Run code', exact: false }).click();
  await expect(page.locator('.output-text')).toContainText('Hello, Go!');
  await page.getByRole('button', { name: 'C Println', exact: true }).click();
  await expect(page.locator('.quiz-feedback')).toHaveClass(/correct/);
  await page.getByRole('button', { name: 'Exercise', exact: true }).click();
  await page.getByRole('button', { name: 'Show hint', exact: false }).click();
  await expect(page.locator('.exercise-help')).toContainText('Use %s and %d');
  await page.getByRole('button', { name: 'Show solution', exact: false }).click();
  await page.getByRole('button', { name: 'Load solution into editor', exact: false }).click();
  await page.getByRole('button', { name: 'Run code', exact: false }).click();
  await expect(page.locator('.exercise-feedback')).toContainText('Output matches');
  await page.getByRole('button', { name: 'Format', exact: true }).click();
  await expect(page.locator('.cm-content')).toContainText('func main()');
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  await page.getByRole('textbox', { name: /Your notes/ }).fill('Println adds a newline.');
  await page.getByRole('button', { name: 'Mark as complete' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Lesson completed', exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  await expect(page.getByRole('textbox', { name: /Your notes/ })).toHaveValue(
    'Println adds a newline.',
  );
  await page.getByRole('button', { name: 'Exercise', exact: true }).click();
  await expect(page.locator('.cm-content')).toContainText('scored %d points.');
  await page.screenshot({ path: '.artifacts/lesson.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('test mode, compiler errors, references, and mobile navigation', async ({ page }) => {
  await page.goto('/#lesson/table-tests');
  await expect(page.getByRole('combobox', { name: 'Mode', exact: true })).toHaveValue('test');
  await page.getByRole('button', { name: 'Run tests', exact: false }).click();
  await expect(page.locator('.output-text')).toContainText('PASS');
  await page.goto('/#lesson/capstone-service');
  await page.getByRole('button', { name: 'Exercise', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Mode', exact: true })).toHaveValue('test');
  await page.getByRole('button', { name: 'Lesson', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Mode', exact: true })).toHaveValue('run');
  await page.goto('/#playground');
  await page.locator('.cm-content').fill('package main\nfunc main() { missing() }');
  await page.getByRole('button', { name: 'Run code', exact: false }).click();
  await expect(page.locator('.output-text')).toContainText('undefined');
  await page.reload();
  await expect(page.locator('.cm-content')).toContainText('missing()');
  await page.goto('/#reference');
  for (const href of [
    'https://go.dev/doc/',
    'https://go.dev/ref/spec',
    'https://go.dev/doc/effective_go',
    'https://pkg.go.dev/std',
  ]) {
    await expect(page.locator(`.resource-links a[href="${href}"]`)).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Toggle course menu' }).click();
  await page.getByRole('searchbox', { name: 'Search lessons' }).fill('context cancellation');
  await page.locator('.lesson-links button').click();
  await expect(
    page.getByRole('heading', { name: 'Select and context cancellation' }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: '.artifacts/mobile.png', fullPage: true });
});
