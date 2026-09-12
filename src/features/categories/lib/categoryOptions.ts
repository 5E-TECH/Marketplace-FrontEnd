import type { Category } from '../model/categoryTypes';

export interface CategoryOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * `disableInactive` — faol bo'lmagan kategoriya ro'yxatda ko'rinadi, lekin
 * tanlanmaydi. Mahsulot formasi shuni ishlatadi: tahrirlanayotgan eski
 * mahsulot o'chirilgan kategoriyada bo'lishi mumkin, shuning uchun uni
 * ro'yxatdan butunlay olib tashlash mavjud qiymatni ko'rsatmay qo'yardi.
 * Filtrlarda esa (ProductsPage) faol bo'lmagani bo'yicha ham qidirish kerak,
 * shuning uchun zaxira qiymat — `false`.
 */
export function createCategoryOptions(
  categories: Category[],
  depth = 0,
  disableInactive = false,
): CategoryOption[] {
  return categories.flatMap((category) => [
    {
      value: category.id,
      label: `${'— '.repeat(depth)}${category.name}`,
      ...(disableInactive && !category.isActive ? { disabled: true } : {}),
    },
    ...createCategoryOptions(category.children, depth + 1, disableInactive),
  ]);
}
