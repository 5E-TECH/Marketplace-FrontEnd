import { Ban, CircleCheckBig } from 'lucide-react';

export const ADMIN_PRODUCT_MODERATION_CONFIG = {
  active: {
    action: 'suspend' as const,
    Icon: Ban,
    labelKey: 'adminProducts.suspend' as const,
    titleKey: 'adminProducts.suspendTitle' as const,
    descriptionKey: 'adminProducts.suspendDescription' as const,
    successKey: 'adminProducts.suspended' as const,
    danger: true,
  },
  blocked: {
    action: 'reactivate' as const,
    Icon: CircleCheckBig,
    labelKey: 'adminProducts.reactivate' as const,
    titleKey: 'adminProducts.reactivateTitle' as const,
    descriptionKey: 'adminProducts.reactivateDescription' as const,
    successKey: 'adminProducts.reactivated' as const,
    danger: false,
  },
} as const;

export function getAdminProductModerationConfig(isBlocked: boolean) {
  return ADMIN_PRODUCT_MODERATION_CONFIG[isBlocked ? 'blocked' : 'active'];
}
