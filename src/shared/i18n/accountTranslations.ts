const uz = {
  'auth.loginSuccess': 'Tizimga muvaffaqiyatli kirdingiz',
  'auth.login': 'Kirish',
  'auth.phone': 'Telefon raqami',
  'auth.phoneRequired': 'Telefon raqamini kiriting',
  'auth.phoneNineDigits': '9 xonali telefon raqamini kiriting',
  'auth.password': 'Parol',
  'auth.passwordRequired': 'Parolni kiriting',
  'auth.passwordMax': 'Parol 128 belgidan oshmasligi kerak',
  'auth.profileLoadError': 'Profil ma’lumotini olib bo‘lmadi. Qayta urinib ko‘ring.',
  'auth.localSessionCleared': 'Server sessiyasi yopilmadi, lokal sessiya tozalandi',
} as const;

type AccountTranslationKey = keyof typeof uz;

const ru: Record<AccountTranslationKey, string> = {
'auth.loginSuccess': 'Вы успешно вошли в систему','auth.login': 'Войти','auth.phone': 'Номер телефона', 'auth.phoneRequired': 'Введите номер телефона', 'auth.phoneNineDigits': 'Введите 9 цифр номера телефона', 'auth.password': 'Пароль', 'auth.passwordRequired': 'Введите пароль', 'auth.passwordMax': 'Пароль не должен превышать 128 символов','auth.profileLoadError': 'Не удалось получить профиль. Повторите попытку.', 'auth.localSessionCleared': 'Сессия на сервере не завершена, локальная сессия очищена',};

const en: Record<AccountTranslationKey, string> = {
'auth.loginSuccess': 'Signed in successfully','auth.login': 'Sign in','auth.phone': 'Phone number', 'auth.phoneRequired': 'Enter your phone number', 'auth.phoneNineDigits': 'Enter a 9-digit phone number', 'auth.password': 'Password', 'auth.passwordRequired': 'Enter your password', 'auth.passwordMax': 'Password must not exceed 128 characters','auth.profileLoadError': 'Could not load profile information. Try again.', 'auth.localSessionCleared': 'The server session could not be closed; the local session was cleared',};

export const accountTranslations = { uz, ru, en } as const;
