import { useState } from 'react';
import { readShopImage } from '../lib/readShopImage';

export type ShopMediaKind = 'logo' | 'banner';

export interface ShopMediaFiles {
  logo: File | null;
  banner: File | null;
}

interface ShopMediaPreview {
  logoUrl?: string;
  bannerUrl?: string;
}

const emptyFiles: ShopMediaFiles = { logo: null, banner: null };

export function useShopMediaDraft() {
  const [files, setFiles] = useState<ShopMediaFiles>(emptyFiles);
  const [preview, setPreview] = useState<ShopMediaPreview>({});
  const select = async (kind: ShopMediaKind, file: File) => {
    const url = await readShopImage(file, 5);
    setFiles((current) => ({ ...current, [kind]: file }));
    setPreview((current) => ({
      ...current,
      [kind === 'logo' ? 'logoUrl' : 'bannerUrl']: url,
    }));
  };

  const reset = () => {
    setFiles(emptyFiles);
    setPreview({});
  };

  return { files, preview, select, reset };
}
