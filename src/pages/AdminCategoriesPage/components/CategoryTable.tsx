import { Dropdown } from 'antd';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, GripVertical, MoreHorizontal, Pencil, Plus, Settings, Trash2 } from 'lucide-react';
import { useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import type { PolicyLayer } from '../../../features/categories/api/categoryPolicyApi';
import type { Category } from '../../../features/categories/model/categoryTypes';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { tashkentDay } from '../../../shared/lib/tashkentTime';
import { deliverySource, modeLabel, plainMoney, productSummary, sourceLabel } from '../model/categoryLabels';
import type { CategoryRow, Resolved } from '../model/categoryRows';
import styles from '../AdminCategoriesPage.module.css';

const tone = (resolved: Resolved<unknown>) => (resolved.source === 'own' ? styles.own : styles.inherited);

/** «Qisman · 30 000 / 45 000» — o'zida yozilgan qism qalin, meros — kulrang. */
export function DeliveryValue({ row }: { row: Pick<CategoryRow, 'mode' | 'center' | 'door'> }) {
  const { t } = useTranslation();
  return (
    <>
      <span className={tone(row.mode)}>{modeLabel(t, row.mode.value)}</span>
      <span className={styles.inherited}>{' · '}</span>
      <span className={tone(row.center)}>{plainMoney(row.center.value)}</span>
      <span className={styles.inherited}>{' / '}</span>
      <span className={tone(row.door)}>{plainMoney(row.door.value)}</span>
    </>
  );
}

interface CategoryTableProps {
  rows: readonly CategoryRow[];
  global: PolicyLayer | undefined;
  selectedId: string | null;
  reorder: boolean;
  onSelect: (category: Category) => void;
  onToggle: (category: Category, expanded: boolean) => void;
  onEdit: (category: Category) => void;
  onAddChild: (category: Category) => void;
  onDelete: (category: Category) => void;
  /** Qo'shnilar ichida `to` o'rniga (o'zisiz ro'yxatda). */
  onMove: (category: Category, to: number) => void;
}

type Drop = { id: string; place: 'before' | 'after' };

/**
 * Kategoriyalar jadvali (admin-kategoriyalar): global sukut qatori, daraxt chuqurligi bilan, ustama, yetkazish
 * ko'rinishi, BAD, muddat — har birida qayerdan kelgani. Qatorni bosish — tafsilot paneli. Tartib rejimida
 * (holatlar 1) qator sudraladi yoki ↑ ↓ bilan ko'chiriladi; ichki kategoriya o'z otasi ichida qoladi.
 */
export function CategoryTable({ rows, global, selectedId, reorder, onSelect, onToggle, onEdit, onAddChild, onDelete, onMove }: CategoryTableProps) {
  const { t } = useTranslation();
  const [dragged, setDragged] = useState<CategoryRow | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);
  const yesNo = (value: boolean) => t(value ? 'acat.yes' : 'acat.no');

  const dragOver = (event: DragEvent, row: CategoryRow) => {
    if (!dragged || row.category.parentId !== dragged.category.parentId || row.category.id === dragged.category.id) return;
    event.preventDefault();
    const box = event.currentTarget.getBoundingClientRect();
    const place = event.clientY < box.top + box.height / 2 ? 'before' : 'after';
    if (drop?.id !== row.category.id || drop.place !== place) setDrop({ id: row.category.id, place });
  };

  const dropOn = (row: CategoryRow) => {
    if (dragged && drop) {
      const target = row.position - (dragged.position < row.position ? 1 : 0);
      onMove(dragged.category, drop.place === 'before' ? target : target + 1);
    }
    setDragged(null);
    setDrop(null);
  };

  return (
    <div className={styles.tableScroll}>
      <table className={styles.table} data-testid="category-table" data-reorder={reorder || undefined}>
        <caption className={styles.visuallyHidden}>{t(reorder ? 'acat.reorderCaption' : 'acat.caption')}</caption>
        <thead>
          <tr>
            <th>{t('acat.col.category')}</th>
            <th className={styles.colMarkup}>{t('acat.col.markup')}</th>
            <th className={styles.colDelivery}>{t('acat.col.delivery')}</th>
            <th className={styles.colFlag}>{t('acat.col.bad')}</th>
            <th className={styles.colExpiry}>{t('acat.col.expiry')}</th>
            <th className={reorder ? styles.colOrder : styles.colActions}>
              {reorder ? t('acat.col.order') : <span className={styles.visuallyHidden}>{t('acat.col.actions')}</span>}
            </th>
          </tr>
        </thead>
        <tbody>
          {global && !reorder ? (
            <tr className={styles.globalRow}>
              <td>
                <span className={styles.nameCell}>
                  <span className={styles.togglePlaceholder} />
                  <span>
                    <strong>{t('acat.global')}</strong>
                    <span>
                      {t('acat.globalHint')}
                      <span className={styles.tabletOnly}>{` · ${t('acat.globalMarkup', { value: global.markupCapPercent ?? '—' })}`}</span>
                    </span>
                  </span>
                </span>
              </td>
              <td className={styles.colMarkup}><span className={styles.own}>+{global.markupCapPercent ?? '—'}%</span><span className={styles.src}>{t('acat.src.default')}</span></td>
              <td>
                <span className={styles.own}>{modeLabel(t, global.deliveryMode)} · {plainMoney(global.visibleCenter)} / {plainMoney(global.visibleAddress)}</span>
                <span className={styles.src}>{global.updatedAt ? t('acat.since', { date: tashkentDay(global.updatedAt) }) : t('acat.src.default')}</span>
              </td>
              <td><span className={styles.inherited}>{t('acat.no')}</span><span className={styles.src}>{t('acat.src.default')}</span></td>
              <td><span className={styles.inherited}>{t('acat.no')}</span><span className={styles.src}>{t('acat.src.default')}</span></td>
              <td className={styles.colActions}>
                <Link to="/admin/settings" className={styles.iconButton} aria-label={t('acat.globalSettings')} title={t('acat.globalSettings')}><Settings aria-hidden /></Link>
              </td>
            </tr>
          ) : null}
          {rows.map((row) => {
            const { category } = row;
            return (
              <tr
                key={category.id}
                data-category-id={category.id}
                aria-selected={category.id === selectedId}
                data-inactive={!category.isActive || undefined}
                data-dragging={dragged?.category.id === category.id || undefined}
                data-drop={drop?.id === category.id ? drop.place : undefined}
                draggable={reorder}
                onDragStart={reorder ? (event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', category.id); setDragged(row); } : undefined}
                onDragOver={reorder ? (event) => dragOver(event, row) : undefined}
                onDrop={reorder ? () => dropOn(row) : undefined}
                onDragEnd={reorder ? () => { setDragged(null); setDrop(null); } : undefined}
                onClick={() => onSelect(category)}
              >
                <td>
                  <span className={styles.nameCell} style={{ paddingLeft: row.depth * 24 }}>
                    {reorder ? (
                      <button
                        type="button"
                        className={styles.grip}
                        aria-label={t('acat.drag', { name: category.name })}
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => {
                          if (event.key === 'ArrowUp' && row.position > 0) { event.preventDefault(); onMove(category, row.position - 1); }
                          if (event.key === 'ArrowDown' && row.position < row.siblings - 1) { event.preventDefault(); onMove(category, row.position + 1); }
                        }}
                      >
                        <GripVertical aria-hidden />
                      </button>
                    ) : null}
                    {row.hasChildren ? (
                      <button
                        type="button"
                        className={styles.toggle}
                        aria-expanded={row.expanded}
                        aria-label={t(row.expanded ? 'acat.collapse' : 'acat.expand', { name: category.name })}
                        onClick={(event) => { event.stopPropagation(); onToggle(category, row.expanded); }}
                      >
                        {row.expanded ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
                      </button>
                    ) : <span className={styles.togglePlaceholder} />}
                    <span>
                      <strong>{category.name}</strong>
                      <span>{productSummary(t, row.products)}{category.isActive ? '' : ` · ${t('status.inactive')}`}</span>
                    </span>
                  </span>
                </td>
                <td className={styles.colMarkup}><span className={tone(row.markup)}>+{row.markup.value ?? '—'}%</span><span className={styles.src}>{sourceLabel(t, row.markup.source)}</span></td>
                <td><span className={styles.cellValue}><DeliveryValue row={row} /></span><span className={styles.src}>{deliverySource(t, row)}</span></td>
                <td><span className={tone(row.bad)}>{yesNo(row.bad.value)}</span><span className={styles.src}>{sourceLabel(t, row.bad.source)}</span></td>
                <td><span className={tone(row.expiry)}>{yesNo(row.expiry.value)}</span><span className={styles.src}>{sourceLabel(t, row.expiry.source)}</span></td>
                <td className={reorder ? styles.colOrder : styles.colActions} onClick={(event) => event.stopPropagation()}>
                  {reorder ? (
                    <span className={styles.moveButtons}>
                      <button type="button" aria-label={t('acat.moveUp', { name: category.name })} title={t('acat.moveUp', { name: category.name })} disabled={row.position <= 0} onClick={() => onMove(category, row.position - 1)}><ArrowUp aria-hidden /></button>
                      <button type="button" aria-label={t('acat.moveDown', { name: category.name })} title={t('acat.moveDown', { name: category.name })} disabled={row.position >= row.siblings - 1} onClick={() => onMove(category, row.position + 1)}><ArrowDown aria-hidden /></button>
                    </span>
                  ) : (
                    <Dropdown
                      trigger={['click']}
                      placement="bottomRight"
                      menu={{
                        items: [
                          { key: 'edit', icon: <Pencil aria-hidden />, label: t('acat.edit') },
                          { key: 'child', icon: <Plus aria-hidden />, label: t('acat.addChild') },
                          { type: 'divider' },
                          { key: 'delete', icon: <Trash2 aria-hidden />, label: t('acat.delete'), danger: true },
                        ],
                        onClick: ({ key }) => {
                          if (key === 'edit') onEdit(category);
                          if (key === 'child') onAddChild(category);
                          if (key === 'delete') onDelete(category);
                        },
                      }}
                    >
                      <button type="button" className={styles.iconButton} aria-label={t('acat.menu', { name: category.name })} title={t('acat.menu', { name: category.name })}><MoreHorizontal aria-hidden /></button>
                    </Dropdown>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
