import { Button, Card, Space, Form, Select } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { AddressFields } from '../../features/address/ui/AddressFields';
import { addressFromLead, EMPTY_ADDRESS } from '../../features/address/lib/addressValue';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { uzPhoneRules } from '../../shared/lib/phoneRules';
import { AudioPlayer } from '../../shared/ui/AudioPlayer/AudioPlayer';
import { BarChart } from '../../shared/ui/Chart/BarChart';
import { ChartEmpty, ChartLoading } from '../../shared/ui/Chart/ChartState';
import { ChartViewToggle, type ChartView } from '../../shared/ui/Chart/ChartViewToggle';
import { LineChart } from '../../shared/ui/Chart/LineChart';
import { CopyButton } from '../../shared/ui/CopyButton/CopyButton';
import { DateInput } from '../../shared/ui/DateInput/DateInput';
import { MoneyInput } from '../../shared/ui/MoneyInput/MoneyInput';
import { PhoneInput } from '../../shared/ui/PhoneInput/PhoneInput';
import { StatusBadge } from '../../shared/ui/StatusBadge/StatusBadge';
import { STATUS_FAMILIES, type StatusFamily } from '../../shared/ui/StatusBadge/statusConfig';
import { TimeSelect } from '../../shared/ui/TimeSelect/TimeSelect';
import { FormModal } from '../../shared/ui/FormModal/FormModal';
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog/ConfirmDialog';
import { DataTable } from '../../shared/ui/DataTable/DataTable';
import { ImageUpload } from '../../shared/ui/ImageUpload/ImageUpload';
import { MoneyText } from '../../shared/ui/MoneyText/MoneyText';

interface TestRecord {
  id: number;
  name: string;
  amount: number;
}

const records: TestRecord[] = Array.from({ length: 25 }, (_, index) => ({
  id: index + 1,
  name: `Item ${String(index + 1).padStart(2, '0')}`,
  amount: (index + 1) * 1_000,
}));

const columns: ColumnsType<TestRecord> = [
  {
    title: 'Nomi',
    dataIndex: 'name',
    sorter: (left, right) => left.name.localeCompare(right.name),
  },
  {
    title: 'Summa',
    dataIndex: 'amount',
    sorter: (left, right) => left.amount - right.amount,
    render: (value: number) => <MoneyText value={value} />,
  },
];

/** Dizayndagi namuna (umumiy-komponentlar «5. Grafik»): Jasur T., 08.01–14.01.2027. */
const DAYS = [
  ['08.01', 'Ju', 10, 5, 0, 120], ['09.01', 'Sh', 10, 4, 1, 112], ['10.01', 'Ya', 9, 4, 2, 105], ['11.01', 'Du', 9, 4, 4, 105],
  ['12.01', 'Se', 9, 4, 3, 105], ['13.01', 'Ch', 8, 3, 2, 95], ['14.01', 'bugun', 5, 1, 2, 58],
] as const;
const LEAD_ADDRESS = { regionSoato: '1730', districtSoato: '1730412', addressLine: 'Navoiy ko‘chasi, 12-uy' };

/** 30 soniyalik jim WAV (8 kHz, 8 bit) — pleyerni tarmoqsiz sinash uchun. */
function silentWav(seconds: number): Blob {
  const samples = seconds * 8000;
  const view = new DataView(new ArrayBuffer(44 + samples));
  const text = (offset: number, value: string) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples, true);
  text(8, 'WAVEfmt ');
  [[16, 16, 4], [20, 1, 2], [22, 1, 2], [24, 8000, 4], [28, 8000, 4], [32, 1, 2], [34, 8, 2]].forEach(([offset, value, size]) =>
    size === 4 ? view.setUint32(offset, value, true) : view.setUint16(offset, value, true));
  text(36, 'data');
  view.setUint32(40, samples, true);
  for (let index = 0; index < samples; index += 1) view.setUint8(44 + index, 128);
  return new Blob([view], { type: 'audio/wav' });
}

/** Sahifa davomida bitta manzil — StrictMode qayta o'rnatganda ham yozuv yo'qolmaydi. */
let silentUrl: string | undefined;
const silentAudio = () => (silentUrl ??= URL.createObjectURL(silentWav(30)));

