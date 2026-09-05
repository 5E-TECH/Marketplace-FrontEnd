export interface AdminResourceRecord { id: string; name: string; type: string; status: 'ACTIVE' | 'PENDING' | 'BLOCKED'; updatedAt: string }
const seed: AdminResourceRecord[] = [
  { id: '1', name: 'Asosiy yozuv', type: 'Platforma', status: 'ACTIVE', updatedAt: '2026-09-03T09:30:00.000Z' },
  { id: '2', name: 'Tekshiruvdagi yozuv', type: 'Marketplace', status: 'PENDING', updatedAt: '2026-09-02T14:15:00.000Z' },
  { id: '3', name: 'Bloklangan yozuv', type: 'Tizim', status: 'BLOCKED', updatedAt: '2026-09-01T08:00:00.000Z' },
];
const delay = () => new Promise((resolve) => setTimeout(resolve, 120));
export async function fetchData(): Promise<AdminResourceRecord[]> { await delay(); return seed.map((item) => ({ ...item })); }
export async function handleCreate(value: Omit<AdminResourceRecord, 'id' | 'updatedAt'>): Promise<AdminResourceRecord> { await delay(); return { ...value, id: crypto.randomUUID(), updatedAt: new Date().toISOString() }; }
export async function handleUpdate(value: AdminResourceRecord): Promise<AdminResourceRecord> { await delay(); return { ...value, updatedAt: new Date().toISOString() }; }
export async function handleDelete(ids: string[]): Promise<void> { void ids; await delay(); }
