import type { Product } from '../model/productTypes';

/**
 * Mahsulot muqovasi. Backend asosiy rasmni `imageUrl` da yoki faqat `images`
 * massivida qaytaradi (kontrakt: kamida bittasi bo'ladi) — faqat `imageUrl`
 * ga qaralsa, rasmi bor mahsulot rasmsiz ko'rinadi.
 */
export function getProductCover(product: Pick<Product, 'imageUrl' | 'images'>): string | null {
  return product.imageUrl || product.images[0] || null;
}
