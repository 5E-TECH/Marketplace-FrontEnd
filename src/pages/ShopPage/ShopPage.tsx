import { App, Form } from 'antd';
import { useState } from 'react';
import { useAppSelector } from '../../app/store/hooks';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import {
  useSellerShopQuery,
  useUpdateSellerShopMutation,
} from '../../features/shop/api/sellerShopQueries';
import type { UpdateSellerShopPayload } from '../../features/shop/api/sellerShopApi';
import {
  toShopProfile,
  type ShopProfileFormValues,
} from '../../features/shop/model/shopProfile';
import { ShopProfileForm } from '../../features/shop/ui/ShopProfileForm';
import { ShopProfileHero } from '../../features/shop/ui/ShopProfileHero';
import { useShopMediaDraft } from '../../features/shop/model/useShopMediaDraft';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import styles from './ShopPage.module.css';
import { selectAuthUser } from '../../features/auth/model/authSlice';

export default function ShopPage() {
  const { message } = App.useApp();
  const user = useAppSelector(selectAuthUser);
  const sellerAccess = user?.role === 'SELLER';
  const [form] = Form.useForm<ShopProfileFormValues>();
  const [editing, setEditing] = useState(false);
  const mediaDraft = useShopMediaDraft();
  const shopQuery = useSellerShopQuery(sellerAccess);
  const updateShopMutation = useUpdateSellerShopMutation();

  if (!sellerAccess && user) {
    const previewProfile: ShopProfileFormValues = {
      name: user.name,
      slug: '',
      description: 'Do‘kon tavsifi SELLER profilida ko‘rsatiladi',
      phone: user.phone,
      regionId: '1',
      districtId: '10',
      address: 'Manzil SELLER profilida ko‘rsatiladi',
    };

    return (
      <div className={styles.page}>
        <PageHeader
          title="Do‘kon profili"
          description="Xaridorlarga ko‘rinadigan do‘kon ma’lumotlarini boshqaring"
        />
        <ShopProfileHero
          profile={{ ...previewProfile, logoUrl: null, bannerUrl: null }}
          editing={false}
          status="ACTIVE"
          onImageSelect={() => undefined}
        />
        <ShopProfileForm
          form={form}
          initialValues={previewProfile}
          editing={false}
          onEdit={() =>
            void message.warning(
              'Do‘kon profilini faqat SELLER akkaunti tahrirlay oladi',
            )
          }
          onCancel={() => undefined}
          onSubmit={() => undefined}
        />
      </div>
    );
  }

  if (shopQuery.isPending) return <ContentState state="loading" />;

  if (shopQuery.isError) {
    return (
      <ContentState
        state="error"
        title="Do‘kon profilini yuklab bo‘lmadi"
        description={getAuthErrorMessage(shopQuery.error)}
        onAction={() => void shopQuery.refetch()}
      />
    );
  }

  const profile = toShopProfile(shopQuery.data);

  const startEditing = () => {
    form.setFieldsValue(profile);
    setEditing(true);
  };

  const cancelEditing = () => {
    form.setFieldsValue(profile);
    mediaDraft.reset();
    setEditing(false);
  };

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
