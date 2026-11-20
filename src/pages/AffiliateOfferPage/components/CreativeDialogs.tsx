import { App } from 'antd';
import { ChevronLeft, ChevronRight, Download, FileArchive, ImageIcon, Images, Maximize, Pause, Play, Video, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { downloadOfferCreatives, type AffiliateOfferDetail } from '../../../features/affiliate/api/offersApi';
import type { OfferCreative } from '../../../features/affiliate/model/offerTypes';
import { SafeImage } from '../../../shared/ui/SafeImage/SafeImage';
import { fileFormat, useCreativeName } from '../model/offerView';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { tashkentDay } from '../../../shared/lib/tashkentTime';
import { DialogCancel, DialogPrimary, Dialog } from '../../../shared/ui/Dialog/Dialog';
import styles from '../AffiliateOfferPage.module.css';

/** Bitta kreativni yuklab olish: brauzer faylni saqlaydi (boshqa domen bo'lsa — yangi tabda ochiladi). */
export function DownloadLink({ creative, label, variant = 'icon' }: { creative: OfferCreative; label: string; variant?: 'icon' | 'primary' }) {
  const { t } = useTranslation();
  if (variant === 'primary') {
    return (
      <a className={styles.primaryLink} href={creative.url} download target="_blank" rel="noopener noreferrer">
        <Download aria-hidden />
        {t('offer.download')}
      </a>
    );
  }
  const name = t('offer.downloadOne', { name: label });
  return (
    <a className={styles.iconButton} href={creative.url} download target="_blank" rel="noopener noreferrer" aria-label={name} title={name} data-disabled={creative.processing || undefined}>
      <Download aria-hidden />
    </a>
  );
}

const clock = (seconds: number) =>
  Number.isFinite(seconds) ? `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '--:--';

/** Video pleyer (sotuvchi-offer «Video · asosiy»): ijro, vaqt, surish, ovoz, to'liq ekran. */
function VideoPlayer({ src, label }: { src: string; label: string }) {
  const { t } = useTranslation();
  const video = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(Number.NaN);
  const [failed, setFailed] = useState(false);
  const attach = useCallback((node: HTMLVideoElement | null) => {
    video.current = node;
    if (node && node.readyState >= HTMLMediaElement.HAVE_METADATA) setDuration(node.duration);
  }, []);
  const toggle = () => {
    const node = video.current;
    if (!node) return;
    if (node.paused) void node.play().catch(() => setFailed(true));
    else node.pause();
  };

  return (
    <div className={styles.player}>
      <div className={styles.screen}>
        <video
          ref={attach}
          src={src}
          preload="metadata"
          playsInline
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
          onError={() => setFailed(true)}
          aria-label={label}
        />
        {!playing ? (
          <button type="button" className={styles.bigPlay} onClick={toggle} aria-label={t('offer.play')}>
            <Play aria-hidden />
          </button>
        ) : null}
        {failed ? <span className={styles.screenNote}>{t('offer.videoFailed')}</span> : null}
      </div>
      <div className={styles.controls}>
        <button type="button" className={styles.controlButton} onClick={toggle} aria-label={playing ? t('offer.pause') : t('offer.play')}>
          {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
        </button>
        <span className={styles.time}>{clock(time)} / {clock(duration)}</span>
        <input
          type="range"
          className={styles.seek}
          min={0}
          max={Number.isFinite(duration) ? duration : 0}
          step={0.1}
          value={time}
          aria-label={t('offer.seek')}
          onChange={(event) => {
            if (video.current) video.current.currentTime = Number(event.target.value);
          }}
        />
        <button
          type="button"
          className={styles.controlButton}
          aria-label={muted ? t('offer.unmute') : t('offer.mute')}
          onClick={() => {
            if (!video.current) return;
            video.current.muted = !muted;
            setMuted(!muted);
          }}
        >
          {muted ? <VolumeX aria-hidden /> : <Volume2 aria-hidden />}
        </button>
        <button type="button" className={styles.controlButton} aria-label={t('offer.fullscreen')} onClick={() => void video.current?.requestFullscreen?.()}>
          <Maximize aria-hidden />
        </button>
      </div>
    </div>
  );
}

interface CreativeDialogProps {
  offer: AffiliateOfferDetail;
  onClose: () => void;
}

export function VideoDialog({ offer, creative, onClose }: CreativeDialogProps & { creative: OfferCreative }) {
  const { t } = useTranslation();
  const name = useCreativeName(offer.creatives)(creative);
  const title = creative.caption ? `${name} · ${creative.caption}` : name;
  return (
    <Dialog
      open
      onClose={onClose}
      width={720}
      title={title}
      description={t('offer.approvedOn', { product: offer.name, date: tashkentDay(creative.approvedAt) })}
      icon={<Video />}
      testId="video-dialog"
      footer={
        <>
          <DialogCancel onClick={onClose}>{t('dialog.close')}</DialogCancel>
          <DownloadLink creative={creative} label={title} variant="primary" />
        </>
      }
    >
      <VideoPlayer src={creative.url} label={title} />
      <p className={styles.dialogNote}>{t('offer.videoNote', { format: fileFormat(creative.url) })}</p>
    </Dialog>
  );
}

/** Rasmlar (sotuvchi-offer oynasi): katta rasm, ‹ › va klaviatura strelkalari, kichik rasmlar qatori. */
export function ImagesDialog({ offer, startId, onClose }: CreativeDialogProps & { startId: string }) {
  const { t } = useTranslation();
  const images = offer.creatives.filter((creative) => creative.type === 'IMAGE');
  const [index, setIndex] = useState(() => Math.max(0, images.findIndex((image) => image.id === startId)));
  const image = images[index];
  const step = (delta: number) => setIndex((current) => (current + delta + images.length) % images.length);
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowRight') step(1);
    if (event.key === 'ArrowLeft') step(-1);
  };
  if (!image) return null;
  const name = t('offer.imageN', { index: index + 1, total: images.length });

  return (
    <Dialog
      open
      onClose={onClose}
      width={720}
      title={t('offer.images')}
      description={t('offer.imagesHint', { product: offer.name, count: images.length })}
      icon={<Images />}
      testId="images-dialog"
      footer={
        <>
          <DialogCancel onClick={onClose}>{t('dialog.close')}</DialogCancel>
          <DownloadLink creative={image} label={name} variant="primary" />
        </>
      }
    >
      <div className={styles.viewer} onKeyDown={onKeyDown} tabIndex={-1}>
        <SafeImage key={image.id} src={image.url} alt={image.caption ? `${name} — ${image.caption}` : name} />
        <ImageIcon className={styles.viewerFallback} aria-hidden />
        <span className={styles.viewerCount}>{index + 1} / {images.length}</span>
        {images.length > 1 ? (
          <>
            <button type="button" className={styles.navButton} data-side="prev" onClick={() => step(-1)} aria-label={t('offer.prevImage')}>
              <ChevronLeft aria-hidden />
            </button>
            <button type="button" className={styles.navButton} data-side="next" onClick={() => step(1)} aria-label={t('offer.nextImage')}>
              <ChevronRight aria-hidden />
            </button>
          </>
        ) : null}
      </div>
      <div className={styles.thumbs}>
        <div className={styles.thumbRow}>
          {images.map((item, itemIndex) => (
            <button
              key={item.id}
              type="button"
              className={styles.thumbButton}
              aria-current={itemIndex === index || undefined}
              aria-label={t('offer.imageN', { index: itemIndex + 1, total: images.length })}
              onClick={() => setIndex(itemIndex)}
            >
              <ImageIcon aria-hidden />
              <SafeImage src={item.url} alt="" />
            </button>
          ))}
        </div>
        <span className={styles.thumbCaption}>
          <span>{image.caption ? `${name} · ${image.caption}` : name}</span>
          <span>{t('offer.approvedDate', { date: tashkentDay(image.approvedAt), format: fileFormat(image.url) })}</span>
        </span>
      </div>
    </Dialog>
  );
}

/** «Hammasini yuklab olish» (480): tarkib va bitta ZIP (taklif — server arxivi). */
export function DownloadAllDialog({ offer, onClose }: CreativeDialogProps) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const [busy, setBusy] = useState(false);
  const name = useCreativeName(offer.creatives);
  const ready = offer.creatives.filter((creative) => !creative.processing);
  const fileName = `offer-${offer.productId}-kreativlar.zip`;
  const counts = t('offers.creatives', {
    videos: ready.filter((creative) => creative.type === 'VIDEO').length,
    images: ready.filter((creative) => creative.type === 'IMAGE').length,
  });
  useEffect(() => () => setBusy(false), []);

  const download = () => {
    setBusy(true);
    downloadOfferCreatives(offer.productId, fileName).then(
      (file) => {
        notification.success({ title: t('offer.zipDone'), description: t('offer.zipDoneText', { file: file.fileName, count: ready.length }), placement: 'bottomRight', duration: 4 });
        onClose();
      },
      () => {
        setBusy(false);
        notification.error({ title: t('offer.zipFailed'), description: t('offer.zipFailedText'), placement: 'bottomRight' });
      },
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      locked={busy}
      title={t('offer.downloadAll')}
      description={t('offer.downloadAllText', { product: offer.name, counts })}
      icon={<FileArchive />}
      testId="download-all"
      footer={
        <>
          <DialogCancel onClick={onClose} disabled={busy}>{t('offer.cancel')}</DialogCancel>
          <DialogPrimary shortcut={false} onClick={download} saving={busy} savingLabel={t('offer.zipPreparing')} icon={<Download />}>
            {t('offer.zipDownload')}
          </DialogPrimary>
        </>
      }
    >
      <ul className={styles.fileList}>
        {ready.map((creative) => (
          <li key={creative.id}>
            <span className={styles.fileIcon} aria-hidden>{creative.type === 'VIDEO' ? <Video /> : <ImageIcon />}</span>
            <span className={styles.fileText}>
              <span>{creative.caption ? `${name(creative)} — ${creative.caption}` : name(creative)}</span>
              <span>{fileFormat(creative.url)}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className={styles.fileTotal}>{t('offer.filesTotal', { count: ready.length })}</p>
      <p className={styles.dialogNote}>{t('offer.zipNote', { file: fileName })}</p>
    </Dialog>
  );
}
