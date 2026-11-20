import { describe, expect, it } from 'vitest';
import type { AffiliateStream } from '../../../features/affiliate/api/offersApi';
import { formOf, formPatch, linkWithSubs, pixelErrors } from './streamForm';

const stream = {
  id: '331', code: 'w4n8re', link: 'https://elchi.example/w4n8re', productId: '501', productName: 'Simsiz quloqchinlar',
  template: 'STANDART', salePrice: 262_000, status: 'ACTIVE', sub1: null, sub2: null, sub3: null, sub4: null, sub5: null,
  metaPixelId: null, tiktokPixelId: null, postbackUrl: null, hasPostbackSecret: false, hasCapiToken: false,
  clicks: 0, leads: 0, sales: null, createdAt: '2027-01-14T09:37:00.000Z',
} satisfies AffiliateStream;

describe('streamForm', () => {
  it('faqat o‘zgargan maydon yuboriladi; postback yo‘q (FE-05 TC6)', () => {
    const form = { ...formOf(stream), price: 287_000, metaPixelId: ' 1234567890 ', subs: { ...formOf(stream).subs, sub1: 'fb-reels-1' } };
    expect(formPatch(stream, form)).toEqual({ salePrice: 287_000, sub1: 'fb-reels-1', metaPixelId: '1234567890' });
    expect(formPatch(stream, formOf(stream))).toEqual({});
  });

  it('piksel formati va sub bilan havola', () => {
    expect(pixelErrors({ ...formOf(stream), metaPixelId: '12ab', tiktokPixelId: 'C4X9' })).toEqual({ meta: true, tiktok: false });
    expect(linkWithSubs(stream.link, { ...formOf(stream).subs, sub1: 'fb-reels-1' })).toBe('https://elchi.example/w4n8re?sub1=fb-reels-1');
  });
});
