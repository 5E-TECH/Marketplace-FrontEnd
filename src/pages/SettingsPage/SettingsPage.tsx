import { LockKeyhole, UserRound } from 'lucide-react';
import { Button, Card, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import styles from './SettingsPage.module.css';

export default function SettingsPage() {
  const navigate = useNavigate();
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
  </>;
}
