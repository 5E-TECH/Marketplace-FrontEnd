import { beforeEach, describe, expect, it } from 'vitest';
import { sellerOffers } from '../../../mocks/catalog';
import { db, resetMockDb } from '../../../mocks/db';
import { offerReadiness } from './offerReadiness';

const active = { status: 'ACTIVE' as const, isBlocked: false, cpaEnabled: true, approvedPrice: 262_000 };

describe('offerReadiness', () => {
  it('narx, video va qoldiq bor — ochiq', () => {
    expect(offerReadiness(active, { videos: 1, stock: 120 })).toEqual({ state: 'OPEN', conditions: { price: true, video: true, stock: true }, visibleToSellers: true });
  });

  it('qoldiq 0 — katalogda, lekin yangi sahifa ochilmaydi', () => {
    expect(offerReadiness(active, { videos: 1, stock: 0 })).toMatchObject({ state: 'OUT_OF_STOCK', visibleToSellers: true });
  });

  it('videosiz yoki narxsiz — ochilmaydi va sotuvchiga ko‘rinmaydi (SOT-9)', () => {
    expect(offerReadiness(active, { videos: 0, stock: 30 })).toMatchObject({ state: 'CLOSED', visibleToSellers: false, conditions: { video: false } });
    expect(offerReadiness({ ...active, approvedPrice: null }, { videos: 1, stock: 30 })).toMatchObject({ state: 'CLOSED', visibleToSellers: false });
  });

  it('to‘xtatilgan, «faqat sayt» va tasdiqlanmagan mahsulot sotuvchiga ko‘rinmaydi', () => {
    expect(offerReadiness({ ...active, isBlocked: true }, { videos: 1, stock: 5 })).toMatchObject({ state: 'BLOCKED', visibleToSellers: false });
    expect(offerReadiness({ ...active, cpaEnabled: false }, { videos: 1, stock: 5 })).toMatchObject({ state: 'SITE_ONLY', visibleToSellers: false });
    expect(offerReadiness({ ...active, status: 'PENDING_REVIEW' }, { videos: 1, stock: 5 })).toMatchObject({ state: 'NOT_ACTIVE', visibleToSellers: false });
  });
});

describe('mock: sotuvchi katalogi admin holatidan', () => {
  beforeEach(() => resetMockDb());
  const ids = () => sellerOffers().map((offer) => offer.productId).sort();

  it('boshida faqat tasdiqlangan, videoli offerlar: 510 (videosiz) va navbatdagilar yo‘q', () => {
    expect(ids()).toEqual(['501', '502', '503', '504', '505']);
  });

  it('tasdiqlangan mahsulot katalogga chiqadi, to‘xtatilgani chiqib ketadi', () => {
    const fen = db.adminProducts.find((product) => product.id === '509');
    if (!fen) throw new Error('509 yo‘q');
    fen.status = 'ACTIVE';
    expect(ids()).toContain('509');
    const watch = db.adminProducts.find((product) => product.id === '505');
    if (!watch) throw new Error('505 yo‘q');
    watch.isBlocked = true;
    expect(ids()).not.toContain('505');
  });

  it('videosiz offerga video qo‘shilsa ochiladi', () => {
    db.creatives['510'] = [...(db.creatives['510'] ?? []), { id: 'v', productId: '510', type: 'VIDEO', url: 'https://cdn.elchi.example/v.mp4', mimeType: 'video/mp4', size: 1, position: 9, createdAt: new Date().toISOString() }];
    expect(ids()).toContain('510');
  });
});
