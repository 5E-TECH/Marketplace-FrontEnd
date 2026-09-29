import { Alert, Checkbox, Form } from 'antd';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import { FormModal } from '../../../../shared/ui/FormModal/FormModal';
import { NumberControl, TextAreaControl } from '../../../../shared/ui/FormControls/FormControls';
import { defaultRestock } from '../../lib/returnRules';
import type { ReturnRequest } from '../../model/returnTypes';
import { returnMoney as money } from '../../lib/returnMoney';

export type ReturnDecision = 'review' | 'approve' | 'reject';

interface DecisionValues { text: string }

/**
 * Ko'rib chiqish / tasdiqlash — izoh ixtiyoriy; rad etish — sabab majburiy
 * (xaridorga ko'rsatiladi).
 */
export function ReturnDecisionModal({ decision, hint, loading, onSubmit, onCancel }: {
  decision: ReturnDecision | null;
  hint?: string;
  loading: boolean;
  onSubmit: (text: string) => void | Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [form] = Form.useForm<DecisionValues>();
  const reject = decision === 'reject';
  const title = decision === 'review' ? t('returns.reviewTitle') : reject ? t('returns.rejectTitle') : t('returns.approveTitle');
  const submitText = decision === 'review' ? t('returns.review') : reject ? t('returns.reject') : t('returns.approve');
  return <FormModal<DecisionValues>
    open={decision !== null}
    title={title}
    form={form}
    name="return-decision"
    initialValues={{ text: '' }}
    submitText={submitText}
    danger={reject}
    loading={loading}
    onCancel={onCancel}
    onSubmit={({ text }) => onSubmit(text.trim())}
  >
    {hint ? <Alert type={reject ? 'warning' : 'info'} showIcon title={hint} /> : null}
    <Form.Item
      name="text"
      label={reject ? t('returns.rejectReason') : t('returns.comment')}
      rules={reject ? [{ required: true, whitespace: true, message: t('returns.rejectReasonRequired') }, { max: 500 }] : [{ max: 500 }]}
    >
      <TextAreaControl rows={3} maxLength={500} showCount />
    </Form.Item>
  </FormModal>;
}

interface RefundValues { amount: number | null; restock: boolean; comment: string }
export interface RefundSubmit { amount: number; restock: boolean; comment: string }

/**
 * Pulni qaytarish (faqat SUPERADMIN). Summa ko'pi bilan so'ralgan summa — kamrog'i
 * qisman qaytarish. COD'da pul qo'lda qaytariladi, shuning uchun izoh majburiy.
 * Omborga qaytarish belgisi sabab bo'yicha backend default'i bilan ochiladi.
 */
export function ReturnRefundModal({ value, loading, onSubmit, onCancel }: {
  value: ReturnRequest | null;
  loading: boolean;
  onSubmit: (payload: RefundSubmit) => void | Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [form] = Form.useForm<RefundValues>();
  const max = value?.requestedAmount ?? 0;
  const cod = value?.paymentMethod === 'cod';
  return <FormModal<RefundValues>
    open={value !== null}
    title={t('returns.refundTitle')}
    form={form}
    name="return-refund"
    initialValues={value ? { amount: value.requestedAmount, restock: defaultRestock(value.reason), comment: '' } : undefined}
    submitText={t('returns.refund')}
    danger
    loading={loading}
    onCancel={onCancel}
    onSubmit={({ amount, restock, comment }) => onSubmit({ amount: amount ?? max, restock, comment: comment.trim() })}
  >
    <Alert type="warning" showIcon title={cod ? t('returns.refundCod') : t('returns.refundOnline')} />
    <Form.Item
      name="amount"
      label={t('returns.refundAmount')}
      extra={t('returns.refundAmountHint', { amount: money(max) })}
      rules={[
        { required: true, message: t('returns.refundAmountRequired') },
        { type: 'number', min: 1, message: t('returns.refundAmountRequired') },
        { type: 'number', max, message: t('returns.refundAmountMax', { amount: money(max) }) },
      ]}
    >
      <NumberControl min={1} max={max} precision={0} suffix="UZS" style={{ width: '100%' }} />
    </Form.Item>
    <Form.Item name="restock" valuePropName="checked" extra={t('returns.restockHint')}>
      <Checkbox>{t('returns.restock')}</Checkbox>
    </Form.Item>
    <Form.Item
      name="comment"
      label={cod ? t('returns.refundCommentCod') : t('returns.refundComment')}
      rules={cod ? [{ required: true, whitespace: true, message: t('returns.refundCommentRequired') }, { max: 500 }] : [{ max: 500 }]}
    >
      <TextAreaControl rows={3} maxLength={500} showCount />
    </Form.Item>
  </FormModal>;
}
