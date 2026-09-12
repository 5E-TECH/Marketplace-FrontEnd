import { useNavigate } from 'react-router-dom';
import { ContentState } from '../../shared/ui/ContentState/ContentState';

export default function AdminResourcePage() {
  const navigate = useNavigate();
  return <ContentState state="empty" title="Bu bo‘lim hali mavjud emas"
    description="Mavjud boshqaruv bo‘limlaridan foydalaning."
    actionLabel="Boshqaruvga qaytish" onAction={() => void navigate('/admin/overview')} />;
}
