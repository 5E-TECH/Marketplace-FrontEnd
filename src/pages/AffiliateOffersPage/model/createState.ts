/** «Sahifa yaratish» holati bitta offer uchun: so'rov ketdi, tarmoq xatosi yoki shu payt qoldiq tugadi (409). */
export type CreateState = { kind: 'creating' } | { kind: 'failed' } | { kind: 'noStock' };
