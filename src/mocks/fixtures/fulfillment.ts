import type { DeliveryMode, ParcelElchiState, TaskStatus } from '../../features/fulfillment/model/fulfillmentTypes';
import { addDays, tashkentDate } from '../utils';

/**
 * Ombor: yig'ish, qadoq va topshirish (FE-17) — BE-19 shakli va taklif maydonlari. Dizayndagi namuna
 * (ombor-yigish, ombor-qadoq, ombor-topshirish): bugungi to'lqin 12 posilka (7 qadoqlangan, L-1276 navbatning boshi),
 * ertangi to'lqin 3 posilka (14:00 dan keyin tasdiqlangan).
 */
export interface MockProduct {
  name: string;
  sku: string;
  barcode: string;
  cell: string;
  weightKg: number;
  price: number;
}

export const PRODUCTS = {
  headphones: { name: 'Simsiz quloqchinlar', sku: 'SKU-501', barcode: '4780012345677', cell: 'B-02-1', weightKg: 0.3, price: 292_000 },
  scale: { name: 'Oshxona tarozisi', sku: 'SKU-502', barcode: '4780012345684', cell: 'A-01-3', weightKg: 0.8, price: 266_000 },
  kettle: { name: 'Elektr choynak', sku: 'SKU-503', barcode: '4780012345691', cell: 'B-02-2', weightKg: 1.2, price: 368_000 },
} satisfies Record<string, MockProduct>;

export interface MockTaskLine extends MockProduct {
  quantity: number;
  pickedQty: number;
}

export interface MockTask {
  taskId: string;
  orderId: string;
  status: TaskStatus;
  pickDate: string;
  lines: MockTaskLine[];
  customerName: string;
  regionName: string;
  districtName: string;
  deliveryMode: DeliveryMode;
  codAmount: number;
  confirmedAt: string;
  packedAt: string | null;
  elchiState: ParcelElchiState;
  shipmentId: string | null;
  qrCodeToken: string | null;
  parcelId: string;
}

export interface MockAct {
  id: string;
  createdBy: string;
  createdAt: string;
  orderIds: string[];
}

export interface MockFulfillment {
  tasks: MockTask[];
  acts: MockAct[];
}

/** Toshkent vaqti (`HH:MM`) bilan ISO: bugungi yoki ertangi sana. */
const at = (day: string, time: string) => new Date(`${day}T${time}:00+05:00`).toISOString();

interface Seed {
  order: number;
  name: string;
  region: string;
  district: string;
  mode: DeliveryMode;
  product: MockProduct;
  status: TaskStatus;
  confirmed: string;
  packed?: string;
  tomorrow?: boolean;
}

function task(today: string, seed: Seed): MockTask {
  const day = seed.tomorrow ? addDays(today, 1) : today;
  const picked = seed.status === 'TO_PICK' ? 0 : 1;
  return {
    taskId: String(seed.order - 900),
    orderId: String(seed.order),
    status: seed.status,
    pickDate: day,
    lines: [{ ...seed.product, quantity: 1, pickedQty: picked }],
    customerName: seed.name,
    regionName: seed.region,
    districtName: seed.district,
    deliveryMode: seed.mode,
    codAmount: seed.product.price,
    confirmedAt: at(today, seed.confirmed),
    packedAt: seed.packed ? at(today, seed.packed) : null,
    elchiState: 'CREATED',
    shipmentId: String(seed.order + 5000),
    qrCodeToken: `QR-${seed.order}`,
    parcelId: String(seed.order - 100),
  };
}

export function mockFulfillment(): MockFulfillment {
  const today = tashkentDate();
  const { headphones, scale, kettle } = PRODUCTS;
  const seeds: Seed[] = [
    { order: 1188, name: 'Otabek', region: 'Toshkent shahri', district: 'Chilonzor tumani', mode: 'DOOR', product: scale, status: 'PACKED', confirmed: '09:12', packed: '14:03' },
    { order: 1209, name: 'Oybek', region: 'Andijon viloyati', district: 'Asaka tumani', mode: 'CENTER', product: headphones, status: 'PACKED', confirmed: '09:40', packed: '14:07' },
    { order: 1217, name: 'Jamshid', region: 'Qashqadaryo viloyati', district: 'Qarshi shahri', mode: 'DOOR', product: kettle, status: 'PACKED', confirmed: '10:05', packed: '14:11' },
    { order: 1222, name: 'Madina', region: 'Farg‘ona viloyati', district: 'Quvasoy shahri', mode: 'CENTER', product: headphones, status: 'PACKED', confirmed: '10:31', packed: '14:16' },
    { order: 1241, name: 'Kamila', region: 'Namangan viloyati', district: 'Chust tumani', mode: 'CENTER', product: scale, status: 'PACKED', confirmed: '11:02', packed: '14:22' },
    { order: 1264, name: 'Behruz', region: 'Farg‘ona viloyati', district: 'Marg‘ilon shahri', mode: 'DOOR', product: scale, status: 'PACKED', confirmed: '12:18', packed: '14:29' },
    { order: 1233, name: 'Zarina', region: 'Samarqand viloyati', district: 'Urgut tumani', mode: 'CENTER', product: headphones, status: 'PACKED', confirmed: '11:20', packed: '14:34' },
    { order: 1276, name: 'Rustam', region: 'Buxoro viloyati', district: 'Buxoro shahri', mode: 'CENTER', product: headphones, status: 'TO_PICK', confirmed: '13:55' },
    { order: 1240, name: 'Dilfuza', region: 'Xorazm viloyati', district: 'Urganch shahri', mode: 'CENTER', product: headphones, status: 'TO_PICK', confirmed: '10:47' },
    { order: 1244, name: 'Sanjar', region: 'Surxondaryo viloyati', district: 'Termiz shahri', mode: 'DOOR', product: kettle, status: 'TO_PICK', confirmed: '11:15' },
    { order: 1248, name: 'Hulkar', region: 'Jizzax viloyati', district: 'Jizzax shahri', mode: 'CENTER', product: scale, status: 'TO_PICK', confirmed: '12:40' },
    { order: 1250, name: 'Nodir', region: 'Navoiy viloyati', district: 'Navoiy shahri', mode: 'CENTER', product: headphones, status: 'TO_PICK', confirmed: '13:02' },
    { order: 1245, name: 'Lola', region: 'Sirdaryo viloyati', district: 'Guliston shahri', mode: 'CENTER', product: kettle, status: 'TO_PICK', confirmed: '14:01', tomorrow: true },
    { order: 1232, name: 'Akmal', region: 'Toshkent viloyati', district: 'Chirchiq shahri', mode: 'DOOR', product: headphones, status: 'TO_PICK', confirmed: '14:04', tomorrow: true },
    { order: 1284, name: 'Aziza', region: 'Samarqand viloyati', district: 'Kattaqo‘rg‘on shahri', mode: 'CENTER', product: scale, status: 'TO_PICK', confirmed: '14:38', tomorrow: true },
  ];
  return { tasks: seeds.map((seed) => task(today, seed)), acts: [] };
}
