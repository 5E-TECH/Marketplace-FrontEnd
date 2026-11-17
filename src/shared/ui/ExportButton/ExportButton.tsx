import { App, Button } from 'antd';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { getApiErrorMessage } from '../../api/apiError';
import { useTranslation } from '../../i18n/useTranslation';

export interface ExportResult {
  fileName: string;
  /** Sarlavhasiz ma'lumot qatorlari — toastda «60 ta qator». */
  rows: number;
}

interface ExportButtonProps {
  /** Faylni yasaydi va saqlaydi (`saveCsv` / `downloadFile`). */
  onExport: () => ExportResult | Promise<ExportResult>;
  label?: string;
  disabled?: boolean;
}

/**
 * Kichik fayl eksporti (umumiy-eksport §1): bitta format — tugma, tayyor bo'lgach toast
 * «Fayl yuklab olindi: statistika_08.01-14.01.2027.csv · 8 ta qator». Admin uchun fonda
 * tayyorlanadigan katta eksport (§2–5) — o'z kartalarida.
 */
export function ExportButton({ onExport, label, disabled }: ExportButtonProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const { fileName, rows } = await onExport();
      void message.success(t('export.done', { name: fileName, rows }));
    } catch (error) {
      void message.error(error instanceof Error && !('isAxiosError' in error) ? t('export.failed') : getApiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button icon={<Download size={18} aria-hidden />} loading={busy} disabled={disabled} onClick={() => void run()}>
      {label ?? t('export.csv')}
    </Button>
  );
}
