import { describe, expect, it } from 'vitest';
import { roleMenuKeys } from '../lib/roleMenu';
import { MENU_PLAN, menuStats } from './menuPlan';
import { grantOf, MATRIX_ROLES, PERMISSIONS, rolePermissions } from './permissions';

describe('rol menyusi rejasi (karkas-E §2) va ruxsatlar (admin-rollar)', () => {
  it('M1 bandlari marshrut manifestidagi menyu bilan bir xil va bir tartibda — rol berilsa xodim aynan shuni ko‘radi', () => {
    for (const role of MATRIX_ROLES) {
      expect(MENU_PLAN[role].filter((item) => item.stage === 'M1').map((item) => item.label), role).toEqual(roleMenuKeys(role));
    }
  });

  it('«Sakkiz rol» jadvalidagi menyu sonlari dizayn bilan bir xil', () => {
    const stats = Object.fromEntries(MATRIX_ROLES.map((role) => [role, menuStats(role)]));
    expect(stats).toEqual({
      AFFILIATE: { total: 9, current: 8 },
      WHOLESALER: { total: 8, current: 0 },
      OPERATOR_LEAD: { total: 5, current: 5 },
      SUPERVISOR: { total: 8, current: 5 },
      WAREHOUSE: { total: 8, current: 7 },
      FINANCE: { total: 7, current: 4 },
      ADMIN: { total: 18, current: 13 },
      SUPERADMIN: { total: 19, current: 13 },
    });
    expect(MENU_PLAN.WHOLESALER.every((item) => item.icon)).toBe(true);
  });

  it('ruxsatlar: superadmin hammasi, nazoratchi 3 ta, operator yozuvni faqat o‘zinikini; sozlamalar faqat superadmin', () => {
    expect(rolePermissions('SUPERADMIN')).toHaveLength(PERMISSIONS.length);
    expect(rolePermissions('SUPERVISOR').map((item) => item.id)).toEqual(['leadWork', 'leadTransfer', 'recordings']);
    const recordings = PERMISSIONS.find((item) => item.id === 'recordings');
    expect(recordings && grantOf(recordings, 'OPERATOR_LEAD')).toBe('own');
    const settings = PERMISSIONS.find((item) => item.id === 'settings');
    expect(settings && MATRIX_ROLES.filter((role) => grantOf(settings, role))).toEqual(['SUPERADMIN']);
  });
});
