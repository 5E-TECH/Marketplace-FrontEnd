const escapeHtml = (value: string) => value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char] ?? char);

/**
 * Oddiy matnni chop etish (masalan, 2FA zaxira kodlari): yashirin iframe faqat shu matn bilan — sahifaning qolgani
 * (menyu, formalar) qog'ozga chiqmaydi. Chop etish oynasi yopilgach iframe olib tashlanadi.
 */
export function printPlainText(title: string, text: string): void {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('data-print-frame', '');
  frame.tabIndex = -1;
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  frame.srcdoc = `<!doctype html><html lang="uz"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>`
    + '<style>body{margin:24px;color:#000;font:15px/1.7 ui-monospace,Menlo,Consolas,monospace}pre{margin:0;white-space:pre-wrap}</style>'
    + `</head><body><pre>${escapeHtml(text)}</pre></body></html>`;
  frame.addEventListener('load', () => {
    const view = frame.contentWindow;
    if (!view) return;
    const remove = () => frame.remove();
    view.addEventListener('afterprint', remove, { once: true });
    view.focus();
    view.print();
    // `afterprint` bermaydigan brauzerlar uchun.
    window.setTimeout(remove, 60_000);
  }, { once: true });
  document.body.appendChild(frame);
}
