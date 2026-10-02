import type { Page } from '@playwright/test';

/**
 * antd `Form.useForm()` instansiyasi Form hali DOM'ga ulanmasdan ishlatilganda
 * chiqadigan ogohlantirishlarni yig'adi (masalan, modal ochilishidan oldin
 * `form.setFieldsValue` chaqirilsa). Test oxirida bo'sh bo'lishi kerak.
 */
export function collectUnconnectedFormWarnings(page: Page): string[] {
  const warnings: string[] = [];
  page.on('console', (message) => {
    const text = message.text();
    if (text.includes('not connected to any Form element')) warnings.push(text);
  });
  return warnings;
}
