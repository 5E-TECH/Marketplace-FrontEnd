import { Archive, ChevronDown, CircleX, Headphones, LoaderCircle, Pause, Play, RefreshCw, RotateCcw, RotateCw, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { formatAudioTime } from './audioTime';
import styles from './AudioPlayer.module.css';

/** Tezliklar [taklif: 0.75× · 1× · 1.25× · 1.5× · 2×] (komponentlar-E §22). */
const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;
const SKIP_SECONDS = 10;

interface AudioPlayerProps {
  /** Yozuv manzili; yo'q bo'lsa — holat `missing` yoki `expired` ko'rinadi. */
  src: string | null;
  title: string;
  subtitle?: string;
  /** Yozuv o'chirilgan (90 kun o'tgan) yoki umuman yo'q (hisobotda xato). */
  unavailable?: 'expired' | 'missing';
  /** «14.04.2027 gacha saqlanadi (90 kun)» — to'liq ko'rinish ostida. */
  keptUntil?: string;
  /** Ixcham — lid tarixi qatorida (tugma 36, chiziq va vaqt). */
  compact?: boolean;
}

/**
 * Qo'ng'iroq yozuvi pleyeri (komponentlar-E §22): −10 s · ijro/pauza · +10 s · «01:12 / 03:24» · tezlik.
 * Joy chizig'i — vizual chiziq ustida shaffof `range` (klaviatura va ekran o'qigich uchun). Probel — pauza,
 * ← / → — 10 s [taklif]. Holatlar: yuklanmoqda, ochib bo'lmadi (qayta urinish), o'chirilgan, topilmadi.
 */
export function AudioPlayer({ src, title, subtitle, unavailable, keptUntil, compact = false }: AudioPlayerProps) {
  const { t } = useTranslation();
  const audio = useRef<HTMLAudioElement>(null);
  const speedId = useId();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState<number>(1);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (audio.current) audio.current.playbackRate = speed;
  }, [speed, status]);

  /**
   * Keshdagi yozuvda `loadedmetadata` tinglovchi ulanishidan oldin o'tib ketishi mumkin — element
   * ulanganda tayyor bo'lsa holat shu yerda olinadi.
   */
  const attach = useCallback((node: HTMLAudioElement | null) => {
    audio.current = node;
    if (node?.error) {
      setStatus('error');
    } else if (node && node.readyState >= HTMLMediaElement.HAVE_METADATA) {
      setDuration(node.duration);
      setStatus('ready');
    }
  }, []);

  if (unavailable || !src) {
    const expired = unavailable === 'expired';
    return (
      <div className={styles.problem} data-tone={expired ? 'neutral' : 'danger'} role="status">
        <span className={styles.problemIcon} aria-hidden>{expired ? <Archive /> : <CircleX />}</span>
        <span className={styles.problemText}>{expired ? t('audio.expired') : t('audio.missing')}</span>
      </div>
    );
  }

  const seek = (seconds: number) => {
    const element = audio.current;
    if (!element || status !== 'ready') return;
    const next = Math.min(Math.max(0, seconds), duration || element.duration || 0);
    element.currentTime = next;
    setCurrent(next);
  };
  const toggle = () => {
    const element = audio.current;
    if (!element || status !== 'ready') return;
    if (element.paused) void element.play().catch(() => setStatus('error'));
    else element.pause();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).tagName === 'SELECT') return;
    if (event.key === ' ' && (event.target as HTMLElement).tagName !== 'BUTTON') {
      event.preventDefault();
      toggle();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      seek(current + (event.key === 'ArrowRight' ? SKIP_SECONDS : -SKIP_SECONDS));
    }
  };

  const element = (
    <audio
      key={attempt}
      ref={attach}
      src={src}
      preload="metadata"
      onLoadedMetadata={(event) => {
        setDuration(event.currentTarget.duration);
        setStatus('ready');
      }}
      onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onEnded={() => setPlaying(false)}
      onError={() => setStatus('error')}
    />
  );

  if (status === 'error') {
    return (
      <div className={styles.problem} data-tone="danger" role="alert">
        {element}
        <span className={styles.problemIcon} aria-hidden><CircleX /></span>
        <span className={styles.problemText}>{t('audio.failed')}</span>
        <button
          type="button"
          className={styles.retry}
          onClick={() => {
            setStatus('loading');
            setAttempt((value) => value + 1);
          }}
        >
          <RefreshCw aria-hidden />
          {t('audio.retry')}
        </button>
      </div>
    );
  }

  const percent = duration ? Math.min(100, (current / duration) * 100) : 0;
  const timeText = `${formatAudioTime(current)} / ${formatAudioTime(duration)}`;
  const loading = status === 'loading';
  const track = (
    <div className={styles.track}>
      <span className={styles.rail} aria-hidden />
      <span className={styles.fill} style={{ width: `${percent}%` }} aria-hidden />
      <span className={styles.thumb} style={{ left: `${percent}%` }} aria-hidden />
      <input
        className={styles.range}
        type="range"
        min={0}
        max={Math.max(1, Math.floor(duration))}
        step={1}
        value={Math.floor(current)}
        disabled={loading}
        aria-label={t('audio.position')}
        aria-valuetext={timeText}
        onChange={(event) => seek(Number(event.target.value))}
      />
    </div>
  );
  const playLabel = playing ? t('audio.pause') : t('audio.play');
  const PlayIcon = loading ? LoaderCircle : playing ? Pause : Play;

  if (compact) {
    return (
      <div className={styles.compact} role="group" aria-label={title} onKeyDown={onKeyDown}>
        {element}
        <button type="button" className={styles.compactPlay} aria-label={`${playLabel}: ${title}`} disabled={loading} onClick={toggle}>
          <PlayIcon className={loading ? styles.spin : undefined} aria-hidden />
        </button>
        {track}
        <span className={styles.compactTime}>{timeText}</span>
      </div>
    );
  }

  return (
    <div className={styles.player} role="group" aria-label={title} onKeyDown={onKeyDown}>
      {element}
      <div className={styles.head}>
        <span className={styles.headIcon} aria-hidden><Headphones /></span>
        <span className={styles.headText}>
          <span className={styles.title}>{title}</span>
          {subtitle ? <span className={styles.subtitle}>{subtitle}</span> : null}
        </span>
        <span className={styles.speed}>
          <label htmlFor={speedId}>{t('audio.speed')}:</label>
          <select id={speedId} value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
            {SPEEDS.map((value) => <option key={value} value={value}>{`${value}×`}</option>)}
          </select>
          <ChevronDown aria-hidden />
        </span>
      </div>
      {track}
      <div className={styles.controls}>
        <div className={styles.buttons}>
          <button type="button" className={styles.skip} aria-label={t('audio.back')} title={t('audio.back')} disabled={loading} onClick={() => seek(current - SKIP_SECONDS)}>
            <RotateCcw aria-hidden />
          </button>
          <button type="button" className={styles.play} aria-label={playLabel} title={`${playLabel} (Space)`} disabled={loading} onClick={toggle}>
            <PlayIcon className={loading ? styles.spin : undefined} aria-hidden />
          </button>
          <button type="button" className={styles.skip} aria-label={t('audio.forward')} title={t('audio.forward')} disabled={loading} onClick={() => seek(current + SKIP_SECONDS)}>
            <RotateCw aria-hidden />
          </button>
        </div>
        <span className={styles.timer} role="timer" aria-label={timeText}>
          <span className={styles.timerNow}>{formatAudioTime(current)}</span>
          <span className={styles.timerTotal}>/ {formatAudioTime(duration)}</span>
        </span>
      </div>
      {loading ? <span className={styles.status} role="status">{t('audio.loading')}</span> : null}
      <ul className={styles.notes}>
        <li><ShieldCheck aria-hidden /><span>{t('audio.audit')}</span></li>
        {keptUntil ? <li><Archive aria-hidden /><span>{keptUntil}</span></li> : null}
      </ul>
    </div>
  );
}
