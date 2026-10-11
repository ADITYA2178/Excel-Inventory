import * as React from 'react';
import type { ColDef } from 'ag-grid-community';
import { ActionMenu } from '../../../ui/ActionMenu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../../ui/Tooltip';
import { Calculator, Copy, Lock, Plus, Settings2, Trash2 } from 'lucide-react';
import { ADD_COLUMN_FIELD, DATA_COLUMN_DEFAULT_WIDTH, ROW_ACTION_FIELD } from '../constants';
import type { GridCellSelectionRange, GridRow } from '../types';
import { getColumnLabel } from '../utils';
import type { ColumnSettingsState } from '../components/ColumnSettingsPopover';

interface UseExcelGridColumnsParams {
  columnKeys: string[];
  columnNames: Record<string, string>;
  formulaColumnKeys: Set<string>;
  lockedColumnKeys: Set<string>;
  getColumnFormulaPreview: (colKey: string) => string;
  userCreatedColumnFlags: Record<string, boolean>;
  setColumnSettingsState: React.Dispatch<React.SetStateAction<ColumnSettingsState>>;
  insertRowAtIndex: (insertIndex: number) => void;
  duplicateRowAtIndex: (rowIndex: number) => void;
  deleteRowAtIndex: (rowIndex: number) => void;
  insertColumnAtIndex: (insertIndex: number) => void;
  duplicateColumnAtIndex: (sourceIndex: number) => void;
  deleteColumnAtIndex: (sourceIndex: number) => void;
  openColumnSettings: (colKey: string) => void;
  openFormulaBuilderForColumn: (colKey: string) => void;
  selectedColumnKeyRef: React.MutableRefObject<string | null>;
  selectedRowIndexRef: React.MutableRefObject<number | null>;
  selectedRangeRef: React.MutableRefObject<GridCellSelectionRange | null>;
  rawMatrixRef: React.MutableRefObject<string[][]>;
  computedErrorRef: React.MutableRefObject<Set<string>>;
  searchMatchCellIdsRef: React.MutableRefObject<Set<string>>;
  activeSearchMatchCellIdRef: React.MutableRefObject<string | null>;
  cellIdFromPosition: (rowIndex: number, colKey: string) => string;
  markColumnActionClick: () => void;
}

