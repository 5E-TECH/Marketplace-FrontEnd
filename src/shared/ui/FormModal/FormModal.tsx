import { Form, Modal } from 'antd';
import type { FormInstance } from 'antd';
import type { ReactNode } from 'react';
import styles from './FormModal.module.css';
import { useTranslation } from '../../i18n/useTranslation';

interface FormModalProps<Values extends object> {
  className?: string;
  open: boolean;
  title: ReactNode;
  form: FormInstance<Values>;
  children: ReactNode;
  initialValues?: Partial<Values>;
  submitText?: string;
  cancelText?: string;
  loading?: boolean;
  resetOnClose?: boolean;
  scrollToFirstError?: boolean | { focus?: boolean };
  onSubmit: (values: Values) => void | Promise<void>;
  onCancel: () => void;
}

export function FormModal<Values extends object>({
  className,
  open,
  title,
  form,
  children,
  initialValues,
  submitText,
  cancelText,
  loading = false,
  resetOnClose = true,
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
      confirmLoading={loading}
      closable={!loading}
      maskClosable={!loading}
      keyboard={!loading}
      destroyOnHidden
      onOk={() => void form.submit()}
      onCancel={close}
      afterOpenChange={(isOpen) => {
        if (isOpen && initialValues) {
          form.setFieldsValue(initialValues);
        }
        if (!isOpen && resetOnClose) {
          form.resetFields();
        }
      }}
    >
      <Form<Values>
        form={form}
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
      </Form>
    </Modal>
  );
}
