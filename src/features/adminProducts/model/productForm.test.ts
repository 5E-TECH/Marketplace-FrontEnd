import { describe, expect, it } from 'vitest';
import type { Category } from '../../categories/model/categoryTypes';
import { changedFields, emptyProductForm, inheritedFlag, productBody, productErrorsFromApi, toGrams, toMm, validateProductForm, type ProductFormValues } from './productForm';

const filled: ProductFormValues = {
  ...emptyProductForm('7'),
  name: 'Simsiz kolonka', slug: 'simsiz-kolonka', categoryId: '11', description: 'Bluetooth kolonka',
  weightKg: '0,8', lengthCm: '20', widthCm: '10', heightCm: '9.5', basePrice: '150000', images: ['https://cdn/1.jpg'],
};

const category = (id: string, parentId: string | null, extra: Partial<Category> = {}, children: Category[] = []): Category => ({
  id, name: `K${id}`, slug: `k${id}`, parentId, iconUrl: null, sortOrder: 0, isActive: true, isBad: null, expiryTracked: null, children, ...extra,
});

describe('mahsulot formasi (FE-25, OPT-2)', () => {
  it('kg → gramm, sm → mm; vergul ham nuqta', () => {
    expect(toGrams('0,8')).toBe(800);
    expect(toGrams('5.6')).toBe(5600);
    expect(toMm('9.5')).toBe(95);
    expect(productBody(filled)).toMatchObject({ weightGrams: 800, lengthMm: 200, widthMm: 100, heightMm: 95, basePrice: 150_000, isBad: false, expiryTracked: undefined });
  });

  it('TC2: og‘irliksiz — «weight» xatosi; noto‘g‘ri o‘lcham, slug va kodlar', () => {
    expect(validateProductForm(filled, { isNew: true, requireCodes: false })).toEqual({});
    expect(validateProductForm({ ...filled, weightKg: '' }, { isNew: true, requireCodes: false })).toEqual({ weightKg: 'weight' });
    expect(validateProductForm({ ...filled, weightKg: '0', lengthCm: 'abc', slug: 'Simsiz Kolonka' }, { isNew: true, requireCodes: false }))
      .toEqual({ weightKg: 'dimension', lengthCm: 'dimension', slug: 'slug' });
    expect(validateProductForm({ ...filled, images: [] }, { isNew: true, requireCodes: false })).toEqual({ images: 'image' });
    expect(validateProductForm({ ...filled, images: [] }, { isNew: false, requireCodes: false })).toEqual({});
    expect(validateProductForm(filled, { isNew: false, requireCodes: true })).toEqual({ mxikCode: 'required', packageCode: 'required' });
    expect(validateProductForm({ ...filled, mxikCode: '123', packageCode: '12a' }, { isNew: false, requireCodes: false })).toEqual({ mxikCode: 'mxik', packageCode: 'package' });
  });

  it('PATCH — faqat o‘zgargan maydonlar', () => {
    expect(changedFields({ ...filled, lengthCm: '13' }, filled)).toEqual({ lengthMm: 130 });
    expect(changedFields(filled, filled)).toEqual({});
    expect(changedFields({ ...filled, mxikCode: '' }, { ...filled, mxikCode: '03304001001000000' })).toEqual({ mxikCode: null });
  });

  it('server xatosi → maydon: slug 409, shartnoma 409, 400 details', () => {
    expect(productErrorsFromApi(409, ['slug'])).toEqual({ slug: 'slugTaken' });
    expect(productErrorsFromApi(409, [])).toEqual({ wholesalerId: 'contract' });
    expect(productErrorsFromApi(400, ['weightGrams', 'images', 'mxikCode', 'unknown'])).toEqual({ weightKg: 'weight', images: 'image', mxikCode: 'mxik' });
    expect(productErrorsFromApi(500, [])).toEqual({});
  });

  it('BAD va muddat — o‘zida yoki eng yaqin otadan', () => {
    const tree = [category('14', null, { expiryTracked: true }, [category('15', '14', { isBad: true }), category('16', '14')])];
    expect(inheritedFlag(tree, '15', 'isBad')).toEqual({ value: true, from: null });
    expect(inheritedFlag(tree, '15', 'expiryTracked')).toEqual({ value: true, from: 'K14' });
    expect(inheritedFlag(tree, '16', 'isBad')).toEqual({ value: false, from: null });
  });
});
