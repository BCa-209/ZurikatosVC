import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('la consulta pública muestra flota y filtros, sin controles de escritura', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Recolección, a la vista.' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Camión T01/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Iniciar simulación', exact: true })).toHaveCount(0);
  const denied = await page.request.post('/api/simulation/start');
  expect(denied.status()).toBe(401);
  await page.getByRole('textbox', { name: 'Buscar manzana, lado o camión' }).fill('M03');
  await expect(page.getByText('4 de 4 lados', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ver detalle de M03, lado Norte', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Buscar manzana, lado o camión' }).fill('');
  await page.getByRole('button', { name: /^Camión T02/ }).click();
  await expect(page.getByText('Ruta de T02 seleccionada')).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(accessibility.violations.map(issue => ({ id: issue.id, targets: issue.nodes.map(node => node.target) }))).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/consulta-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('operador inicia, pausa y cancela un reinicio; errores recuperables', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Acceso operativo', exact: true }).click();
  await page.getByLabel('Clave de acceso', { exact: true }).fill('incorrecta');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Clave de acceso incorrecta');
  const dialogAccessibility = await new AxeBuilder({ page }).include('dialog').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(dialogAccessibility.violations.map(issue => ({ id: issue.id, targets: issue.nodes.map(node => node.target) }))).toEqual([]);
  await page.getByLabel('Clave de acceso', { exact: true }).fill('e2e-test-only-token');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Centro de operaciones' })).toBeVisible();
  await page.getByRole('button', { name: 'Iniciar simulación', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reanudar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reiniciar', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('¿Reiniciar la simulación?');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reanudar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Configurar capacidad' }).click();
  await page.getByLabel('Capacidad por camión (kg)').fill('80');
  await page.getByRole('button', { name: 'Aplicar y reiniciar' }).click();
  await expect(page.getByRole('button', { name: 'Iniciar simulación', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Salir', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Iniciar simulación', exact: true })).toHaveCount(0);
});

test('la vista móvil conserva contenido y la ayuda funciona con teclado', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Mapa de recolección', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(accessibility.violations.map(issue => ({ id: issue.id, targets: issue.nodes.map(node => node.target) }))).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/consulta-mobile.png', fullPage: true });
});
