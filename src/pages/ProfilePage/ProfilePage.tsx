import { Mail, Phone, Settings, ShieldCheck, UserRound } from 'lucide-react';
import { Avatar, Button, Card, Descriptions, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../app/store/hooks';
import { selectAuthUser } from '../../features/auth/model/authSlice';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import styles from './ProfilePage.module.css';

const roleLabels = {
  SELLER: 'Sotuvchi',
  BUYER: 'Xaridor',
  ADMIN: 'Administrator',
  SUPERADMIN: 'Super administrator',
} as const;

export default function ProfilePage() {
  const navigate = useNavigate();
  const user = useAppSelector(selectAuthUser);

  if (!user) return null;

  return (
    <main className={styles.page}>
      <PageHeader
        title="Mening profilim"
        description="Shaxsiy akkaunt va kirish ma’lumotlaringiz"
        extra={
          <Button icon={<Settings />} onClick={() => void navigate('/settings')}>
            Sozlamalar
          </Button>
        }
      />

      <Card className={styles.profileCard}>
        <section className={styles.identity}>
          <div className={styles.avatarRing}>
            <Avatar size={104} src={user.avatarUrl}>
              {user.name.slice(0, 2).toUpperCase()}
            </Avatar>
          </div>
          <div className={styles.identityCopy}>
            <span className={styles.eyebrow}>AKKAUNT PROFILI</span>
            <Typography.Title level={2}>{user.name}</Typography.Title>
            <div className={styles.tags}>
              <Tag color="gold">{roleLabels[user.role]}</Tag>
              <Tag color={user.isActive ? 'success' : 'warning'}>
                {user.isActive ? 'Faol akkaunt' : 'Tekshiruvda'}
              </Tag>
            </div>
          </div>
        </section>

        <section className={styles.details}>
          <header>
            <div><UserRound /><span>Shaxsiy ma’lumotlar</span></div>
            <p>Bu ma’lumotlar akkauntingizga tegishli. Do‘kon ma’lumotlari alohida “Do‘kon profili” bo‘limida boshqariladi.</p>
          </header>
          <Descriptions column={{ xs: 1, md: 2 }} bordered>
            <Descriptions.Item label={<span className={styles.label}><UserRound /> Ism</span>}>
              {user.name}
            </Descriptions.Item>
            <Descriptions.Item label={<span className={styles.label}><Phone /> Telefon</span>}>
              {user.phone}
            </Descriptions.Item>
            <Descriptions.Item label={<span className={styles.label}><Mail /> Email</span>}>
              {user.email ?? 'Kiritilmagan'}
            </Descriptions.Item>
            <Descriptions.Item label={<span className={styles.label}><ShieldCheck /> Rol</span>}>
              {roleLabels[user.role]}
            </Descriptions.Item>
          </Descriptions>
        </section>
      </Card>
    </main>
  );
}
