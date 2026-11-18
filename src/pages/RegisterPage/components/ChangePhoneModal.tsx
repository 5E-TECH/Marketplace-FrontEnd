import { Button, Form } from 'antd';
import { useState } from 'react';
import type { OtpFailure } from '../../../features/sellerAuth/api/sellerAuthApi';
import { pendingLoading, sellerPhoneRules } from '../../../features/sellerAuth/lib/fieldRules';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { formatUzPhone, getUzLocalPhone } from '../../../shared/lib/phone';
import { PhoneInput } from '../../../shared/ui/AuthLayout/PhoneInput';
import { SheetModal } from '../../../shared/ui/SheetModal/SheetModal';
import formStyles from '../../../shared/ui/AuthLayout/authForm.module.css';
import styles from '../RegisterPage.module.css';

interface ChangePhoneModalProps {
  open: boolean;
  currentPhone: string;
  /** `null` — yangi raqamga kod yuborildi; aks holda xato maydon ostida ko'rsatiladi. */
  requestCode: (phone: string) => Promise<OtpFailure | null>;
  onDone: () => void;
  onCancel: () => void;
}

/** «Raqamni o‘zgartirish» (sotuvchi-royxat §4, 480 px): eski kod bekor, yangi raqamga yangi kod. */
export function ChangePhoneModal({ open, currentPhone, requestCode, onDone, onCancel }: ChangePhoneModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<{ phone: string }>();
  const [sending, setSending] = useState(false);

  const handleFinish = async ({ phone }: { phone: string }) => {
    setSending(true);
    const failure = await requestCode(phone).finally(() => setSending(false));
    if (!failure || failure.kind === 'blocked') {
      form.resetFields();
      onDone();
      return;
    }
    const error =
      failure.kind === 'alreadyRegistered'
        ? t('register.existsTitle')
        : failure.kind === 'operator'
          ? t('otp.phoneOperator')
          : t('otp.sendFailedText');
    form.setFields([{ name: 'phone', errors: [error] }]);
  };

  return (
    <SheetModal
      open={open}
      width={480}
      title={t('register.changeNumber')}
      footer={null}
      destroyOnHidden
      onCancel={() => {
        form.resetFields();
        onCancel();
      }}
    >
      <p className={styles.modalLead}>{t('register.changeText')}</p>
      <Form form={form} layout="vertical" requiredMark={false} size="large" onFinish={(values) => void handleFinish(values)} className={styles.modalForm}>
        <div className={styles.oldNumber}>
          <span className={formStyles.fieldLabel}>{t('register.changeOld')}</span>
          <strong>{formatUzPhone(currentPhone)}</strong>
          <span className={formStyles.fieldHint}>{t('register.changeOldHint')}</span>
        </div>
        <Form.Item
          className={formStyles.field}
          label={t('register.changeNew')}
          name="phone"
          normalize={(value?: string) => getUzLocalPhone(value ?? '')}
          rules={sellerPhoneRules(t)}
          validateTrigger={['onBlur', 'onSubmit']}
          extra={t('register.changeNewHint')}
        >
          <PhoneInput autoFocus />
        </Form.Item>
        <div className={styles.modalActions}>
          <Button className={formStyles.secondary} onClick={() => { form.resetFields(); onCancel(); }}>{t('register.cancel')}</Button>
          <Button className={formStyles.secondary} type="primary" htmlType="submit" loading={pendingLoading(sending)}>{t('otp.getCode')}</Button>
        </div>
      </Form>
    </SheetModal>
  );
}
