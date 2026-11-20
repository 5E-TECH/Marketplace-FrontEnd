const uz = {
'upload.aria': 'Mahsulot rasmlarini yuklash', 'upload.readError': '{name} rasmini o‘qib bo‘lmadi', 'upload.serverError': '{name} rasmini serverga yuklab bo‘lmadi', 'upload.typeError': 'Faqat JPG, PNG yoki WEBP rasm yuklash mumkin', 'upload.sizeError': 'Rasm hajmi {size} MB dan oshmasligi kerak', 'upload.countError': 'Maksimum {count} ta rasm yuklash mumkin', 'upload.loading': '{name} yuklanmoqda', 'upload.reorder': 'Tartibni o‘zgartirish', 'upload.cover': 'Asosiy', 'upload.coverImage': 'Asosiy rasm', 'upload.makeCover': 'Asosiy qilish', 'upload.deleteAria': '{name} rasmini o‘chirish', 'upload.drop': 'Rasmlarni shu yerga tashlang', 'upload.choose': 'yoki kompyuterdan tanlash uchun bosing', 'upload.rules': 'JPG, PNG, WEBP · {size} MB gacha · maksimum {count} ta', 'upload.sortHint': 'Rasmlarni tortib tartibini o‘zgartiring. Birinchi rasm avtomatik asosiy bo‘ladi.', 'upload.previewAlt': '{name} ko‘rinishi',
} as const;

type CommerceTranslationKey = keyof typeof uz;

const ru: Record<CommerceTranslationKey, string> = {
'upload.aria': 'Загрузка изображений товара', 'upload.readError': 'Не удалось прочитать изображение {name}', 'upload.serverError': 'Не удалось загрузить изображение {name} на сервер', 'upload.typeError': 'Можно загружать только JPG, PNG или WEBP', 'upload.sizeError': 'Размер изображения не должен превышать {size} МБ', 'upload.countError': 'Можно загрузить не более {count} изображений', 'upload.loading': 'Загрузка {name}', 'upload.reorder': 'Изменить порядок', 'upload.cover': 'Главное', 'upload.coverImage': 'Главное изображение', 'upload.makeCover': 'Сделать главным', 'upload.deleteAria': 'Удалить изображение {name}', 'upload.drop': 'Перетащите изображения сюда', 'upload.choose': 'или нажмите, чтобы выбрать на компьютере', 'upload.rules': 'JPG, PNG, WEBP · до {size} МБ · максимум {count}', 'upload.sortHint': 'Перетаскивайте изображения для изменения порядка. Первое изображение автоматически станет главным.', 'upload.previewAlt': 'Предпросмотр {name}',
};

const en: Record<CommerceTranslationKey, string> = {
'upload.aria': 'Upload product images', 'upload.readError': 'Could not read {name}', 'upload.serverError': 'Could not upload {name} to the server', 'upload.typeError': 'Only JPG, PNG, or WEBP images are allowed', 'upload.sizeError': 'Image size must not exceed {size} MB', 'upload.countError': 'You can upload up to {count} images', 'upload.loading': 'Uploading {name}', 'upload.reorder': 'Change order', 'upload.cover': 'Cover', 'upload.coverImage': 'Cover image', 'upload.makeCover': 'Make cover', 'upload.deleteAria': 'Delete {name}', 'upload.drop': 'Drop images here', 'upload.choose': 'or click to choose from your computer', 'upload.rules': 'JPG, PNG, WEBP · up to {size} MB · maximum {count}', 'upload.sortHint': 'Drag images to reorder them. The first image automatically becomes the cover.', 'upload.previewAlt': '{name} preview',
};

export const commerceTranslations = { uz, ru, en } as const;
