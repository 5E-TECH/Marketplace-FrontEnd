const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export async function readShopImage(
  file: File,
  maxSizeMb: number,
): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error('Faqat JPG, PNG yoki WEBP rasm tanlang');
  }

  if (file.size > maxSizeMb * 1024 * 1024) {
    throw new Error(`Rasm hajmi ${maxSizeMb} MB dan oshmasligi kerak`);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('Rasmni o‘qib bo‘lmadi'));
    reader.onerror = () => reject(new Error('Rasmni o‘qib bo‘lmadi'));
    reader.readAsDataURL(file);
  });
}
