import { exportLeads } from '../../../features/adminLeads/api/adminLeadsApi';
import { LEAD_EXPORT_COLUMNS } from '../../../features/adminLeads/model/adminLeadTypes';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { CsvExportDialog } from '../../../shared/ui/CsvExportDialog/CsvExportDialog';

interface CsvDialogProps {
  /** Joriy filtrlar matni: «Simsiz quloqchinlar · 08.01–14.01.2027 · hamma holat». */
  summary: string;
  count: number;
  /** So'rov parametrlari (ro'yxat bilan bir xil) — eksport shu filtrlar bo'yicha. */
  filters: Record<string, string>;
  fileName: string;
  onClose: () => void;
}

const DEFAULT_COLUMNS = LEAD_EXPORT_COLUMNS.filter((column) => column !== 'subs');

/** «Lidlarni CSV faylga yuklab olish» (admin-lidlar, faqat admin; taklif `POST /admin/leads/export`). */
export function CsvDialog({ summary, count, filters, fileName, onClose }: CsvDialogProps) {
  const { t } = useTranslation();
  return (
    <CsvExportDialog
      title={t('al.csv.title')}
      summary={summary}
      countLabel={t('al.csv.count', { count })}
      columns={LEAD_EXPORT_COLUMNS.map((key) => ({ key, label: t(`al.csv.col.${key}`) }))}
      defaultColumns={DEFAULT_COLUMNS}
      phoneColumn="phone"
      phoneExample="****4567"
      fileName={fileName}
      onExport={({ columns, phone }) => exportLeads({ filters, columns, phone })}
      onClose={onClose}
      testId="csv-dialog"
    />
  );
}
