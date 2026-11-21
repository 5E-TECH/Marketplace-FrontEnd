import type { AdminProduct, AdminProductListItem } from '../../../features/adminProducts/model/adminProductTypes';
import { appliesTo, MODERATION_RULES } from '../../../features/adminProducts/ui/adminProductModerationConfig';

/** Admin belgilagan bandlar va sabab — mahsulot almashganda tozalanadi. */
export interface DecisionState {
  checks: Record<string, boolean>;
  reason: string;
}

export const emptyDecision = (): DecisionState => ({ checks: {}, reason: '' });

/** Qo'llanadigan bandlar va nechtasi belgilangan: tasdiqlash faqat hammasi belgilansa (6.1). */
export function decisionProgress(product: AdminProduct, state: DecisionState) {
  const rules = MODERATION_RULES.filter((rule) => appliesTo(rule, product));
  const done = rules.filter((rule) => state.checks[rule.key]).length;
  return { rules, done, total: rules.length, complete: done === rules.length };
}

/** Navbat tartibi: optovik yuborgan vaqt bo'yicha, eng eskisi tepada (admin-moderatsiya). */
export const submittedAt = (product: AdminProductListItem) => product.submittedAt ?? product.updatedAt;
