import { Modal, type ModalProps } from 'antd';
import { useMediaQuery } from '../../lib/useMediaQuery';
import styles from './SheetModal.module.css';

/**
 * Oyna: desktop va planshetda markazda, telefonda — pastdan chiqadigan varaq
 * (karkas-E 4.6, komponentlar-E §32: radius 20, mazmun ichida aylanadi).
 */
export function SheetModal({ rootClassName, centered = true, ...props }: ModalProps) {
  const phone = useMediaQuery('(max-width: 767.98px)');
  return (
    <Modal
      {...props}
      centered={phone ? false : centered}
      rootClassName={[styles.modal, phone ? styles.sheet : '', rootClassName ?? ''].filter(Boolean).join(' ')}
    />
  );
}
