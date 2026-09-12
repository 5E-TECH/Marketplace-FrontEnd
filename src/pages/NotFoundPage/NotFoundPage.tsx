import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';
import styles from './NotFoundPage.module.css';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <main className={styles.page}>
      <Result
        status="404"
        title="404"
        subTitle="Sahifa topilmadi"
        extra={
          <Button type="primary" onClick={() => void navigate('/')}>
            Bosh sahifaga qaytish
          </Button>
        }
      />
    </main>
  );
}
