import axios from 'axios';
import { CircleCheck, PackageCheck, Plus, Star, Store } from 'lucide-react';
import { App, Button, Form } from 'antd';
import { useState } from 'react';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import {
  useCreateSellerShopMutation,
  useSellerShopQuery,
  useUpdateSellerShopMutation,
} from '../../features/shop/api/sellerShopQueries';
import type {
  CreateSellerShopPayload,
  UpdateSellerShopPayload,
} from '../../features/shop/api/sellerShopApi';
import {
  toShopProfile,
  type ShopProfileFormValues,
} from '../../features/shop/model/shopProfile';
import { ShopProfileForm } from '../../features/shop/ui/ShopProfileForm';
import { ShopProfileHero } from '../../features/shop/ui/ShopProfileHero';
import { CreateShopModal } from '../../features/shop/ui/CreateShopModal';
import { useShopMediaDraft } from '../../features/shop/model/useShopMediaDraft';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import styles from './ShopPage.module.css';

export default function ShopPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm<ShopProfileFormValues>();
  const [editing, setEditing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const mediaDraft = useShopMediaDraft();
  const shopQuery = useSellerShopQuery();
  const updateShopMutation = useUpdateSellerShopMutation();
  const createShopMutation = useCreateSellerShopMutation();
  const shopMissing =
    shopQuery.isError &&
    axios.isAxiosError(shopQuery.error) &&
    shopQuery.error.response?.status === 404;

  if (shopQuery.isPending) return <ContentState state="loading" />;

  if (shopQuery.isError && !shopMissing) {
    return (
      <ContentState
        state="error"
        title="Do‘kon profilini yuklab bo‘lmadi"
        description={getAuthErrorMessage(shopQuery.error)}
        onAction={() => void shopQuery.refetch()}
      />
    );
  }

  const profile = shopQuery.data ? toShopProfile(shopQuery.data) : null;

  const startEditing = () => {
    if (!profile) return;
    form.setFieldsValue(profile);
    setEditing(true);
  };

  const cancelEditing = () => {
    if (profile) form.setFieldsValue(profile);
    mediaDraft.reset();
    setEditing(false);
  };

  const createProfile = (values: ShopProfileFormValues) => {
    const payload: CreateSellerShopPayload = {
      name: values.name.trim(),
      description: values.description.trim(),
      phone: values.phone.replace(/\s/g, ''),
      regionId: values.regionId,
      districtId: values.districtId,
      address: values.address.trim(),
      ...(mediaDraft.preview.logoUrl ? { logoUrl: mediaDraft.preview.logoUrl } : {}),
      ...(mediaDraft.preview.bannerUrl ? { bannerUrl: mediaDraft.preview.bannerUrl } : {}),
    };

    createShopMutation.mutate(payload, {
      onSuccess: () => {
        setCreateOpen(false);
        mediaDraft.reset();
        void message.success('Do‘kon muvaffaqiyatli yaratildi');
      },
      onError: (error) => void message.error(getAuthErrorMessage(error)),
    });
  };

  if (shopMissing) {
    return (
      <div className={styles.page}>
        <PageHeader
          title="Do‘kon profili"
          description="Marketplace’da savdoni boshlash uchun do‘koningizni yarating"
          extra={<Button type="primary" icon={<Plus />} onClick={() => setCreateOpen(true)}>Do‘kon yaratish</Button>}
        />
        <section className={styles.emptyShop}>
          <div className={styles.emptyArtwork}>
            <span className={styles.emptyGlow} />
            <Store />
          </div>
          <span className={styles.eyebrow}>SELLER SPACE</span>
          <h2>Sizning do‘koningiz shu yerdan boshlanadi</h2>
          <p>Logo va banner yuklang, aloqa ma’lumotlarini kiriting va mahsulotlaringizni xaridorlarga namoyish eting.</p>
          <div className={styles.steps}>
            <span><CircleCheck /> Profil ma’lumotlari</span>
            <span><CircleCheck /> Logo va banner</span>
            <span><CircleCheck /> Tekshiruvga yuborish</span>
          </div>
          <Button size="large" type="primary" icon={<Plus />} onClick={() => setCreateOpen(true)}>
            Birinchi do‘konni yaratish
          </Button>
        </section>
        <CreateShopModal
          open={createOpen}
          saving={createShopMutation.isPending}
          preview={mediaDraft.preview}
          onImageSelect={mediaDraft.select}
          onCancel={() => {
            setCreateOpen(false);
            mediaDraft.reset();
          }}
          onSubmit={createProfile}
        />
      </div>
    );
  }

  if (!profile || !shopQuery.data) return <ContentState state="loading" />;

  const saveProfile = (values: ShopProfileFormValues) => {
    // Upload API ulanganda mediaDraft.files shu yagona save oqimida yuboriladi.
    const payload: UpdateSellerShopPayload = {
      name: values.name.trim(),
      description: values.description.trim(),
      phone: values.phone.replace(/\s/g, ''),
      regionId: values.regionId,
      districtId: values.districtId,
      address: values.address.trim(),
      ...(mediaDraft.preview.logoUrl ? { logoUrl: mediaDraft.preview.logoUrl } : {}),
      ...(mediaDraft.preview.bannerUrl ? { bannerUrl: mediaDraft.preview.bannerUrl } : {}),
    };

    updateShopMutation.mutate(payload, {
      onSuccess: () => {
        setEditing(false);
        void message.success('Do‘kon ma’lumotlari saqlandi');
      },
      onError: (error) => void message.error(getAuthErrorMessage(error)),
    });
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title="Do‘kon profili"
        description="Xaridorlarga ko‘rinadigan do‘kon ma’lumotlarini boshqaring"
      />
      <div className={styles.profileLayout}>
        <ShopProfileHero
          profile={{ ...profile, ...mediaDraft.preview }}
          editing={editing}
          status={shopQuery.data.status}
          onImageSelect={mediaDraft.select}
        />
        <section className={styles.shopStats} aria-label="Do‘kon statistikasi">
          <div><span><Star /></span><small>Reyting</small><strong>{shopQuery.data.rating.toFixed(1)}</strong></div>
          <div><span><PackageCheck /></span><small>Buyurtmalar</small><strong>{shopQuery.data.ordersCount}</strong></div>
          <div><span><CircleCheck /></span><small>Holati</small><strong>{shopQuery.data.status === 'ACTIVE' ? 'Faol' : 'Tekshiruvda'}</strong></div>
        </section>
        <ShopProfileForm
          form={form}
          initialValues={profile}
          editing={editing}
          saving={updateShopMutation.isPending}
          onEdit={startEditing}
          onCancel={cancelEditing}
          onSubmit={saveProfile}
        />
      </div>
    </div>
  );
}
