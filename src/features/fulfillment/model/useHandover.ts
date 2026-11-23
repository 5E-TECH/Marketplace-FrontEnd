import { useCallback, useEffect, useState } from 'react';
import { createIdempotencyKey } from '../../../shared/api/requestOptions';
import { lineByCode } from '../lib/pickRules';
import type { PickTask } from './fulfillmentTypes';
import { clearHandoverDraft, emptyHandoverDraft, loadHandoverDraft, saveHandoverDraft, type HandoverDraft, type HandoverScan } from './handoverDraft';

export type HandoverNotice = { kind: HandoverScan['kind']; scan: HandoverScan };

const entry = (code: string, kind: HandoverScan['kind'], extra: Partial<HandoverScan> = {}): HandoverScan => ({
  key: createIdempotencyKey(), at: new Date().toISOString(), code, kind, orderNumber: null, productName: null, position: null, firstAt: null, ...extra,
});

/**
 * Ochiq topshirish akti (ombor-topshirish; OMB-5, FE-17 TC3): skanerlangan QR lar brauzerda yig'iladi, «Aktni
 * yakunlash» — bitta so'rov. Har skanga darhol javob — ro'yxatdagi posilkaning QR tokeni (taklif maydoni) yoki buyurtma
 * raqami bo'yicha; token ro'yxatda bo'lmasa va backend tokenlarni bermasa — kod aktga qo'shiladi, server yakunlashda
 * tekshiradi (409 sabablar bilan).
 */
export function useHandover(items: readonly PickTask[]) {
  const [draft, setDraft] = useState<HandoverDraft>(() => loadHandoverDraft() ?? emptyHandoverDraft());
  const [notice, setNotice] = useState<HandoverNotice | null>(null);
  useEffect(() => saveHandoverDraft(draft), [draft]);

  const tokensKnown = items.some((task) => task.parcel.qrCodeToken);

  /** Skaner Enter bosdi: natija jurnalga, posilka — aktga (qadoqlangan va hali yo'q bo'lsa). */
  const scan = useCallback((raw: string) => {
    const code = raw.trim();
    const upper = code.toUpperCase();
    const task = items.find((item) => item.parcel.qrCodeToken === code || item.orderNumber.toUpperCase() === upper);
    const product = task ? null : lineByCode(items, code);
    const base = { orderNumber: task?.orderNumber ?? null, productName: task?.lines[0]?.productName ?? product?.productName ?? null };
    let tokens = draft.tokens;
    let scanEntry: HandoverScan;
    if (task) {
      const token = task.parcel.qrCodeToken ?? code;
      const existing = tokens.find((item) => item.token === token || item.orderId === task.orderId);
      if (existing) scanEntry = entry(code, 'DUPLICATE', { ...base, firstAt: existing.at });
      else if (task.status !== 'PACKED') scanEntry = entry(code, 'NOT_PACKED', base);
      else {
        scanEntry = entry(code, 'ADDED', { ...base, position: tokens.length + 1 });
        tokens = [...tokens, { token, orderId: task.orderId, at: scanEntry.at }];
      }
    } else if (product) scanEntry = entry(code, 'PRODUCT_CODE', base);
    else if (tokensKnown) scanEntry = entry(code, 'UNKNOWN', base);
    else {
      // Backend QR tokenlarini bermaydi — kod aktga qo'shiladi, yakunlashda server tekshiradi.
      const existing = tokens.find((item) => item.token === code);
      if (existing) scanEntry = entry(code, 'DUPLICATE', { firstAt: existing.at });
      else {
        scanEntry = entry(code, 'ADDED', { position: tokens.length + 1 });
        tokens = [...tokens, { token: code, orderId: null, at: scanEntry.at }];
      }
    }
    setNotice({ kind: scanEntry.kind, scan: scanEntry });
    setDraft({ ...draft, tokens, journal: [scanEntry, ...draft.journal], journalTotal: draft.journalTotal + 1 });
  }, [draft, items, tokensKnown]);

  /** Faqat oxirgi qo'shilgan posilka olib tashlanadi; takroriy va to'xtatilgan skanlar aktga kirmagan. */
  const undoLast = useCallback(() => {
    setNotice(null);
    setDraft((current) => {
      const last = current.tokens.at(-1);
      if (!last) return current;
      const addedKey = current.journal.find((item) => item.kind === 'ADDED' && item.at === last.at)?.key;
      return { ...current, tokens: current.tokens.slice(0, -1), journal: current.journal.filter((item) => item.key !== addedKey), journalTotal: Math.max(0, current.journalTotal - 1) };
    });
  }, []);

  const reset = useCallback(() => {
    clearHandoverDraft();
    setNotice(null);
    setDraft(emptyHandoverDraft());
  }, []);

  const scannedIds = new Set(draft.tokens.map((item) => item.orderId).filter((id): id is string => Boolean(id)));
  const lastToken = draft.tokens.at(-1) ?? null;

  return {
    draft,
    notice,
    clearNotice: () => setNotice(null),
    scan,
    undoLast,
    reset,
    scannedIds,
    tokens: draft.tokens.map((item) => item.token),
    lastAdded: lastToken ? items.find((task) => task.orderId === lastToken.orderId) ?? null : null,
    hasLast: lastToken !== null,
  };
}
