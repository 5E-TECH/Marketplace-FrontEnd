import type { Page } from '@playwright/test';

/**
 * Karkas `overflow-x: clip` sig'magan kontentni scrollsiz kesib yuboradi —
 * shuning uchun `scrollWidth` bilan bilinmaydi. Sahifa bloklari va yuqori qator
 * elementlari kontent/ekran chegarasidan chiqib ketganini qaytaradi.
 */
export function findClippedBlocks(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const content = document.querySelector('[data-app-main]');
    if (!content) return ['[data-app-main] topilmadi'];
    const box = content.getBoundingClientRect();
    const padding = Number.parseFloat(getComputedStyle(content).paddingRight) || 0;
    const limit = box.right - padding + 1;
    const blocks = [...content.querySelectorAll(':scope > *, :scope > * > *')];
    const header = content.parentElement?.querySelector(':scope > header');
    const clipped = blocks
      .filter((node) => node.getBoundingClientRect().right > limit)
      .map((node) => `${node.tagName.toLowerCase()}.${String(node.className).split(' ')[0]} right=${Math.round(node.getBoundingClientRect().right)} > ${Math.round(limit)}`);
    if (header && header.getBoundingClientRect().right > window.innerWidth + 1) clipped.push('header');
    [...(header?.querySelectorAll('*') ?? [])].forEach((node) => {
      if (node.getBoundingClientRect().right > window.innerWidth + 1 && node.getBoundingClientRect().width > 4) clipped.push(`header ${node.tagName.toLowerCase()}`);
    });
    return clipped;
  });
}
