import { TriangleAlert as WarningOutlined, X as CloseOutlined } from 'lucide-react';
import { Button } from 'antd';
import { useState } from 'react';
import styles from './MainLayout.module.css';

export function ApprovalBanner({ pending }: { pending: boolean }) {
  const [visible, setVisible] = useState(true);

  if (!pending || !visible) return null;

  return (
    <div className={styles.approvalBanner} role="status">
      <WarningOutlined />
      <span>
        Do‘koningiz hozircha ko‘rib chiqilmoqda. Tasdiqlangach barcha funksiyalar
        ochiladi.
      </span>
      <Button type="link" size="small">Batafsil</Button>
      <Button
        type="text"
        size="small"
        icon={<CloseOutlined />}
        aria-label="Xabarni yopish"
        onClick={() => setVisible(false)}
      />
    </div>
  );
}