/** FE-03 vidjetlari (komponentlar-E §19–23, §33): har biri o'z holatlari bilan. */
function WidgetSections() {
  const { t } = useTranslation();
  const [phoneForm] = Form.useForm<{ phone: string }>();
  const [money, setMoney] = useState<number | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>('10:00');
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [leadAddress, setLeadAddress] = useState(() => addressFromLead(LEAD_ADDRESS));
  const [view, setView] = useState<ChartView>('chart');
  const [audio] = useState(silentAudio);

  const points = DAYS.map(([label, sub, leads, confirmed, delivered]) => ({ key: label, label, sub, values: { leads, confirmed, delivered } }));

  return (
    <>
      <Card title="1. Telefon maydoni">
        <Form form={phoneForm} layout="vertical" requiredMark={false} onFinish={() => undefined} style={{ maxWidth: 360 }}>
          <Form.Item name="phone" label={t('auth.phone')} rules={uzPhoneRules(t)} validateTrigger={['onBlur', 'onSubmit']}>
            <PhoneInput />
          </Form.Item>
          <Button htmlType="submit">Tekshirish</Button>
        </Form>
      </Card>

      <Card title="2. Viloyat → tuman kaskadi">
        <Space orientation="vertical" size={24} style={{ width: '100%' }}>
          <section aria-label="Yangi manzil" data-testid="address-new">
            <AddressFields value={address} onChange={setAddress} withStreet={false} />
          </section>
          <section aria-label="Lid manzili" data-testid="address-lead">
            <AddressFields value={leadAddress} onChange={setLeadAddress} original={addressFromLead(LEAD_ADDRESS)} />
          </section>
        </Space>
      </Card>

      <Card title="3. Pul, sana va vaqt maydonlari">
        <Space orientation="vertical" size={16} style={{ width: '100%', maxWidth: 360 }}>
          <label>
            Summa
            <MoneyInput value={money} onChange={setMoney} aria-label="Summa" />
          </label>
          <output aria-label="Summa qiymati">{money ?? '—'}</output>
          <MoneyInput size="large" value={250000} aria-label="Pul yechish summasi" />
          <DateInput value={date} onChange={setDate} aria-label="Sana" />
          <TimeSelect value={time} onChange={setTime} from="09:00" to="21:00" aria-label="Vaqt" />
        </Space>
      </Card>

      <Card title="4. Audio pleyer">
        <Space orientation="vertical" size={16} style={{ width: '100%', maxWidth: 560 }}>
          <AudioPlayer src={audio} title="L-1276 · Rustam" subtitle="Shohruh M. · bugun · 00:30" keptUntil="14.04.2027 gacha saqlanadi (90 kun)" />
          <AudioPlayer compact src={audio} title="Qo‘ng‘iroq yozuvi" />
          <AudioPlayer src={null} title="Muddati o‘tgan" unavailable="expired" />
          <AudioPlayer src={null} title="Yozuv yo‘q" unavailable="missing" />
        </Space>
      </Card>

      <Card title="5. Grafik" extra={<ChartViewToggle value={view} onChange={setView} />}>
        <Space orientation="vertical" size={24} style={{ width: '100%' }}>
          {view === 'chart' ? (
            <BarChart
              series={[
                { key: 'leads', label: 'Lidlar', hint: 'lid kelgan kun', tone: 'light', total: 60 },
                { key: 'confirmed', label: 'Tasdiqlangan', hint: 'operator tasdiqlagan kun', tone: 'mid', total: 25 },
                { key: 'delivered', label: 'Yetkazilgan', hint: 'mijoz olib, pulini to‘lagan kun', tone: 'dark', total: 14 },
              ]}
              points={points}
              ariaLabel={`Kunlar bo‘yicha: lidlar, tasdiqlangan, yetkazilgan. ${points.map((point) => `${point.label}: ${Object.values(point.values).join(', ')}`).join('; ')}`}
            />
          ) : (
            <p>Jadval ko‘rinishi — sahifalarda (bosh sahifa, statistika).</p>
          )}
          <LineChart
            ariaLabel={`Kliklar, kunlar bo‘yicha. ${DAYS.map((day) => `${day[0]}: ${day[5]}`).join('; ')}. 14.01 — soat 14:00 gacha.`}
            points={DAYS.map(([label, sub, , , , clicks], index) => ({ key: label, label, sub, value: clicks, partial: index === DAYS.length - 1 }))}
          />
          <ChartEmpty text="Birinchi lid kelgach grafik shu yerda chiqadi." />
          <ChartLoading />
        </Space>
      </Card>

      <Card title="6. Nusxa tugmasi">
        <Space size={12} wrap>
          <code>k7m2qa</code>
          <CopyButton text="k7m2qa" ariaLabel="Sahifa kodidan nusxa olish" size="sm" />
          <CopyButton text="https://elchi.uz/p/k7m2qa" label="Havoladan nusxa" />
        </Space>
      </Card>

      <Card title="7. Holat belgilari">
        <Space orientation="vertical" size={12}>
          {(Object.keys(STATUS_FAMILIES) as StatusFamily[]).map((family) => (
            <Space key={family} size={8} wrap data-testid={`status-${family}`}>
              {Object.keys(STATUS_FAMILIES[family]).map((code) => <StatusBadge key={code} family={family} code={code as never} />)}
            </Space>
          ))}
        </Space>
      </Card>
    </>
  );
}

export default function SharedUiTestPage() {
  const [form] = Form.useForm<{ status: string }>();
  const [formOpen, setFormOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmCount, setConfirmCount] = useState(0);

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <Space orientation="vertical" size={24} style={{ width: '100%' }}>
        <Card title="DataTable">
          <DataTable
            rowKey="id"
            columns={columns}
            dataSource={records}
            search={{
              placeholder: 'Test yozuvini qidirish',
              filter: (record, query) =>
                record.name.toLocaleLowerCase('uz').includes(query),
            }}
          />
        </Card>

        <Card title="ConfirmDialog">
          <Button onClick={() => setConfirmOpen(true)}>Tasdiqni ochish</Button>
          <output aria-label="Tasdiqlar soni">{confirmCount}</output>
          <ConfirmDialog
            open={confirmOpen}
            title="Amal tasdiqlansinmi?"
            confirmText="Ha"
            onCancel={() => setConfirmOpen(false)}
            onConfirm={() => {
              setConfirmCount((count) => count + 1);
              setConfirmOpen(false);
            }}
          />
        </Card>

        <Card title="FormModal">
          <Button onClick={() => setFormOpen(true)}>Formani ochish</Button>
          <FormModal form={form} open={formOpen} title="Test formasi" onCancel={() => setFormOpen(false)} onSubmit={() => setFormOpen(false)}>
            <Form.Item name="status" label="Holati"><Select options={[{ value: 'ACTIVE', label: 'Faol' }]} /></Form.Item>
          </FormModal>
        </Card>
        <Card title="ImageUpload">
          <ImageUpload />
        </Card>

        <Card title="MoneyText">
          <MoneyText value={1_234_567} />
        </Card>

        <WidgetSections />
      </Space>
    </main>
  );
}
