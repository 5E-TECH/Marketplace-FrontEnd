import { Button } from 'antd';
import { Activity, CheckCircle2, Clock3, Database, RefreshCw, Server, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { useSystemHealthQuery, useSystemReadinessQuery } from '../../features/systemHealth/api/systemHealthQueries';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { asRecord, readNumber, readText } from '../../shared/api/responseFields';
import { formatDateTime } from '../../shared/lib/date';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import styles from './AdminSystemHealthPage.module.css';

interface ServiceInfo { key: string; name: string; ready: boolean; status: string; uptime: number; timestamp: string }

export default function AdminSystemHealthPage() {
  const { locale, t } = useTranslation();
  const health = useSystemHealthQuery(); const readiness = useSystemReadinessQuery();
  const refreshing = health.isFetching || readiness.isFetching;
  const healthData = asRecord(health.data); const readinessData = asRecord(readiness.data);
  const services = readServices(readinessData.services); const readyCount = services.filter(service => service.ready).length;
  const overallHealthy = !health.isError && !readiness.isError && !health.isPending && !readiness.isPending;
  const refresh = () => void Promise.all([health.refetch(), readiness.refetch()]);
  return <main><PageHeader title={t('admin.health.title')} description={t('admin.health.description')} extra={<Button icon={<RefreshCw size={16} />} loading={refreshing} onClick={refresh}>{t('admin.health.refresh')}</Button>} />
    <section className={styles.summary} aria-label={t('admin.health.summary')}>
      <SummaryCard icon={overallHealthy ? <CheckCircle2 /> : <TriangleAlert />} label={t('admin.health.overall')} value={overallHealthy ? t('admin.health.stable') : refreshing ? t('admin.health.checking') : t('admin.health.attention')} tone={overallHealthy ? 'success' : 'warning'} />
      <SummaryCard icon={<Activity />} label="API Gateway" value={health.isError ? t('admin.health.noConnection') : readText(healthData, 'service') || 'api-gateway'} caption={readText(healthData, 'status') || (health.isPending ? t('admin.health.checking') : t('admin.health.working'))} tone={health.isError ? 'error' : 'success'} />
      <SummaryCard icon={<Server />} label={t('admin.health.readyServices')} value={`${readyCount} / ${services.length}`} caption={readText(readinessData, 'status') || 'readiness'} tone={readyCount === services.length && services.length > 0 ? 'success' : 'warning'} />
      <SummaryCard icon={<Clock3 />} label={t('admin.health.uptime')} value={formatUptime(readNumber(healthData, ['uptime']), t)} caption={readText(healthData, 'timestamp') ? formatDateTime(readText(healthData, 'timestamp'), locale) : '—'} />
    </section>
    {health.isError || readiness.isError ? <section className={styles.alert}><TriangleAlert /><div><strong>{t('admin.health.partialFailure')}</strong><span>{health.isError ? getAuthErrorMessage(health.error) : getAuthErrorMessage(readiness.error)}</span></div></section> : null}
    <section className={styles.servicesSection}><div className={styles.sectionHeading}><div><h2>{t('admin.health.microservices')}</h2><p>{t('admin.health.microservicesDescription')}</p></div><code>GET /health/readiness</code></div>
      {readiness.isPending ? <div className={styles.skeletonGrid}>{[1, 2, 3, 4].map(item => <span key={item} />)}</div> : services.length ? <div className={styles.serviceGrid}>{services.map(service => <ServiceCard key={service.key} service={service} />)}</div> : <div className={styles.empty}><Database /><strong>{t('admin.health.noServices')}</strong><span>{t('admin.health.noServicesDescription')}</span></div>}
    </section>
    <aside className={styles.note}><Server /><div><strong>{t('admin.health.webhookTitle')}</strong><p><code>POST /webhooks/elchi</code> — {t('admin.health.webhookDescription')}</p></div></aside>
  </main>;
}

function SummaryCard({ icon, label, value, caption, tone = 'neutral' }: { icon: ReactNode; label: string; value: string; caption?: string; tone?: 'neutral' | 'success' | 'warning' | 'error' }) { return <article className={`${styles.summaryCard} ${styles[tone]}`}><span className={styles.summaryIcon}>{icon}</span><div><span>{label}</span><strong>{value}</strong>{caption ? <small>{caption}</small> : null}</div></article>; }
function ServiceCard({ service }: { service: ServiceInfo }) { const { locale, t } = useTranslation(); return <article className={styles.serviceCard}><header><span className={styles.serviceIcon}><Server /></span><div><strong>{service.name}</strong><span>{service.key}</span></div><span className={service.ready ? styles.online : styles.offline}><i />{service.ready ? t('admin.health.ready') : t('admin.health.problem')}</span></header><div className={styles.serviceMeta}><div><span>{t('common.status')}</span><strong>{service.status || '—'}</strong></div><div><span>{t('admin.health.uptime')}</span><strong>{formatUptime(service.uptime, t)}</strong></div></div>{service.timestamp ? <footer>{t('admin.health.updated', { date: formatDateTime(service.timestamp, locale) })}</footer> : null}</article>; }
function readServices(value: unknown): ServiceInfo[] { return Object.entries(asRecord(value)).map(([key, raw]) => { const service = asRecord(raw); return { key, name: readText(service, 'service') || key, ready: service.ready === true || readText(service, 'status').toLowerCase() === 'ok', status: readText(service, 'status'), uptime: readNumber(service, ['uptime']), timestamp: readText(service, 'timestamp') }; }); }
function formatUptime(seconds: number, t: ReturnType<typeof useTranslation>['t']): string { if (!seconds) return '—'; const days = Math.floor(seconds / 86_400); const hours = Math.floor((seconds % 86_400) / 3_600); const minutes = Math.floor((seconds % 3_600) / 60); return days ? t('admin.health.daysHours', { days, hours }) : hours ? t('admin.health.hoursMinutes', { hours, minutes }) : t('admin.health.minutes', { minutes }); }
