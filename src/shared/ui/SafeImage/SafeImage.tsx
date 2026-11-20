import { useState, type ImgHTMLAttributes } from 'react';

/** Rasm yuklanmasa — o'zi yo'qoladi (ostidagi o'rinbosar ikonka ko'rinib qoladi, «singan rasm» belgisi chiqmaydi). */
export function SafeImage(props: ImgHTMLAttributes<HTMLImageElement>) {
  const [failed, setFailed] = useState(false);
  return failed ? null : <img {...props} onError={() => setFailed(true)} />;
}
