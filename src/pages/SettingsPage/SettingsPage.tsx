import { LockKeyhole, LogOut, MonitorSmartphone, UserRound } from 'lucide-react';
import { App, Button, Card, List, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import styles from './SettingsPage.module.css';
import { useAuthSessionsQuery, useRevokeAuthSessionMutation } from '../../features/auth/api/authQueries';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { formatDateTime } from '../../shared/lib/date';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const sessions = useAuthSessionsQuery();
  const revoke = useRevokeAuthSessionMutation();
  return <>
    <PageHeader title="Sozlamalar" description="Akkaunt sozlamalarini boshqaring" />
    <Card className={styles.settingsCard} title={<><LockKeyhole /> Xavfsizlik va profil</>}>
      <div className={styles.profileToolbar}>
        <div>
          <Typography.Title level={4}>Profil ma’lumotlari</Typography.Title>
          <Typography.Text type="secondary">Ism, telefon, email, avatar va parol Profil sahifasida boshqariladi.</Typography.Text>
        </div>
        <Button type="primary" icon={<UserRound />} onClick={() => void navigate('/profile')}>Profilni tahrirlash</Button>
      </div>
    </Card>
    <Card className={styles.settingsCard} title={<><MonitorSmartphone /> Faol sessiyalar</>}>
      {sessions.isPending ? <ContentState state="loading" /> : sessions.isError ? <ContentState state="error" description={getAuthErrorMessage(sessions.error)} onAction={() => void sessions.refetch()} /> : <List dataSource={sessions.data} locale={{ emptyText: 'Faol sessiyalar topilmadi' }} renderItem={(session) => <List.Item actions={session.current ? [<Tag key="current" color="success">Joriy qurilma</Tag>] : [<Button key="revoke" danger type="text" icon={<LogOut size={16} />} loading={revoke.isPending && revoke.variables === session.id} onClick={() => revoke.mutate(session.id, { onSuccess: () => void message.success('Sessiya yopildi'), onError: (error) => void message.error(getAuthErrorMessage(error)) })}>Sessiyani yopish</Button>]}><List.Item.Meta avatar={<span className={styles.deviceIcon}><MonitorSmartphone /></span>} title={session.userAgent} description={`${session.ipAddress} · ${formatDateTime(session.lastUsedAt ?? session.createdAt)}`} /></List.Item>} />}
    </Card>
  </>;
}
