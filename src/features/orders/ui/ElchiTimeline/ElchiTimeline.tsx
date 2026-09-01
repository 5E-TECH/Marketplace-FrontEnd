import { Button, Timeline } from 'antd';
import { ExternalLink, MapPin } from 'lucide-react';
import type { SellerOrder } from '../../model/orderTypes';
import styles from './ElchiTimeline.module.css';

const stages = [
  { statuses: ['NEW', 'PENDING'], title: 'Buyurtma qabul qilindi', description: 'Sotuvchi tasdiqlashi kutilmoqda' },
  { statuses: ['CONFIRMED'], title: 'Buyurtma tasdiqlandi', description: 'Buyurtma yetkazishga tayyorlanmoqda' },
  { statuses: ['SHIPMENT_CREATED'], title: 'Elchi jo‘natmasi yaratildi', description: 'Jo‘natma Elchi tizimiga topshirildi' },
  { statuses: ['ON_THE_ROAD'], title: 'Kuryer yo‘lda', description: 'Buyurtma xaridor tomon harakatlanmoqda' },
  { statuses: ['DELIVERED'], title: 'Yetkazildi', description: 'Buyurtma xaridorga topshirildi' },
] as const;

export function ElchiTimeline({ order }: { order: SellerOrder }) {
  <></>
  const currentIndex = stages.findIndex((stage) => (stage.statuses as readonly string[]).includes(order.status));
  const terminal = order.status === 'CANCELLED' ? { title: 'Bekor qilindi', color: 'red' } : order.status === 'RETURNED' ? { title: 'Qaytarildi', color: 'orange' } : null;
  const items = stages.map((stage, index) => ({
    color: terminal ? (index === 0 ? 'green' : 'gray') : index <= currentIndex ? 'green' : 'gray',
    children: <div className={styles.stage}><strong>{stage.title}</strong><span>{stage.description}</span>{index === 0 ? <time>{new Date(order.createdAt).toLocaleString('uz-UZ')}</time> : null}</div>,
  }));
  if (terminal) items.push({ color: terminal.color, children: <div className={styles.stage}><strong>{terminal.title}</strong><span>Elchi yetkazib berish jarayoni yakunlandi</span></div> });

  return <section className={styles.root} aria-label="Elchi status timeline">
    <div className={styles.heading}><span><MapPin size={18} /></span><div><strong>Elchi yo‘nalish tarixi</strong><small>{order.elchiShipmentId ? `Jo‘natma #${order.elchiShipmentId}` : 'Jo‘natma hali yaratilmagan'}</small></div></div>
    <Timeline items={items} />
    {order.trackingUrl ? <Button href={order.trackingUrl} target="_blank" rel="noopener noreferrer" icon={<ExternalLink size={16} />} block>Elchi’da kuzatish</Button> : null}
  </section>;
}