export const useExcelGridColumns = ({
  columnKeys,
  columnNames,
  formulaColumnKeys,
  lockedColumnKeys,
  getColumnFormulaPreview,
  userCreatedColumnFlags,
  setColumnSettingsState,
  insertRowAtIndex,
  duplicateRowAtIndex,
  deleteRowAtIndex,
  insertColumnAtIndex,
  duplicateColumnAtIndex,
  deleteColumnAtIndex,
  openColumnSettings,
  openFormulaBuilderForColumn,
  selectedColumnKeyRef,
  selectedRowIndexRef,
  selectedRangeRef,
  rawMatrixRef,
  computedErrorRef,
  searchMatchCellIdsRef,
  activeSearchMatchCellIdRef,
  cellIdFromPosition,
  markColumnActionClick,
}: UseExcelGridColumnsParams) => {
  const getRowActionMenuItems = React.useCallback(
    (rowIndex: number) => [
      { label: 'Insert Above', icon: <Plus className='h-3.5 w-3.5' />, onClick: () => insertRowAtIndex(rowIndex) },
      { label: 'Insert Below', icon: <Plus className='h-3.5 w-3.5' />, onClick: () => insertRowAtIndex(rowIndex + 1) },
      { label: 'Duplicate Row', icon: <Copy className='h-3.5 w-3.5' />, onClick: () => duplicateRowAtIndex(rowIndex) },
      {
        label: 'Delete Row',
        icon: <Trash2 className='h-3.5 w-3.5 text-[#B91C1C]' />,
        className: 'text-[#B91C1C] hover:bg-[#FEF2F2] hover:text-[#B91C1C]',
        onClick: () => deleteRowAtIndex(rowIndex),
      },
    ],
    [deleteRowAtIndex, duplicateRowAtIndex, insertRowAtIndex],
  );

  const getColumnActionMenuItems = React.useCallback(
    (colKey: string) => {
      const sourceIndex = columnKeys.indexOf(colKey);
      const settingsItem = userCreatedColumnFlags[colKey]
        ? [
            {
              label: 'Column Settings',
              icon: <Settings2 className='h-3.5 w-3.5' />,
              onClick: () => openColumnSettings(colKey),
            },
          ]
        : [];

      return [
        ...settingsItem,
        {
          label: 'Apply Formula',
          icon: <Calculator className='h-3.5 w-3.5' />,
          onClick: () => openFormulaBuilderForColumn(colKey),
        },
        { label: 'Insert Left', icon: <Plus className='h-3.5 w-3.5' />, onClick: () => sourceIndex >= 0 && insertColumnAtIndex(sourceIndex) },
        {
          label: 'Insert Right',
          icon: <Plus className='h-3.5 w-3.5' />,
          onClick: () => sourceIndex >= 0 && insertColumnAtIndex(sourceIndex + 1),
        },
        {
          label: 'Duplicate Column',
          icon: <Copy className='h-3.5 w-3.5' />,
          onClick: () => sourceIndex >= 0 && duplicateColumnAtIndex(sourceIndex),
        },
        {
          label: 'Delete Column',
          icon: <Trash2 className='h-3.5 w-3.5 text-[#B91C1C]' />,
          className: 'text-[#B91C1C] hover:bg-[#FEF2F2] hover:text-[#B91C1C]',
          onClick: () => sourceIndex >= 0 && deleteColumnAtIndex(sourceIndex),
        },
      ];
    },
    [
      columnKeys,
      deleteColumnAtIndex,
      duplicateColumnAtIndex,
      insertColumnAtIndex,
      openColumnSettings,
      openFormulaBuilderForColumn,
      userCreatedColumnFlags,
    ],
  );

  const openCreateColumnPopover = React.useCallback(
    (target: HTMLElement | null) => {
      const addColumnHeaderCell = document.querySelector(`.ag-header-cell[col-id="${ADD_COLUMN_FIELD}"]`) as HTMLElement | null;
      const bounds = addColumnHeaderCell?.getBoundingClientRect() ?? target?.getBoundingClientRect();
      const popoverWidth = 340;
      const horizontalPadding = 16;
      const centeredLeft = bounds ? bounds.left + bounds.width / 2 - popoverWidth / 2 : 16;
      setColumnSettingsState({
        open: true,
        colKey: '',
        value: getColumnLabel(columnKeys.length),
        isShowIncostSheet: true,
        columnType: 'NUMBER',
        position: 'AFTER',
        referenceColumn: 'AGREEMENT_VALUE',
        isCostEditable: true,
        canEditName: true,
        isStaticHeader: false,
        isCreateMode: true,
        pendingInsertIndex: columnKeys.length,
        editNameMessage: '',
        anchorLeft: Math.max(horizontalPadding, Math.min(centeredLeft, window.innerWidth - popoverWidth - horizontalPadding)),
        anchorTop: bounds ? Math.min(bounds.bottom + 6, window.innerHeight - 300) : 64,
      });
    },
    [columnKeys.length, setColumnSettingsState],
  );

  const columnDefs = React.useMemo<ColDef<GridRow>[]>(() => {
    const dataCols: ColDef<GridRow>[] = [
      {
        field: ROW_ACTION_FIELD,
        headerName: '',
        editable: () => false,
        resizable: false,
        sortable: false,
        width: 44,
        minWidth: 44,
        maxWidth: 52,
        pinned: 'left',
        suppressNavigable: true,
        cellClass: (params: { data?: GridRow }) => {
          if (params.data?.__isAddRow === 'true') return '';
          return 'text-center text-[#6B7280] cursor-pointer';
        },
        cellRenderer: (params: { data?: GridRow }) => {
          if (params.data?.__isAddRow === 'true') return '';
          const rowIndex = params.data?.__rowIndex;
          if (rowIndex === undefined || rowIndex < 0) return '';
          return (
            <div className='inventory-row-action-menu flex h-full items-center justify-center' onClick={(event) => event.stopPropagation()}>
              <ActionMenu
                items={getRowActionMenuItems(rowIndex)}
                buttonVariant='tertiary'
                triggerClassName='h-6 w-6 rounded-md p-0 hover:bg-[#F3F4F6]'
                iconSize={14}
              />
            </div>
          );
        },
      },
      ...columnKeys.map((colKey, colIndex) => ({
        field: colKey,
        headerName: columnNames[colKey] ?? colKey,
        headerComponent: () => {
          const hasFormulaInColumn = formulaColumnKeys.has(colKey);
          const isLockedColumn = lockedColumnKeys.has(colKey);
          const formulaPreview = getColumnFormulaPreview(colKey);
          return (
            <div className='flex h-full w-full items-center justify-between gap-1.5 px-1.5'>
              <div className='flex min-w-0 items-center gap-1.5'>
                {isLockedColumn ? (
                  <TooltipProvider delayDuration={120}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className='inline-flex h-4 items-center rounded bg-[#FEF3C7] px-1 text-[10px] font-semibold uppercase tracking-wide text-[#B45309] ring-1 ring-[#FDE68A]'>
                          <Lock className='h-2.5 w-2.5' aria-hidden />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side='top' className='max-w-xs break-words bg-[#92400E] text-[12px] text-[#FFFBEB]'>
                        Locked column: editable only by sheet admins.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : null}
                {hasFormulaInColumn ? (
                  <TooltipProvider delayDuration={120}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type='button'
                          onClick={(event) => {
                            event.stopPropagation();
                            markColumnActionClick();
                            openFormulaBuilderForColumn(colKey);
                          }}
                          className='inline-flex h-4 cursor-pointer items-center rounded bg-[#EAF2FF] px-1 text-[10px] font-semibold uppercase tracking-wide text-[#1D4ED8]'
                        >
                          fx
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side='top' className='max-w-xs break-words bg-[#0B3EA8] text-[12px]'>
                        Click to edit formula
                        <br />
                        <span className='font-semibold'>{formulaPreview || 'No formula available'}</span>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : null}
                <span className='truncate text-xs font-bold text-[#374151]'>{columnNames[colKey] ?? colKey}</span>
              </div>
              <div
                className='inventory-column-action-menu'
                onPointerDown={(event) => {
                  markColumnActionClick();
                  event.stopPropagation();
                }}
                onMouseDown={(event) => {
                  markColumnActionClick();
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  markColumnActionClick();
                  event.stopPropagation();
                }}
              >
                <ActionMenu
                  items={getColumnActionMenuItems(colKey)}
                  buttonVariant='tertiary'
                  triggerClassName='h-5 w-5 rounded-md p-0 text-[#6B7280] hover:bg-[#E5E7EB] hover:text-[#374151]'
                  iconSize={12}
                />
              </div>
            </div>
          );
        },
        editable: (params: { data?: GridRow }) =>
          params.data?.__isAddRow !== 'true' && !lockedColumnKeys.has(colKey) && !formulaColumnKeys.has(colKey),
        minWidth: 110,
        initialWidth: DATA_COLUMN_DEFAULT_WIDTH,
        cellClass: (params: { data?: GridRow }) => {
          if (params.data?.__isAddRow === 'true') return 'inventory-add-row-cell';
          const rowIndex = params.data?.__rowIndex;
          if (rowIndex === undefined) return '';
          const classNames: string[] = [];
          const isRowSelected = selectedRowIndexRef.current === rowIndex;
          const isColumnSelected = selectedColumnKeyRef.current === colKey;
          const selectedRange = selectedRangeRef.current;
          if (isRowSelected) {
            classNames.push('inventory-cell-row-selected');
          }
          if (selectedColumnKeyRef.current === colKey) {
            classNames.push('inventory-cell-column-selected');
          }
          if (isRowSelected && isColumnSelected) {
            classNames.push('inventory-cell-row-column-intersection');
          }
          if (selectedRange) {
            const startRowIndex = Math.min(selectedRange.anchor.rowIndex, selectedRange.focus.rowIndex);
            const endRowIndex = Math.max(selectedRange.anchor.rowIndex, selectedRange.focus.rowIndex);
            const startColIndex = columnKeys.indexOf(selectedRange.anchor.colKey);
            const endColIndex = columnKeys.indexOf(selectedRange.focus.colKey);
            const currentColIndex = columnKeys.indexOf(colKey);
            const minColIndex = Math.min(startColIndex, endColIndex);
            const maxColIndex = Math.max(startColIndex, endColIndex);
            if (
              startColIndex >= 0 &&
              endColIndex >= 0 &&
              currentColIndex >= minColIndex &&
              currentColIndex <= maxColIndex &&
              rowIndex >= startRowIndex &&
              rowIndex <= endRowIndex
            ) {
              classNames.push('inventory-cell-range-selected');
            }
          }
          const cellId = cellIdFromPosition(rowIndex, colKey);
          if (searchMatchCellIdsRef.current.has(cellId)) {
            classNames.push(activeSearchMatchCellIdRef.current === cellId ? 'inventory-cell-search-active' : 'inventory-cell-search-match');
          }
          const raw = rawMatrixRef.current[rowIndex]?.[colIndex] ?? '';
          if (String(raw).startsWith('=')) {
            classNames.push(computedErrorRef.current.has(cellId) ? 'bg-[#FEF2F2] text-[#B91C1C]' : 'bg-[#EEF6FF] text-[#1E3A8A]');
          }
          return classNames.join(' ');
        },
      })),
    ];

    dataCols.push({
      field: ADD_COLUMN_FIELD,
      headerName: '',
      editable: () => false,
      resizable: false,
      sortable: false,
      pinned: 'right',
      lockPinned: true,
      suppressMovable: true,
      suppressNavigable: true,
      initialWidth: 48,
      minWidth: 48,
      maxWidth: 48,
      headerClass: 'inventory-add-column-header-cell',
      headerComponent: () => <span className='sr-only'>Add column</span>,
      cellClass: 'inventory-add-column-cell',
      cellRenderer: () => (
        <button
          type='button'
          onClick={(event) => {
            event.stopPropagation();
            openCreateColumnPopover(event.currentTarget as HTMLButtonElement);
          }}
          className='inventory-add-column-rail'
          aria-label='Add a new column'
          title='Add column'
        >
          <span className='sr-only'>Add Column</span>
        </button>
      ),
      valueGetter: () => '',
    });

    return dataCols;
  }, [
    cellIdFromPosition,
    columnKeys,
    columnNames,
    getColumnFormulaPreview,
    computedErrorRef,
    formulaColumnKeys,
    lockedColumnKeys,
    getColumnActionMenuItems,
    getRowActionMenuItems,
    markColumnActionClick,
    rawMatrixRef,
    selectedRowIndexRef,
    selectedColumnKeyRef,
    selectedRangeRef,
    setColumnSettingsState,
    openCreateColumnPopover,
  ]);

  return { columnDefs, openCreateColumnPopover };
};
