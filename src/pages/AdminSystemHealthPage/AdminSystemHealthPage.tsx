import { Button } from 'antd';
import { Activity, CheckCircle2, Clock3, Database, RefreshCw, Server, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { useSystemHealthQuery, useSystemReadinessQuery } from '../../features/systemHealth/api/systemHealthQueries';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { asRecord, readNumber, readText } from '../../shared/api/responseFields';
import { formatDateTime } from '../../shared/lib/date';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import styles from './AdminSystemHealthPage.module.css';

interface ServiceInfo { key: string; name: string; ready: boolean; status: string; uptime: number; timestamp: string }

export default function AdminSystemHealthPage() {
  const health = useSystemHealthQuery(); const readiness = useSystemReadinessQuery();
  const refreshing = health.isFetching || readiness.isFetching;
  const healthData = asRecord(health.data); const readinessData = asRecord(readiness.data);
  const services = readServices(readinessData.services); const readyCount = services.filter(service => service.ready).length;
  const overallHealthy = !health.isError && !readiness.isError && !health.isPending && !readiness.isPending;
  const refresh = () => void Promise.all([health.refetch(), readiness.refetch()]);
  return <main><PageHeader title="Tizim holati" description="API gateway va mikroservislarning joriy ishlash holati" extra={<Button icon={<RefreshCw size={16} />} loading={refreshing} onClick={refresh}>Yangilash</Button>} />
    <section className={styles.summary} aria-label="Tizim xulosasi">
      <SummaryCard icon={overallHealthy ? <CheckCircle2 /> : <TriangleAlert />} label="Umumiy holat" value={overallHealthy ? 'Barqaror' : refreshing ? 'Tekshirilmoqda' : 'E’tibor kerak'} tone={overallHealthy ? 'success' : 'warning'} />
      <SummaryCard icon={<Activity />} label="API Gateway" value={health.isError ? 'Aloqa yo‘q' : readText(healthData, 'service') || 'api-gateway'} caption={readText(healthData, 'status') || (health.isPending ? 'Tekshirilmoqda' : 'Ishlayapti')} tone={health.isError ? 'error' : 'success'} />
      <SummaryCard icon={<Server />} label="Tayyor servislar" value={`${readyCount} / ${services.length}`} caption={readText(readinessData, 'status') || 'readiness'} tone={readyCount === services.length && services.length > 0 ? 'success' : 'warning'} />
      <SummaryCard icon={<Clock3 />} label="Gateway uptime" value={formatUptime(readNumber(healthData, ['uptime']))} caption={readText(healthData, 'timestamp') ? formatDateTime(readText(healthData, 'timestamp')) : '—'} />
    </section>
    {health.isError || readiness.isError ? <section className={styles.alert}><TriangleAlert /><div><strong>Ba’zi tekshiruvlar muvaffaqiyatsiz</strong><span>{health.isError ? getAuthErrorMessage(health.error) : getAuthErrorMessage(readiness.error)}</span></div></section> : null}
    <section className={styles.servicesSection}><div className={styles.sectionHeading}><div><h2>Mikroservislar</h2><p>Har bir servisning readiness va ishlash vaqti</p></div><code>GET /health/readiness</code></div>
      {readiness.isPending ? <div className={styles.skeletonGrid}>{[1, 2, 3, 4].map(item => <span key={item} />)}</div> : services.length ? <div className={styles.serviceGrid}>{services.map(service => <ServiceCard key={service.key} service={service} />)}</div> : <div className={styles.empty}><Database /><strong>Servis ma’lumoti topilmadi</strong><span>Readiness endpoint hali servislar ro‘yxatini qaytarmadi.</span></div>}
    </section>
    <aside className={styles.note}><Server /><div><strong>Elchi webhook server tomonidan boshqariladi</strong><p><code>POST /webhooks/elchi</code> frontenddan chaqirilmaydi. <code>X-Elchi-Signature</code> imzosi faqat backendda saqlanadi.</p></div></aside>
  </main>;
}

function SummaryCard({ icon, label, value, caption, tone = 'neutral' }: { icon: ReactNode; label: string; value: string; caption?: string; tone?: 'neutral' | 'success' | 'warning' | 'error' }) { return <article className={`${styles.summaryCard} ${styles[tone]}`}><span className={styles.summaryIcon}>{icon}</span><div><span>{label}</span><strong>{value}</strong>{caption ? <small>{caption}</small> : null}</div></article>; }
function ServiceCard({ service }: { service: ServiceInfo }) { return <article className={styles.serviceCard}><header><span className={styles.serviceIcon}><Server /></span><div><strong>{service.name}</strong><span>{service.key}</span></div><span className={service.ready ? styles.online : styles.offline}><i />{service.ready ? 'Tayyor' : 'Muammo'}</span></header><div className={styles.serviceMeta}><div><span>Holati</span><strong>{service.status || '—'}</strong></div><div><span>Uptime</span><strong>{formatUptime(service.uptime)}</strong></div></div>{service.timestamp ? <footer>Yangilangan: {formatDateTime(service.timestamp)}</footer> : null}</article>; }
function readServices(value: unknown): ServiceInfo[] { return Object.entries(asRecord(value)).map(([key, raw]) => { const service = asRecord(raw); return { key, name: readText(service, 'service') || key, ready: service.ready === true || readText(service, 'status').toLowerCase() === 'ok', status: readText(service, 'status'), uptime: readNumber(service, ['uptime']), timestamp: readText(service, 'timestamp') }; }); }
function formatUptime(seconds: number): string { if (!seconds) return '—'; const days = Math.floor(seconds / 86_400); const hours = Math.floor((seconds % 86_400) / 3_600); const minutes = Math.floor((seconds % 3_600) / 60); return days ? `${days} kun ${hours} soat` : hours ? `${hours} soat ${minutes} daqiqa` : `${minutes} daqiqa`; }
