/** «150120» → «15.01.20»: yozish paytida nuqtalar o'zi qo'yiladi (kk.oo.yyyy). */
export function maskDateInput(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('.');
}

/** «15.01.2027» → «2027-01-15»; noto'g'ri yoki chala sana — `null`. */
export function dotsToIso(text: string): string | null {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(text);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const date = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  if (date.getUTCFullYear() !== Number(yyyy) || date.getUTCMonth() !== Number(mm) - 1 || date.getUTCDate() !== Number(dd)) return null;
  return `${yyyy}-${mm}-${dd}`;
}

/** «2027-01-15» → «15.01.2027». */
export function isoToDots(iso: string | null | undefined): string {
  if (!iso) return '';
  const [yyyy, mm, dd] = iso.split('-');
  return yyyy && mm && dd ? `${dd}.${mm}.${yyyy}` : '';
}

/** Oy jadvali (dushanbadan): bo'sh kataklar `null`. */
export function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month, 1));
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: offset }, () => null);
  for (let day = 1; day <= days; day += 1) {
    cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  }
  while (cells.length % 7) cells.push(null);
  return cells;
}

/** 15 daqiqalik qadam bilan vaqtlar: «09:00», «09:15», … (`from`–`to` ichida). */
export function timeSlots(step: number, from = '00:00', to = '23:59'): string[] {
  const toMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
  const slots: string[] = [];
  for (let minutes = Math.ceil(toMinutes(from) / step) * step; minutes <= toMinutes(to); minutes += step) {
    slots.push(`${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`);
  }
  return slots;
}
