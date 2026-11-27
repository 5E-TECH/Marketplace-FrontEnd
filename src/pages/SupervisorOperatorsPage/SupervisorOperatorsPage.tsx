import { UserPlus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppSelector } from '../../app/store/hooks';
import { selectAuthUser } from '../../features/auth/model/authSlice';
import { useSupervisorTeamQuery } from '../../features/staff/api/staffQueries';
import { userCode } from '../../features/staff/model/staffRules';
import { TemporaryPasswordDialog } from '../../features/staff/ui/TemporaryPasswordDialog';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { useMediaQuery } from '../../shared/lib/useMediaQuery';
import PlaceholderPage from '../PlaceholderPage/PlaceholderPage';
import { TeamTab } from './components/TeamTab';
import { parseSupervisorTab, SUPERVISOR_TABS, type SupervisorTab } from './model/teamMembers';
import styles from './SupervisorOperatorsPage.module.css';

/**
 * Nazoratchining «Operatorlar» bo'limi (nazoratchi-operatorlar, nazoratchi-jamoa): yorliqlar — «Hozir», «Hisobot»,
 * «Quvvat rejasi» (FE-11) va «Jamoa» (FE-15: jamoa tarkibini nazoratchi yuritadi, 15-qaror — asosiy variant).
 */
export default function SupervisorOperatorsPage() {
  const { t } = useTranslation();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const narrow = useMediaQuery('(max-width: 1023.98px)');
  const auth = useAppSelector(selectAuthUser);
  const [params, setParams] = useSearchParams();
  const tab = parseSupervisorTab(params.get('tab'));
  const [adding, setAdding] = useState(false);
  const [created, setCreated] = useState<{ name: string; code: string; password: string } | null>(null);
  const team = useSupervisorTeamQuery();
  const selectedRef = useRef<HTMLButtonElement>(null);
  const viewer = { id: auth?.id ?? '', code: userCode(auth?.id ?? ''), name: auth?.name ?? '' };

  useEffect(() => {
    if (narrow) selectedRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [narrow, tab]);

  const goTab = (key: SupervisorTab) => setParams(key === 'now' ? {} : { tab: key }, { replace: true });

  return (
    <div className={styles.page} data-testid="supervisor-operators">
      <div className={styles.toolbar}>
        <div className={styles.tabs} role="tablist" aria-label={t('staff.sv.tabs')}>
          {SUPERVISOR_TABS.map((key) => (
            <button key={key} type="button" role="tab" ref={tab === key ? selectedRef : undefined} className={styles.tab} aria-selected={tab === key} onClick={() => goTab(key)}>
              {t(`staff.sv.tab.${key}`)}
            </button>
          ))}
        </div>
        {tab === 'team' && !phone && team.data?.team ? (
          <div className={styles.actions}>
            <button type="button" className={styles.primaryAction} onClick={() => setAdding(true)}><UserPlus aria-hidden />{t('staff.ops.add')}</button>
          </div>
        ) : null}
      </div>
      {tab === 'team' ? (
        <TeamTab
          layout={phone ? 'phone' : narrow ? 'tablet' : 'desktop'}
          viewer={viewer}
          adding={adding}
          onAddChange={setAdding}
          onPassword={setCreated}
          onShowNow={(operatorId) => setParams({ operator: operatorId })}
        />
      ) : <PlaceholderPage />}
      {created ? <TemporaryPasswordDialog name={created.name} code={created.code} password={created.password} noSms onClose={() => setCreated(null)} /> : null}
    </div>
  );
}
