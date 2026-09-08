import type { Category } from '../model/categoryTypes';

export interface CategoryOption {
  value: string;
  label: string;
}

export function createCategoryOptions(
  categories: Category[],
  depth = 0,
): CategoryOption[] {
  return categories.flatMap((category) => [
    { value: category.id, label: `${'— '.repeat(depth)}${category.name}` },
    ...createCategoryOptions(category.children, depth + 1),
  ]);
}
