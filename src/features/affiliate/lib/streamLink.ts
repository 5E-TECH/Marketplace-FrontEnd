/** Sahifa havolasi protokolsiz: «elchi.uz/w4n8re» — domen va kod alohida. */
export function splitStreamLink(link: string): { domain: string; code: string } {
  const text = link.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const cut = text.lastIndexOf('/');
  return cut < 0 ? { domain: '', code: text } : { domain: text.slice(0, cut), code: text.slice(cut + 1) };
}
