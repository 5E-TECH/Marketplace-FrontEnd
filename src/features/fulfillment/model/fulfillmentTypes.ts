/**
 * Ombor: yig'ish, qadoq, yorliq va Elchi'ga topshirish (FE-17). Backend: BE-19 (`warehouse/*`).
 * Backendda hali yo'q maydonlar — taklif (docs/api-taklif/fe-17-ombor-yigish.md); kelmasa blok yashiriladi.
 * Alohida faylda: mock (`src/mocks`) ham ishlatadi, u esa `httpClient` ni import qilmasligi kerak.
 */

/** Yig'ish vazifasi (T4 `fulfillment_task`): ro'yxatda bekor qilingan va topshirilganlar chiqmaydi. */
export type TaskStatus = 'TO_PICK' | 'PICKED' | 'PACKED' | 'HANDED_OVER' | 'CANCELLED';

/** Posilkaning Elchi tomonidagi holati (BE-20). */
export type ParcelElchiState = 'PENDING' | 'CREATED' | 'FAILED' | 'CANCELLED' | 'CANCEL_FAILED';

/** Yetkazish: tuman markazigacha yoki eshikkacha. */
export type DeliveryMode = 'CENTER' | 'DOOR';

export interface PickLine {
  productName: string;
  sku: string | null;
  barcode: string | null;
  quantity: number;
  pickedQty: number;
  /** Taklif: yacheyka va og'irlik (kg). */
  cell: string | null;
  weightKg: number | null;
}

export interface PickParcel {
  elchiState: ParcelElchiState | null;
  shipmentId: string | null;
  /** Elchi posilkasi yaratilgan — yorliq chop etiladi. */
  labelReady: boolean;
  /** Elchi xatosi: «sabab: xabar». */
  error: string | null;
  /** Taklif: yorliqdagi QR tokeni — topshirishda skanga darhol javob uchun. */
  qrCodeToken: string | null;
}

export interface PickTask {
  taskId: string;
  orderId: string;
  /** «L-1276». */
  orderNumber: string;
  status: TaskStatus;
  /** Yig'ish kuni (Toshkent, `YYYY-MM-DD`): 14:00 gacha tasdiqlangan — o'sha kun, keyin — ertasi. */
  pickDate: string;
  /** Oldingi kundan qolgan. */
  overdue: boolean;
  /** Jami dona va yig'ilgani. */
  quantity: number;
  pickedQty: number;
  lines: PickLine[];
  parcel: PickParcel;
  /** Taklif: mijoz, manzil, yetkazish, olganda to'lanadi, tasdiq va qadoq vaqti. */
  customerName: string | null;
  regionName: string | null;
  districtName: string | null;
  deliveryMode: DeliveryMode | null;
  codAmount: number | null;
  confirmedAt: string | null;
  packedAt: string | null;
}

export interface PickList {
  date: string;
  items: PickTask[];
  counts: { toPick: number; picked: number; packed: number; overdue: number };
  /** 1 000 qatordan oshdi. */
  truncated: boolean;
}

export interface ScanResult {
  taskId: string;
  orderId: string;
  status: TaskStatus;
  pickedQty: number;
  quantity: number;
}

export interface HandoverActItem {
  parcelId: string;
  orderId: string;
  orderNumber: string;
  shipmentId: string;
  qrCodeToken: string;
}

export interface HandoverAct {
  id: string;
  parcelCount: number;
  createdBy: string;
  /** Toshkent vaqti, «YYYY-MM-DD HH:MI». */
  createdAt: string;
  items: HandoverActItem[];
}
