const uz = {
  'admin.common.name': 'Nomi',
  'admin.common.order': 'Tartib',
  'admin.common.filters': 'Filterlar',
  'admin.audit.title': 'Audit jurnali',
  'admin.audit.description': 'Administratorlar bajargan amallar tarixi',
  'admin.audit.logs': 'Amallar tarixi',
  'admin.audit.date': 'Sana',
  'admin.audit.actor': 'Kim',
  'admin.audit.actorId': 'Foydalanuvchi ID',
  'admin.audit.unknownActor': 'Noma’lum foydalanuvchi',
  'admin.audit.action': 'Amal turi',
  'admin.audit.actionPlaceholder': 'Masalan: shop.suspend',
  'admin.audit.object': 'Obyekt',
  'admin.audit.dateFrom': 'Boshlanish sanasi',
  'admin.audit.dateTo': 'Tugash sanasi',
  'admin.audit.loadError': 'Audit jurnalini yuklab bo‘lmadi',
  'admin.audit.empty': 'Audit yozuvlari topilmadi',
  'admin.audit.emptyDescription': 'Tanlangan filterlar bo‘yicha amallar mavjud emas.',
  'admin.impersonation.viewingAs': 'Siz {name} nomidan ko‘ryapsiz',
  'admin.impersonation.remaining': '{time} qoldi',
  'admin.impersonation.exit': 'Chiqish',
  'admin.impersonation.expired': 'Nomidan kirish muddati tugadi — o‘z hisobingizga qaytdingiz',
  'admin.impersonation.ended': 'O‘z hisobingizga qaytdingiz',
} as const;

type AdminTranslationKey = keyof typeof uz;

const ru: Record<AdminTranslationKey, string> = {
  'admin.common.name': 'Название','admin.common.order': 'Порядок','admin.common.filters': 'Фильтры',
'admin.audit.title': 'Журнал аудита', 'admin.audit.description': 'История действий администраторов', 'admin.audit.logs': 'История действий', 'admin.audit.date': 'Дата', 'admin.audit.actor': 'Кто', 'admin.audit.actorId': 'ID пользователя', 'admin.audit.unknownActor': 'Неизвестный пользователь', 'admin.audit.action': 'Тип действия', 'admin.audit.actionPlaceholder': 'Например: shop.suspend', 'admin.audit.object': 'Объект', 'admin.audit.dateFrom': 'Дата начала', 'admin.audit.dateTo': 'Дата окончания','admin.audit.loadError': 'Не удалось загрузить журнал аудита', 'admin.audit.empty': 'Записи аудита не найдены', 'admin.audit.emptyDescription': 'По выбранным фильтрам действий нет.',
  'admin.impersonation.viewingAs': 'Вы просматриваете от имени {name}', 'admin.impersonation.remaining': 'Осталось {time}',
  'admin.impersonation.exit': 'Выйти', 'admin.impersonation.expired': 'Срок входа от имени истёк — вы вернулись в свой аккаунт',
  'admin.impersonation.ended': 'Вы вернулись в свой аккаунт',
};

const en: Record<AdminTranslationKey, string> = {
  'admin.common.name': 'Name','admin.common.order': 'Order','admin.common.filters': 'Filters',
'admin.audit.title': 'Audit log', 'admin.audit.description': 'History of actions performed by administrators', 'admin.audit.logs': 'Action history', 'admin.audit.date': 'Date', 'admin.audit.actor': 'Actor', 'admin.audit.actorId': 'User ID', 'admin.audit.unknownActor': 'Unknown user', 'admin.audit.action': 'Action type', 'admin.audit.actionPlaceholder': 'For example: shop.suspend', 'admin.audit.object': 'Object', 'admin.audit.dateFrom': 'Start date', 'admin.audit.dateTo': 'End date','admin.audit.loadError': 'Could not load the audit log', 'admin.audit.empty': 'No audit records found', 'admin.audit.emptyDescription': 'No actions match the selected filters.',
  'admin.impersonation.viewingAs': 'You are viewing as {name}', 'admin.impersonation.remaining': '{time} left',
  'admin.impersonation.exit': 'Exit', 'admin.impersonation.expired': 'The sign-in-as session expired — you are back in your own account',
  'admin.impersonation.ended': 'You are back in your own account',
};

export const adminTranslations = { uz, ru, en } as const;
