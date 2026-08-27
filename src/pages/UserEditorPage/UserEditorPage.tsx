import { App, Form } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useCreateUserMutation } from '../../features/users/api/userQueries';
import { UserForm, type UserFormValues } from '../../features/users/ui/UserForm';
import { BackButton } from '../../shared/ui/BackButton/BackButton';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { getApiFieldErrors } from '../../features/auth/lib/getAuthErrorMessage';
import { getUserErrorMessage } from '../../features/users/lib/getUserErrorMessage';

export default function UserEditorPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { language, t } = useTranslation();
  const [form] = Form.useForm<UserFormValues>();
  const mutation = useCreateUserMutation();
  const submit = (values: UserFormValues) => mutation.mutate({ name: values.name.trim(), phone: values.phone.replace(/\s/g, ''), password: values.password }, { onSuccess: () => { void message.success(t('users.created')); void navigate('/users', { replace: true }); }, onError: (error) => { const fields = getApiFieldErrors(error).filter(({ name }) => ['name', 'phone', 'password'].includes(name)); if (fields.length) form.setFields(fields.map(({ name, errors }) => ({ name: [name as keyof UserFormValues], errors }))); void message.error(getUserErrorMessage(error, language)); } });
  return <main><PageHeader before={<BackButton fallback="/users" disabled={mutation.isPending} />} title={t('users.createTitle')} description={t('users.createDescription')} /><UserForm form={form} loading={mutation.isPending} onSubmit={submit} /></main>;
}
