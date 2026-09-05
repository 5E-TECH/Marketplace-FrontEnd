import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <main>
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
