import { Button, Result } from 'antd';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <main>
      <Result
        status="404"
        title="404"
        subTitle="Sahifa topilmadi"
        extra={
          <Link to="/">
            <Button type="primary">Bosh sahifaga qaytish</Button>
          </Link>
        }
      />
    </main>
  );
}
