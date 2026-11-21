import type { AdminProduct, Creative } from '../../../features/adminProducts/model/adminProductTypes';
import { CreativeUploadDialog, DeleteCreativeDialog } from '../../../features/adminProducts/ui/CreativeDialogs';

/** «Kreativ yuklash» va «Kreativni o'chirish» oynalari — Offer va Kreativlar yorliqlari uchun bitta joyda. */
export function CreativeDeleteDialogs({ product, creatives, upload, deleting, onClose }: {
  product: AdminProduct;
  creatives: readonly Creative[];
  upload: boolean;
  deleting: Creative | null;
  onClose: () => void;
}) {
  return (
    <>
      {upload ? <CreativeUploadDialog product={product} creatives={creatives} onClose={onClose} /> : null}
      {deleting ? <DeleteCreativeDialog product={product} creative={deleting} creatives={creatives} onClose={onClose} /> : null}
    </>
  );
}
