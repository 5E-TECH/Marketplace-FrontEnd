import { Fragment, type ReactNode } from 'react';

/**
 * Tarjima matnidagi `{name}` o'rniga React tugun (qalin son, belgi): «Jami og‘irlik {kg} — 3 kg gacha tarif.»
 * `t(key)` parametrsiz chaqiriladi — o'rinlar matnda qoladi; berilmagan nom matn bo'lib qoladi.
 */
export function rich(template: string, values: Record<string, ReactNode>): ReactNode[] {
  return template.split(/(\{\w+\})/).map((part, index) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    return name !== undefined && name in values ? <Fragment key={index}>{values[name]}</Fragment> : part;
  });
}
