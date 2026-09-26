import { Form, Modal } from 'antd';
import type { FormInstance } from 'antd';
import { useLayoutEffect, type ReactNode } from 'react';
import styles from './FormModal.module.css';
import { useTranslation } from '../../i18n/useTranslation';

interface FormModalProps<Values extends object> {
  className?: string;
  open: boolean;
  title: ReactNode;
  form: FormInstance<Values>;
  children: ReactNode;
  /** Har ochilishda forma shu qiymatlardan boshlanadi — ochishdan oldin `form.setFieldsValue` shart emas. */
  initialValues?: Partial<Values>;
  /** `<Form name>`: maydon id'lari sahifadagi boshqa forma bilan to'qnashmasligi uchun. */
  name?: string;
  submitText?: string;
  cancelText?: string;
  loading?: boolean;
  /** Tasdiqlash tugmasi xavfli amal rangida (masalan, rad etish). */
  danger?: boolean;
  scrollToFirstError?: boolean | { focus?: boolean };
  onSubmit: (values: Values) => void | Promise<void>;
  onCancel: () => void;
}

/**
 * Modal har ochilganda formani `initialValues` ga keltiradi.
 *
 * Form ichida va maydonlardan KEYIN turadi: effekt Form DOM'ga ulangach va
 * maydonlar ro'yxatdan o'tgach ishlaydi. Ochiq turganda `initialValues`
 * yangilansa (ota-sahifa qayta render bo'lib yangi obyekt uzatsa),
 * foydalanuvchi kiritgan qiymatlar ustidan yozilmaydi.
 */
function ResetOnOpen({ form, open }: { form: FormInstance; open: boolean }) {
  useLayoutEffect(() => {
    if (open) form.resetFields();
  }, [form, open]);
  return null;
}

export function FormModal<Values extends object>({
  className,
  open,
  title,
  form,
  children,
  initialValues,
  name,
  submitText,
  cancelText,
  loading = false,
  danger = false,
  scrollToFirstError = { focus: true },
  onSubmit,
  onCancel,
}: FormModalProps<Values>) {
  const { t } = useTranslation();

  const close = () => {
    if (!loading) onCancel();
  };

  return (
    <Modal
      className={className}
      rootClassName={styles.modal}
      open={open}
      title={title}
      okText={submitText ?? t('common.save')}
      cancelText={cancelText ?? t('common.cancel')}
      okButtonProps={danger ? { danger: true } : undefined}
      confirmLoading={loading}
      closable={!loading}
      mask={{ closable: !loading }}
      keyboard={!loading}
      destroyOnHidden
      onOk={() => void form.submit()}
      onCancel={close}
    >
      <Form<Values>
        form={form}
        name={name}
        initialValues={initialValues}
        layout="vertical"
        requiredMark
        scrollToFirstError={scrollToFirstError}
        onFinish={(values) => void onSubmit(values)}
        onFinishFailed={({ errorFields }) => {
          const firstField = errorFields[0]?.name;
          if (firstField) form.scrollToField(firstField, { focus: true });
        }}
      >
        {children}
        <ResetOnOpen form={form} open={open} />
      </Form>
    </Modal>
  );
}
