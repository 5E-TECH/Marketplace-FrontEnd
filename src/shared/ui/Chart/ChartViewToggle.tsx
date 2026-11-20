import { ChartColumn, Table2 } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { ChartSegment } from './ChartSegment';

export type ChartView = 'chart' | 'table';

/** «Ko‘rinish: Grafik / Jadval» — grafik yonida (komponentlar-E §23); jadval — o'sha sonlar. */
export function ChartViewToggle({ value, onChange }: { value: ChartView; onChange: (view: ChartView) => void }) {
  const { t } = useTranslation();
  return (
    <ChartSegment
      label={t('chart.view')}
      value={value}
      onChange={onChange}
      options={[
        { value: 'chart', label: t('chart.chart'), icon: <ChartColumn aria-hidden /> },
        { value: 'table', label: t('chart.table'), icon: <Table2 aria-hidden /> },
      ]}
    />
  );
}
