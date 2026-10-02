import type { Page } from '@playwright/test';

/**
 * Layout `overflow-x: clip` sig'magan kontentni scrollsiz kesib yuboradi —
 * shuning uchun `scrollWidth` bilan bilinmaydi. Sahifa bloklari va header
 * amallari kontent/ekran chegarasidan chiqib ketganini qaytaradi.
 */
export function findClippedBlocks(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const content = document.querySelector('.ant-layout-content');
    if (!content) return ['.ant-layout-content topilmadi'];
    const box = content.getBoundingClientRect();
    const padding = Number.parseFloat(getComputedStyle(content).paddingRight) || 0;
    const limit = box.right - padding + 1;
    const blocks = [...content.querySelectorAll(':scope > main > *, :scope > main > * > *')];
    const header = document.querySelector('.ant-layout-header > *');
    const clipped = blocks
      .filter((node) => node.getBoundingClientRect().right > limit)
      .map((node) => `${node.tagName.toLowerCase()}.${String(node.className).split(' ')[0]} right=${Math.round(node.getBoundingClientRect().right)} > ${Math.round(limit)}`);
    if (header && header.getBoundingClientRect().right > window.innerWidth + 1) clipped.push('header');
    [...document.querySelectorAll('.ant-layout-header *')].forEach((node) => {
      if (node.getBoundingClientRect().right > window.innerWidth + 1 && node.getBoundingClientRect().width > 4) clipped.push(`header ${node.tagName.toLowerCase()}`);
    });
    return clipped;
  });
}
