import * as React from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { ConfirmationDialog } from '../ui/ConfirmationDialog';
import Button from '../ui/Button';
import { toast, ToastViewport } from '../ui/toast';
import type { ColumnSetting, ExcelInventoryGridProps } from './types';
import type {
  CellFocusedEvent,
  CellKeyDownEvent,
  CellValueChangedEvent,
  ColDef,
  ColumnResizedEvent,
  GridApi,
  GridReadyEvent,
} from 'ag-grid-community';
import { ArrowLeft, Download } from 'lucide-react';
import { getFormulaSuggestions, type FormulaSuggestion } from './autocompleteEngine';
import { evaluateFormulaExpression, formatFormulaValue, parseRawCellAsFormulaValue, type FormulaValue } from './formulaParser';
import { buildDependencyMaps, collectDependents, detectCircularReferenceForColumnApply, hasCircularDependency } from './dependencyManager';
import {
  ADD_COLUMN_FIELD,
  ColumnSettingsPopover,
  type ColumnSettingsState,
  DATA_COLUMN_DEFAULT_WIDTH,
  DEFAULT_COLS,
  DEFAULT_ROWS,
  FormulaBuilderPanel,
  getColumnLabel,
  InventoryExcelStyles,
  InventoryExcelToolbar,
  normalizeHeaderKey,
  ROW_ACTION_FIELD,
  sanitizeString,
  useExcelColumns,
  useExcelGridColumns,
  useExcelRows,
  type GridCellPosition,
  type GridCellSelectionRange,
  type GridRow,
  canonicalizeRefLabel,
  escapeRegex,
  formatGridHeaderName,
  type ColumnTypeOption,
  type RelativeColumnPosition,
} from './excel';

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

ModuleRegistry.registerModules([AllCommunityModule]);
const MAX_UNDO_HISTORY = 100;
interface ColumnConfigState {
  columnType: ColumnTypeOption;
  isCostEditable: boolean;
  referenceColumn: 'AGREEMENT_VALUE';
  position: RelativeColumnPosition;
  isCostSheet: boolean;
  orderIndex: number;
}

const normalizeApiColumnFormula = (formula: string, keys: string[], names: Record<string, string>) => {
  if (!formula.startsWith('=')) return formula;
  let normalized = formula.replace(/\{\{\s*([^}]+)\s*\}\}/g, '$1');
  const normalizeAsToken = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  const normalizeAsCompact = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]+/g, '');

  const aliasToKey = new Map<string, string>();
  keys.forEach((key) => {
    const header = (names[key] ?? key).trim();
    const tokenizedHeader = normalizeAsToken(header);
    const compactHeader = normalizeAsCompact(header);

    [key, header, tokenizedHeader, compactHeader].forEach((alias) => {
      const cleanedAlias = String(alias ?? '').trim();
      if (!cleanedAlias) return;
      aliasToKey.set(cleanedAlias.toUpperCase(), key);
    });
  });

  const sortedAliasEntries = Array.from(aliasToKey.entries()).sort((left, right) => right[0].length - left[0].length);
  sortedAliasEntries.forEach(([alias, key]) => {
    const aliasPattern = new RegExp(`(^|[^A-Za-z0-9_])(${escapeRegex(alias)})(?=$|[^A-Za-z0-9_])`, 'gi');
    normalized = normalized.replace(aliasPattern, (_, prefix: string) => `${prefix}${key}`);
  });

  const sortedHeaders = keys
    .map((key) => ({ key, header: (names[key] ?? key).trim() }))
    .filter(({ key, header }) => header && header.toUpperCase() !== key.toUpperCase())
    .sort((left, right) => right.header.length - left.header.length);

  sortedHeaders.forEach(({ key, header }) => {
    const headerRefWithRow = new RegExp(`\\b${escapeRegex(header)}\\s*(\\d+)\\b`, 'gi');
    normalized = normalized.replace(headerRefWithRow, `${key}$1`);
    const bareHeaderRef = new RegExp(`(^|[^A-Za-z0-9_])(${escapeRegex(header)})(?=$|[^A-Za-z0-9_])`, 'gi');
    normalized = normalized.replace(bareHeaderRef, (_, prefix: string) => `${prefix}${key}`);
  });

  return normalized;
};


type SelectionMode = 'none' | 'cell' | 'range' | 'row' | 'column' | 'all';

interface GridSelectionState {
  mode: SelectionMode;
  rangeSize: number;
  addressLabel: string;
}

interface SearchMatch {
  rowIndex: number;
  colIndex: number;
  colKey: string;
}

const isElementInsideActionMenu = (target: EventTarget | null) =>
  target instanceof Element &&
  Boolean(
    target.closest('.inventory-row-action-menu') ||
      target.closest('.inventory-column-action-menu') ||
      target.closest('[data-radix-popper-content-wrapper]'),
  );

const ARROW_NAVIGATION_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const isAgreementValueHeader = (header: string) => {
  const normalized = normalizeHeaderKey(header);
  return normalized === 'agreementvalue' || normalized.startsWith('agreementval');
};

const ExcelInventoryGrid: React.FC<ExcelInventoryGridProps> = ({
  initialMatrix,
  headers,
  staticHeaders,
  metadataHeaders,
  columnSettings: headerColumnSettings,
  title = 'Excel Inventory',
  onBack,
  onSave,
}) => {
  const normalizedHeaders = React.useMemo(() => (headers ?? []).map((header) => String(header ?? '').trim()).filter(Boolean), [headers]);
  const initialColumnCount = normalizedHeaders.length || DEFAULT_COLS;
  const [columnKeys, setColumnKeys] = React.useState<string[]>(Array.from({ length: initialColumnCount }, (_, index) => getColumnLabel(index)));
  const [columnNames, setColumnNames] = React.useState<Record<string, string>>(() =>
    Array.from({ length: initialColumnCount }, (_, index) => getColumnLabel(index)).reduce<Record<string, string>>((acc, key, index) => {
      acc[key] = formatGridHeaderName(normalizedHeaders[index] || key, key);
      return acc;
    }, {}),
  );
  const [rawMatrix, setRawMatrix] = React.useState<string[][]>(() => {
    if (initialMatrix && initialMatrix.length) {
      return initialMatrix.map((row) => Array.from({ length: initialColumnCount }, (_, colIndex) => String(row[colIndex] ?? '')));
    }
    return Array.from({ length: DEFAULT_ROWS }, () => Array.from({ length: initialColumnCount }, () => ''));
  });
  const [, setRowIds] = React.useState<(number | null)[]>(() => Array.from({ length: rawMatrix.length }, () => null));
  const [isAllGridSelected, setIsAllGridSelected] = React.useState(false);
  const [selectedCell, setSelectedCell] = React.useState<{ rowIndex: number; colKey: string } | null>(null);
  const [selectedRange, setSelectedRange] = React.useState<GridCellSelectionRange | null>(null);
  const [selectedColumnKey, setSelectedColumnKey] = React.useState<string | null>(null);
  const [selectedRowIndex, setSelectedRowIndex] = React.useState<number | null>(null);
  const [gridSelection, setGridSelection] = React.useState<GridSelectionState>({ mode: 'none', rangeSize: 0, addressLabel: '' });
  const [formulaInput, setFormulaInput] = React.useState('');
  const [columnFormulaByKey, setColumnFormulaByKey] = React.useState<Record<string, string>>({});
  const [isFormulaPanelOpen, setIsFormulaPanelOpen] = React.useState(false);
  const [panelSuggestions, setPanelSuggestions] = React.useState<FormulaSuggestion[]>([]);
  const [panelActiveIndex, setPanelActiveIndex] = React.useState(0);
  const [isSubmittingImport, setIsSubmittingImport] = React.useState(false);
  const [isSearchPanelOpen, setIsSearchPanelOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');
  const [replaceValue, setReplaceValue] = React.useState('');
  const [activeSearchMatchIndex, setActiveSearchMatchIndex] = React.useState(0);
  const deferredSearchValue = React.useDeferredValue(searchValue);
  const [isResetDialogOpen, setIsResetDialogOpen] = React.useState(false);
  const [columnCostSheetFlags, setColumnCostSheetFlags] = React.useState<Record<string, boolean>>({});
  const [columnConfigs, setColumnConfigs] = React.useState<Record<string, ColumnConfigState>>({});
  const [userCreatedColumnFlags, setUserCreatedColumnFlags] = React.useState<Record<string, boolean>>(() =>
    Array.from({ length: initialColumnCount }, (_, index) => getColumnLabel(index)).reduce<Record<string, boolean>>((acc, key) => {
      acc[key] = false;
      return acc;
    }, {}),
  );
  const [columnSettingsState, setColumnSettingsState] = React.useState<ColumnSettingsState>({
    open: false,
    colKey: '',
    value: '',
    isShowIncostSheet: true,
    columnType: 'NUMBER',
    position: 'AFTER',
    referenceColumn: 'AGREEMENT_VALUE',
    isCostEditable: true,
    canEditName: true,
    isStaticHeader: false,
    isCreateMode: false,
    pendingInsertIndex: -1,
    editNameMessage: '',
    anchorLeft: 16,
    anchorTop: 64,
  });
  const [cellLockTooltip, setCellLockTooltip] = React.useState<{ left: number; top: number; message: string } | null>(null);
  const formulaPanelInputRef = React.useRef<HTMLTextAreaElement | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const gridRootRef = React.useRef<HTMLDivElement | null>(null);
  const gridApiRef = React.useRef<GridApi<GridRow> | null>(null);
  const hasSizedColumnsRef = React.useRef(false);
  const selectedColumnKeyRef = React.useRef<string | null>(null);
  const selectedRowIndexRef = React.useRef<number | null>(null);
  const selectedRangeRef = React.useRef<GridCellSelectionRange | null>(null);
  const rangeSelectionAnchorRef = React.useRef<GridCellPosition | null>(null);
  const isSelectingRangeRef = React.useRef(false);
  const rawMatrixRef = React.useRef<string[][]>(rawMatrix);
  const computedErrorRef = React.useRef<Set<string>>(new Set());
  const searchMatchCellIdsRef = React.useRef<Set<string>>(new Set());
  const activeSearchMatchCellIdRef = React.useRef<string | null>(null);
  const hasNavigatedPanelSuggestionsRef = React.useRef(false);
  const undoPastRef = React.useRef<string[][][]>([]);
  const undoFutureRef = React.useRef<string[][][]>([]);
  const lastHeaderClickRef = React.useRef<{ colKey: string; timestamp: number }>({ colKey: '', timestamp: 0 });
  const skipNextHeaderSelectionRef = React.useRef(false);
  const hasManualColumnResizeRef = React.useRef(false);
  const shouldSkipNextFocusedSyncRef = React.useRef(false);
  const isCellRefreshScheduledRef = React.useRef(false);
  const cellLockTooltipTimerRef = React.useRef<number | null>(null);

  const inferColumnTypeFromHeader = React.useCallback((headerLabel: string): ColumnTypeOption => {
    const normalized = normalizeHeaderKey(headerLabel);
    if (['agreementvalue', 'allinclusiveprice', 'baseprice', 'carpetarea', 'saleablearea', 'psfr', 'floorno'].includes(normalized)) {
      return 'NUMBER';
    }
    return 'STRING';
  }, []);

  const normalizedHeaderSettings = React.useMemo(() => {
    const map = new Map<
      string,
      {
        displayName?: string;
        isShowIncostSheet?: boolean;
        columnType?: ColumnTypeOption;
        isCostEditable?: boolean;
        isExcelEditable?: boolean;
        excelFormula?: string;
        referenceColumn?: 'AGREEMENT_VALUE';
        position?: RelativeColumnPosition;
      }
    >();
    Object.entries(headerColumnSettings ?? {}).forEach(([rawKey, setting]) => {
      const normalizedSetting = {
        ...setting,
        columnType: setting.columnType === 'NUMBER' || setting.columnType === 'STRING' ? setting.columnType : undefined,
      };
      const normalizedKey = normalizeHeaderKey(rawKey);
      if (normalizedKey) {
        map.set(normalizedKey, normalizedSetting);
      }
      const normalizedDisplayName = normalizeHeaderKey(setting.displayName ?? '');
      if (normalizedDisplayName) {
        map.set(normalizedDisplayName, normalizedSetting);
      }
    });
    return map;
  }, [headerColumnSettings]);

  const scheduleGridCellRefresh = React.useCallback(() => {
    if (isCellRefreshScheduledRef.current) return;
    isCellRefreshScheduledRef.current = true;
    window.requestAnimationFrame(() => {
      isCellRefreshScheduledRef.current = false;
      gridApiRef.current?.refreshCells();
    });
  }, []);

  React.useEffect(() => {
    selectedColumnKeyRef.current = selectedColumnKey;
  }, [selectedColumnKey]);

  React.useEffect(() => {
    selectedRowIndexRef.current = selectedRowIndex;
  }, [selectedRowIndex]);

  React.useEffect(() => {
    selectedRangeRef.current = selectedRange;
    scheduleGridCellRefresh();
  }, [scheduleGridCellRefresh, selectedRange]);

  React.useEffect(() => {
    rawMatrixRef.current = rawMatrix;
  }, [rawMatrix]);

  React.useEffect(() => {
    return () => {
      if (cellLockTooltipTimerRef.current !== null) {
        window.clearTimeout(cellLockTooltipTimerRef.current);
      }
    };
  }, []);

  const cloneMatrix = React.useCallback((matrix: string[][]) => matrix.map((row) => [...row]), []);

  const areMatricesEqual = React.useCallback((left: string[][], right: string[][]) => {
    if (left.length !== right.length) return false;
    for (let rowIndex = 0; rowIndex < left.length; rowIndex += 1) {
      if ((left[rowIndex]?.length ?? 0) !== (right[rowIndex]?.length ?? 0)) return false;
      for (let colIndex = 0; colIndex < left[rowIndex].length; colIndex += 1) {
        if (left[rowIndex][colIndex] !== right[rowIndex][colIndex]) return false;
      }
    }
    return true;
  }, []);

  const setRawMatrixWithHistory = React.useCallback(
    (updater: React.SetStateAction<string[][]>) => {
      setRawMatrix((prev) => {
        const next = typeof updater === 'function' ? (updater as (prevState: string[][]) => string[][])(prev) : updater;
        if (areMatricesEqual(prev, next)) return prev;
        undoPastRef.current.push(cloneMatrix(prev));
        if (undoPastRef.current.length > MAX_UNDO_HISTORY) {
          undoPastRef.current.shift();
        }
        undoFutureRef.current = [];
        return next;
      });
    },
    [areMatricesEqual, cloneMatrix],
  );

  const handleUndo = React.useCallback(() => {
    const previous = undoPastRef.current.pop();
    if (!previous) return;
    setRawMatrix((current) => {
      undoFutureRef.current.push(cloneMatrix(current));
      return cloneMatrix(previous);
    });
  }, [cloneMatrix]);

  const handleRedo = React.useCallback(() => {
    const next = undoFutureRef.current.pop();
    if (!next) return;
    setRawMatrix((current) => {
      undoPastRef.current.push(cloneMatrix(current));
      if (undoPastRef.current.length > MAX_UNDO_HISTORY) {
        undoPastRef.current.shift();
      }
      return cloneMatrix(next);
    });
  }, [cloneMatrix]);

  React.useEffect(() => {
    if (!normalizedHeaders.length) return;
    const nextColumnCount = normalizedHeaders.length;
    const nextColumnKeys = Array.from({ length: nextColumnCount }, (_, index) => getColumnLabel(index));

    setColumnKeys(nextColumnKeys);
    setColumnNames(() =>
      nextColumnKeys.reduce<Record<string, string>>((acc, key, index) => {
        acc[key] = formatGridHeaderName(normalizedHeaders[index] || key, key);
        return acc;
      }, {}),
    );
    setColumnFormulaByKey({});
    const metadataHeaderSet = new Set((metadataHeaders ?? []).map((header) => normalizeHeaderKey(header)));
    setColumnCostSheetFlags(() =>
      nextColumnKeys.reduce<Record<string, boolean>>((acc, key, index) => {
        const headerLabel = formatGridHeaderName(normalizedHeaders[index] || key, key);
        const normalizedLabel = normalizeHeaderKey(headerLabel);
        const prefillFromApi = normalizedHeaderSettings.get(normalizedLabel);
        const inferredIsCostSheet = metadataHeaderSet.has(normalizedLabel) ? false : inferColumnTypeFromHeader(headerLabel) === 'NUMBER';
        acc[key] = prefillFromApi?.isShowIncostSheet ?? inferredIsCostSheet;
        return acc;
      }, {}),
    );
    setColumnConfigs(() =>
      nextColumnKeys.reduce<Record<string, ColumnConfigState>>((acc, key, index) => {
        const headerLabel = formatGridHeaderName(normalizedHeaders[index] || key, key);
        const normalizedLabel = normalizeHeaderKey(headerLabel);
        const prefillFromApi = normalizedHeaderSettings.get(normalizedLabel);
        const inferredColumnType = inferColumnTypeFromHeader(headerLabel);
        const isCostSheet = prefillFromApi?.isShowIncostSheet ?? (metadataHeaderSet.has(normalizedLabel) ? false : inferredColumnType === 'NUMBER');
        acc[key] = {
          columnType: prefillFromApi?.columnType ?? inferredColumnType,
          isCostEditable: prefillFromApi?.isExcelEditable ?? prefillFromApi?.isCostEditable ?? true,
          referenceColumn: prefillFromApi?.referenceColumn ?? 'AGREEMENT_VALUE',
          position: prefillFromApi?.position ?? 'AFTER',
          isCostSheet,
          orderIndex: index + 1,
        };
        return acc;
      }, {}),
    );
    const initialColumnFormulaMap = nextColumnKeys.reduce<Record<string, string>>((acc, key, index) => {
      const headerLabel = formatGridHeaderName(normalizedHeaders[index] || key, key);
      const normalizedLabel = normalizeHeaderKey(headerLabel);
      const prefillFromApi = normalizedHeaderSettings.get(normalizedLabel);
      const formula = String(prefillFromApi?.excelFormula ?? '').trim();
      if (formula.startsWith('=')) {
        acc[key] = normalizeApiColumnFormula(
          formula,
          nextColumnKeys,
          nextColumnKeys.reduce<Record<string, string>>((nameAcc, colKey, colIndex) => {
            nameAcc[colKey] = formatGridHeaderName(normalizedHeaders[colIndex] || colKey, colKey);
            return nameAcc;
          }, {}),
        );
      }
      return acc;
    }, {});
    setColumnFormulaByKey(initialColumnFormulaMap);
    setUserCreatedColumnFlags(() =>
      nextColumnKeys.reduce<Record<string, boolean>>((acc, key) => {
        acc[key] = false;
        return acc;
      }, {}),
    );
    setRawMatrix((prev) => {
      const nextRows = prev.length ? prev.length : DEFAULT_ROWS;
      const baseMatrix = prev.length
        ? prev.map((row) => {
            const nextRow = Array.from({ length: nextColumnCount }, (_, colIndex) => String(row[colIndex] ?? ''));
            return nextRow;
          })
        : Array.from({ length: nextRows }, () => Array.from({ length: nextColumnCount }, () => ''));
      const formulaEntries = Object.entries(initialColumnFormulaMap);
      if (!formulaEntries.length) return baseMatrix;
      return baseMatrix.map((row) => {
        const nextRow = [...row];
        formulaEntries.forEach(([formulaColKey, formulaValue]) => {
          const formulaColIndex = nextColumnKeys.indexOf(formulaColKey);
          if (formulaColIndex < 0) return;
          const isSelfReferencingFormula = new RegExp(`\\b${escapeRegex(formulaColKey)}\\b`, 'i').test(formulaValue);
          if (isSelfReferencingFormula) {
            return;
          }
          nextRow[formulaColIndex] = formulaValue;
        });
        return nextRow;
      });
    });
  }, [inferColumnTypeFromHeader, metadataHeaders, normalizedHeaderSettings, normalizedHeaders]);

  const cellIdFromPosition = React.useCallback((rowIndex: number, colKey: string) => `${colKey}${rowIndex + 1}`, []);

  const headerToKeyMap = React.useMemo(() => {
    const map = new Map<string, string>();
    columnKeys.forEach((key) => {
      map.set(key.toUpperCase(), key);
      const header = (columnNames[key] ?? key).trim();
      map.set(header.toUpperCase(), key);
      const canonicalHeader = canonicalizeRefLabel(header);
      if (canonicalHeader) {
        map.set(canonicalHeader, key);
      }
    });
    return map;
  }, [columnKeys, columnNames]);

  const normalizeFormulaForEngine = React.useCallback(
    (formula: string) => {
      if (!formula.startsWith('=')) return formula;
      let normalized = formula;
      const sortedHeaders = columnKeys
        .map((key) => ({ key, header: (columnNames[key] ?? key).trim() }))
        .filter(({ key, header }) => header && header.toUpperCase() !== key.toUpperCase())
        .sort((left, right) => right.header.length - left.header.length);

      sortedHeaders.forEach(({ key, header }) => {
        const headerRefWithRow = new RegExp(`\\b${escapeRegex(header)}\\s*(\\d+)\\b`, 'gi');
        normalized = normalized.replace(headerRefWithRow, `${key}$1`);
        const bareHeaderRef = new RegExp(`(^|[^A-Za-z0-9_])(${escapeRegex(header)})(?=$|[^A-Za-z0-9_])`, 'gi');
        normalized = normalized.replace(bareHeaderRef, (_, prefix: string) => `${prefix}${key}`);
      });

      return normalized;
    },
    [columnKeys, columnNames],
  );

  const formatFormulaForDisplay = React.useCallback(
    (formula: string) => {
      if (!formula.startsWith('=')) return formula;
      let displayFormula = formula;
      columnKeys
        .slice()
        .sort((left, right) => right.length - left.length)
        .forEach((key) => {
          const header = (columnNames[key] ?? key).trim();
          if (!header || header.toUpperCase() === key.toUpperCase()) return;
          const keyRef = new RegExp(`(^|[^A-Za-z0-9_])(${escapeRegex(key)})(\\d*)(?=$|[^A-Za-z0-9_])`, 'g');
          displayFormula = displayFormula.replace(keyRef, (_match, prefix: string, _colKey: string, rowNumber: string) => {
            return `${prefix}${header}${rowNumber}`;
          });
        });
      return displayFormula;
    },
    [columnKeys, columnNames],
  );

  const formulaSuggestionKeys = React.useMemo(
    () => Array.from(new Set([...columnKeys.map((key) => columnNames[key] ?? key), ...columnKeys])),
    [columnKeys, columnNames],
  );

  const quickTemplateColumnLabels = React.useMemo(
    () => Array.from(new Set(columnKeys.map((key) => String(columnNames[key] ?? key).trim()).filter(Boolean))),
    [columnKeys, columnNames],
  );

  const updatePanelSuggestions = React.useCallback(
    (nextValue: string, cursorPosition: number) => {
      const next = getFormulaSuggestions(nextValue, cursorPosition, formulaSuggestionKeys);
      setPanelSuggestions(next);
      setPanelActiveIndex(0);
      hasNavigatedPanelSuggestionsRef.current = false;
    },
    [formulaSuggestionKeys],
  );

  const handleFormulaInputFocus = React.useCallback(() => {
    const input = formulaPanelInputRef.current;
    const nextValue = formulaInput.trim() ? formulaInput : '=';

    if (!formulaInput.trim()) {
      setFormulaInput(nextValue);
      requestAnimationFrame(() => {
        input?.setSelectionRange(nextValue.length, nextValue.length);
      });
    }
  }, [formulaInput]);

  const handleFormulaInputClick = React.useCallback(() => {
    if (panelSuggestions.length) {
      setPanelSuggestions([]);
      setPanelActiveIndex(0);
    }
  }, [panelSuggestions.length]);

  const handleToggleFormulaPanel = React.useCallback(() => {
    const willOpen = !isFormulaPanelOpen;
    setIsFormulaPanelOpen(willOpen);

    if (!willOpen) {
      setPanelSuggestions([]);
      setPanelActiveIndex(0);
      return;
    }

    const nextValue = formulaInput.trim() ? formulaInput : '=';
    if (!formulaInput.trim()) {
      setFormulaInput(nextValue);
    }

    requestAnimationFrame(() => {
      const input = formulaPanelInputRef.current;
      input?.focus();
      input?.setSelectionRange(nextValue.length, nextValue.length);
      updatePanelSuggestions(nextValue, nextValue.length);
    });
  }, [formulaInput, isFormulaPanelOpen, updatePanelSuggestions]);

  const applyPanelSuggestion = React.useCallback(
    (suggestion: FormulaSuggestion) => {
      const input = formulaPanelInputRef.current;
      if (!input) return;
      const cursor = input.selectionStart ?? formulaInput.length;
      const left = formulaInput.slice(0, cursor);
      const right = formulaInput.slice(cursor);
      const tokenMatch = left.match(/[A-Za-z0-9 _-]+$/);
      const tokenLength = suggestion.type === 'column' || suggestion.type === 'function' ? (tokenMatch?.[0]?.length ?? 0) : 0;
      const insertedValue = suggestion.insertText ?? suggestion.value;
      const updated = suggestion.type === 'template' ? insertedValue : `${left.slice(0, left.length - tokenLength)}${insertedValue}${right}`;
      const nextCursor = suggestion.type === 'template' ? insertedValue.length : left.length - tokenLength + insertedValue.length;

      setFormulaInput(updated);
      requestAnimationFrame(() => {
        input.focus();
        input.setSelectionRange(nextCursor, nextCursor);
        updatePanelSuggestions(updated, nextCursor);
      });
    },
    [formulaInput, updatePanelSuggestions],
  );

  const normalizeRefToCellId = React.useCallback(
    (ref: string, currentCellId: string) => {
      const parsed = ref.trim().match(/^([A-Za-z]+)(\d+)?$/);
      if (!parsed) return null;
      const [, labelPart, rowPart] = parsed;
      const resolvedColKey = headerToKeyMap.get(labelPart.toUpperCase()) ?? headerToKeyMap.get(canonicalizeRefLabel(labelPart));
      if (!resolvedColKey) return null;
      if (rowPart) return `${resolvedColKey}${rowPart}`;
      const currentRowMatch = currentCellId.match(/[0-9]+$/);
      if (!currentRowMatch) {
        return null;
      }
      return `${resolvedColKey}${currentRowMatch[0]}`;
    },
    [headerToKeyMap],
  );

  const computedMatrix = React.useMemo(() => {
    const formulaByCell = new Map<string, string>();
    rawMatrix.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (String(cell).startsWith('=')) {
          formulaByCell.set(`${columnKeys[colIndex]}${rowIndex + 1}`, normalizeFormulaForEngine(String(cell)));
        }
      });
    });

    const dependencyMaps = buildDependencyMaps(formulaByCell, normalizeRefToCellId);
    const formulaCellsWithCycle = new Set<string>();
    formulaByCell.forEach((_, cellId) => {
      if (hasCircularDependency(cellId, dependencyMaps.forward)) {
        formulaCellsWithCycle.add(cellId);
      }
    });

    const valueMemo = new Map<string, FormulaValue>();
    const errorCells = new Set<string>();

    const evaluateCell = (cellId: string, stack: Set<string>): FormulaValue => {
      if (valueMemo.has(cellId)) return valueMemo.get(cellId) as FormulaValue;
      if (stack.has(cellId) || formulaCellsWithCycle.has(cellId)) throw new Error('Circular dependency');

      const colMatch = cellId.match(/^[A-Z]+/);
      const rowMatch = cellId.match(/[0-9]+$/);
      if (!colMatch || !rowMatch) throw new Error('Invalid reference');
      const colKey = colMatch[0];
      const rowIndex = Number(rowMatch[0]) - 1;
      const colIndex = columnKeys.indexOf(colKey);
      if (rowIndex < 0 || rowIndex >= rawMatrix.length || colIndex < 0 || colIndex >= columnKeys.length) {
        throw new Error('Invalid reference');
      }

      const raw = String(rawMatrix[rowIndex]?.[colIndex] ?? '');
      if (!raw.startsWith('=')) {
        return parseRawCellAsFormulaValue(raw);
      }

      stack.add(cellId);
      try {
        const evaluated = evaluateFormulaExpression(raw, (ref) => {
          const normalizedRef = normalizeRefToCellId(ref, cellId);
          if (!normalizedRef) throw new Error('Invalid reference');
          return evaluateCell(normalizedRef, stack);
        });
        valueMemo.set(cellId, evaluated);
        return evaluated;
      } finally {
        stack.delete(cellId);
      }
    };

    const result = rawMatrix.map((row, rowIndex) =>
      row.map((raw, colIndex) => {
        const cellId = cellIdFromPosition(rowIndex, columnKeys[colIndex]);
        const rawValue = String(raw ?? '');
        if (!rawValue.startsWith('=')) return rawValue;
        try {
          return formatFormulaValue(evaluateCell(cellId, new Set()));
        } catch {
          errorCells.add(cellId);
          return 'ERROR';
        }
      }),
    );

    return { matrix: result, formulas: formulaByCell, errors: errorCells, reverse: dependencyMaps.reverse };
  }, [cellIdFromPosition, columnKeys, normalizeFormulaForEngine, normalizeRefToCellId, rawMatrix]);

  React.useEffect(() => {
    computedErrorRef.current = computedMatrix.errors;
  }, [computedMatrix.errors]);

  const defaultColDef = React.useMemo<ColDef<GridRow>>(() => ({ editable: true, resizable: true, sortable: false, filter: false }), []);

  const sizeGridColumnsToFit = React.useCallback(() => {
    const api = gridApiRef.current;
    if (!api || !columnKeys.length) return;
    if (hasManualColumnResizeRef.current) return;
    const viewportWidth = gridRootRef.current?.clientWidth ?? 0;
    const minimumColumnsWidth = columnKeys.length * DATA_COLUMN_DEFAULT_WIDTH;
    if (viewportWidth > minimumColumnsWidth) {
      api.sizeColumnsToFit();
    }
  }, [columnKeys.length]);

  React.useEffect(() => {
    hasSizedColumnsRef.current = false;
    hasManualColumnResizeRef.current = false;
  }, [columnKeys.length]);

  const staticHeaderSet = React.useMemo(() => new Set((staticHeaders ?? []).map((header) => normalizeHeaderKey(header))), [staticHeaders]);

  const metadataHeaderSet = React.useMemo(() => new Set((metadataHeaders ?? []).map((header) => normalizeHeaderKey(header))), [metadataHeaders]);

  const resetSheet = React.useCallback(() => {
    const nextColumnCount = normalizedHeaders.length || DEFAULT_COLS;
    const nextColumnKeys = Array.from({ length: nextColumnCount }, (_, index) => getColumnLabel(index));

    setColumnKeys(nextColumnKeys);
    setColumnNames(() =>
      nextColumnKeys.reduce<Record<string, string>>((acc, key, index) => {
        acc[key] = formatGridHeaderName(normalizedHeaders[index] || key, key);
        return acc;
      }, {}),
    );
    setColumnCostSheetFlags(() =>
      nextColumnKeys.reduce<Record<string, boolean>>((acc, key, index) => {
        const headerLabel = formatGridHeaderName(normalizedHeaders[index] || key, key);
        const normalizedLabel = normalizeHeaderKey(headerLabel);
        const prefillFromApi = normalizedHeaderSettings.get(normalizedLabel);
        const inferredIsCostSheet = metadataHeaderSet.has(normalizedLabel) ? false : inferColumnTypeFromHeader(headerLabel) === 'NUMBER';
        acc[key] = prefillFromApi?.isShowIncostSheet ?? inferredIsCostSheet;
        return acc;
      }, {}),
    );
    setColumnConfigs(() =>
      nextColumnKeys.reduce<Record<string, ColumnConfigState>>((acc, key, index) => {
        const headerLabel = formatGridHeaderName(normalizedHeaders[index] || key, key);
        const normalizedLabel = normalizeHeaderKey(headerLabel);
        const prefillFromApi = normalizedHeaderSettings.get(normalizedLabel);
        const inferredColumnType = inferColumnTypeFromHeader(headerLabel);
        const isCostSheet = prefillFromApi?.isShowIncostSheet ?? (metadataHeaderSet.has(normalizedLabel) ? false : inferredColumnType === 'NUMBER');
        acc[key] = {
          columnType: prefillFromApi?.columnType ?? inferredColumnType,
          isCostEditable: prefillFromApi?.isExcelEditable ?? prefillFromApi?.isCostEditable ?? true,
          referenceColumn: prefillFromApi?.referenceColumn ?? 'AGREEMENT_VALUE',
          position: prefillFromApi?.position ?? 'AFTER',
          isCostSheet,
          orderIndex: index + 1,
        };
        return acc;
      }, {}),
    );
    const resetColumnFormulaMap = nextColumnKeys.reduce<Record<string, string>>((acc, key, index) => {
      const headerLabel = formatGridHeaderName(normalizedHeaders[index] || key, key);
      const normalizedLabel = normalizeHeaderKey(headerLabel);
      const prefillFromApi = normalizedHeaderSettings.get(normalizedLabel);
      const formula = String(prefillFromApi?.excelFormula ?? '').trim();
      if (formula.startsWith('=')) {
        acc[key] = normalizeApiColumnFormula(
          formula,
          nextColumnKeys,
          nextColumnKeys.reduce<Record<string, string>>((nameAcc, colKey, colIndex) => {
            nameAcc[colKey] = formatGridHeaderName(normalizedHeaders[colIndex] || colKey, colKey);
            return nameAcc;
          }, {}),
        );
      }
      return acc;
    }, {});
    setColumnFormulaByKey(resetColumnFormulaMap);
    setUserCreatedColumnFlags(() =>
      nextColumnKeys.reduce<Record<string, boolean>>((acc, key) => {
        acc[key] = false;
        return acc;
      }, {}),
    );
    setRawMatrix(
      Array.from({ length: DEFAULT_ROWS }, () => {
        const row = Array.from({ length: nextColumnCount }, () => '');
        Object.entries(resetColumnFormulaMap).forEach(([formulaColKey, formulaValue]) => {
          const formulaColIndex = nextColumnKeys.indexOf(formulaColKey);
          if (formulaColIndex < 0) return;
          const isSelfReferencingFormula = new RegExp(`\\b${escapeRegex(formulaColKey)}\\b`, 'i').test(formulaValue);
          if (isSelfReferencingFormula) return;
          row[formulaColIndex] = formulaValue;
        });
        return row;
      }),
    );
    undoPastRef.current = [];
    undoFutureRef.current = [];
    setSelectedCell(null);
    setSelectedRange(null);
    setSelectedColumnKey(null);
    setSelectedRowIndex(null);
    setIsAllGridSelected(false);
    setGridSelection({ mode: 'none', rangeSize: 0, addressLabel: '' });
    setFormulaInput('');
    setPanelSuggestions([]);
    setPanelActiveIndex(0);
    setColumnSettingsState((prev) => ({ ...prev, open: false }));
    setIsFormulaPanelOpen(false);
    hasSizedColumnsRef.current = false;
    hasManualColumnResizeRef.current = false;
    requestAnimationFrame(() => {
      sizeGridColumnsToFit();
    });
  }, [inferColumnTypeFromHeader, metadataHeaderSet, normalizedHeaderSettings, normalizedHeaders, sizeGridColumnsToFit]);

  const handleCellValueChanged = React.useCallback(
    (event: CellValueChangedEvent<GridRow>) => {
      const rowIndex = event.rowIndex;
      const colKey = event.colDef.field;
      if (rowIndex === null || rowIndex === undefined || rowIndex < 0 || !colKey || colKey === ADD_COLUMN_FIELD) {
        return;
      }
      const colIndex = columnKeys.indexOf(colKey);
      if (colIndex < 0 || rowIndex >= rawMatrix.length) return;
      if (columnFormulaByKey[colKey]) {
        toast.error('This column is formula-driven. Update the formula from Formula Builder.');
        event.node.setDataValue(colKey, event.oldValue ?? '');
        return;
      }
      const activeColumnConfig = columnConfigs[colKey];
      const incomingRaw = String(event.newValue ?? '');
      const incomingTrimmed = incomingRaw.trim();
      if (activeColumnConfig?.columnType === 'NUMBER' && incomingTrimmed && !incomingTrimmed.startsWith('=')) {
        const parsedNumber = Number(incomingTrimmed);
        if (!Number.isFinite(parsedNumber)) {
          toast.error('Only numeric values are allowed for Number type columns.');
          event.node.setDataValue(colKey, event.oldValue ?? '');
          return;
        }
      }
      setRawMatrixWithHistory((prev) => {
        const next = prev.map((row) => [...row]);
        const incoming = incomingRaw;
        next[rowIndex][colIndex] = incoming.startsWith('=') ? normalizeFormulaForEngine(incoming) : incoming;
        return next;
      });
      setColumnFormulaByKey((prev) => {
        if (!prev[colKey]) return prev;
        const next = { ...prev };
        delete next[colKey];
        return next;
      });
      const changedCellId = cellIdFromPosition(rowIndex, colKey);
      collectDependents(changedCellId, computedMatrix.reverse);
    },
    [
      cellIdFromPosition,
      columnConfigs,
      columnFormulaByKey,
      columnKeys,
      computedMatrix.reverse,
      normalizeFormulaForEngine,
      rawMatrix.length,
      setRawMatrixWithHistory,
    ],
  );

  const { rowData, pinnedBottomRowData, deleteRowAtIndex, insertRowAtIndex, duplicateRowAtIndex, getColumnFormulaPreview } = useExcelRows({
    columnKeys,
    computedMatrix: computedMatrix.matrix,
    rawMatrix,
    columnFormulaByKey,
    setRawMatrix: setRawMatrixWithHistory,
    setRowIds,
    setSelectedCell,
    setSelectedColumnKey,
    setFormulaInput,
    setIsAllGridSelected,
  });

  const { insertColumnAtIndex, duplicateColumnAtIndex, deleteColumnAtIndex } = useExcelColumns({
    columnKeys,
    columnNames,
    columnFormulaByKey,
    setColumnKeys,
    setColumnNames,
    setColumnCostSheetFlags,
    setColumnConfigs,
    setUserCreatedColumnFlags,
    setRawMatrix: setRawMatrixWithHistory,
    setColumnFormulaByKey,
    setSelectedCell,
    setSelectedColumnKey,
    setFormulaInput,
    setIsAllGridSelected,
  });

  const resolveAgreementColumnIndex = React.useCallback(() => {
    return columnKeys.findIndex((key) => isAgreementValueHeader(columnNames[key] ?? key));
  }, [columnKeys, columnNames]);

  const hasDuplicateColumnName = React.useCallback(
    (name: string, excludeKey?: string) => {
      const normalizedIncoming = normalizeHeaderKey(name);
      if (!normalizedIncoming) return false;
      return columnKeys.some((key) => {
        if (excludeKey && key === excludeKey) return false;
        return normalizeHeaderKey(columnNames[key] ?? key) === normalizedIncoming;
      });
    },
    [columnKeys, columnNames],
  );

  const openColumnSettingsPopover = React.useCallback(
    (colKey: string) => {
      if (!userCreatedColumnFlags[colKey]) {
        return;
      }
      const domHeaderCell = document.querySelector(`.ag-header-cell[col-id="${colKey}"]`) as HTMLElement | null;
      const bounds = domHeaderCell?.getBoundingClientRect();
      const normalizedHeader = normalizeHeaderKey(columnNames[colKey] ?? colKey);
      const isStaticHeader = staticHeaderSet.has(normalizedHeader);
      const isMetadataHeader = metadataHeaderSet.has(normalizedHeader);
      const canEditName = !isStaticHeader && !isMetadataHeader;

      setColumnSettingsState({
        open: true,
        colKey,
        value: columnNames[colKey] ?? colKey,
        isShowIncostSheet: columnCostSheetFlags[colKey] ?? true,
        columnType: columnConfigs[colKey]?.columnType ?? 'STRING',
        position: columnConfigs[colKey]?.position ?? 'AFTER',
        referenceColumn: 'AGREEMENT_VALUE',
        isCostEditable: columnConfigs[colKey]?.isCostEditable ?? true,
        canEditName,
        isStaticHeader,
        isCreateMode: true,
        pendingInsertIndex: -1,
        editNameMessage: canEditName ? '' : 'Only newly added columns are editable.',
        anchorLeft: bounds ? Math.max(8, Math.min(bounds.left + 6, window.innerWidth - 360)) : 16,
        anchorTop: bounds ? Math.min(bounds.bottom + 6, window.innerHeight - 300) : 64,
      });
    },
    [columnConfigs, columnCostSheetFlags, columnNames, metadataHeaderSet, staticHeaderSet, userCreatedColumnFlags],
  );

  const formulaColumnKeys = React.useMemo(() => {
    return new Set(
      columnKeys.filter(
        (_, colIndex) => Boolean(columnFormulaByKey[columnKeys[colIndex]]) || rawMatrix.some((row) => String(row[colIndex] ?? '').startsWith('=')),
      ),
    );
  }, [columnFormulaByKey, columnKeys, rawMatrix]);

  const lockedColumnKeys = React.useMemo(
    () => new Set(columnKeys.filter((colKey) => columnConfigs[colKey]?.isCostEditable === false)),
    [columnConfigs, columnKeys],
  );

  const getColumnFormulaDisplayPreview = React.useCallback(
    (colKey: string) => formatFormulaForDisplay(columnFormulaByKey[colKey] ?? getColumnFormulaPreview(colKey)),
    [columnFormulaByKey, formatFormulaForDisplay, getColumnFormulaPreview],
  );

  const formulaCircularReferenceError = React.useMemo(() => {
    if (!selectedColumnKey || selectedCell) {
      return null;
    }
    const trimmed = formulaInput.trim();
    if (!trimmed.startsWith('=')) {
      return null;
    }
    const nextFormula = normalizeFormulaForEngine(trimmed);
    return detectCircularReferenceForColumnApply({
      columnKeys,
      rawMatrix,
      columnFormulaByKey,
      targetColKey: selectedColumnKey,
      proposedFormula: nextFormula,
      normalizeRefToCellId,
      getColumnLabel: (colKey) => columnNames[colKey] ?? colKey,
    });
  }, [
    columnFormulaByKey,
    columnKeys,
    columnNames,
    formulaInput,
    normalizeFormulaForEngine,
    normalizeRefToCellId,
    rawMatrix,
    selectedCell,
    selectedColumnKey,
  ]);

  const openFormulaBuilderForColumn = React.useCallback(
    (colKey: string) => {
      if (!columnKeys.includes(colKey)) return;

      setIsAllGridSelected(false);
      setSelectedRowIndex(null);
      setSelectedColumnKey(colKey);
      setSelectedCell(null);
      setSelectedRange(
        rawMatrix.length
          ? {
              anchor: { rowIndex: 0, colKey },
              focus: { rowIndex: rawMatrix.length - 1, colKey },
            }
          : null,
      );
      setGridSelection({
        mode: 'column',
        rangeSize: rawMatrix.length,
        addressLabel: rawMatrix.length ? `${colKey}1:${colKey}${rawMatrix.length}` : `${colKey}1`,
      });

      const previewFormula = getColumnFormulaDisplayPreview(colKey);
      const nextValue = previewFormula.trim() ? previewFormula : '=';
      setFormulaInput(nextValue);
      setIsFormulaPanelOpen(true);

      requestAnimationFrame(() => {
        const input = formulaPanelInputRef.current;
        input?.focus();
        input?.setSelectionRange(nextValue.length, nextValue.length);
        updatePanelSuggestions(nextValue, nextValue.length);
      });
    },
    [columnKeys, getColumnFormulaDisplayPreview, rawMatrix.length, updatePanelSuggestions],
  );

  const { columnDefs, openCreateColumnPopover } = useExcelGridColumns({
    columnKeys,
    columnNames,
    formulaColumnKeys,
    lockedColumnKeys,
    getColumnFormulaPreview: getColumnFormulaDisplayPreview,
    userCreatedColumnFlags,
    setColumnSettingsState,
    insertRowAtIndex,
    duplicateRowAtIndex,
    deleteRowAtIndex,
    insertColumnAtIndex: (index) => insertColumnAtIndex(index),
    duplicateColumnAtIndex,
    deleteColumnAtIndex,
    openColumnSettings: openColumnSettingsPopover,
    openFormulaBuilderForColumn,
    selectedColumnKeyRef,
    selectedRowIndexRef,
    selectedRangeRef,
    rawMatrixRef,
    computedErrorRef,
    searchMatchCellIdsRef,
    activeSearchMatchCellIdRef,
    cellIdFromPosition,
    markColumnActionClick: () => {
      skipNextHeaderSelectionRef.current = true;
    },
  });

  const buildTsvFromBounds = React.useCallback(
    (rowStartIndex: number, rowEndIndex: number, selectedColumns: string[]) => {
      const start = Math.max(0, Math.min(rowStartIndex, rowEndIndex));
      const end = Math.min(rawMatrix.length - 1, Math.max(rowStartIndex, rowEndIndex));
      if (start > end || !selectedColumns.length) return '';
      const colIndexes = selectedColumns.map((key) => columnKeys.indexOf(key)).filter((index) => index >= 0);
      if (!colIndexes.length) return '';

      const lines: string[] = [];
      for (let rowIndex = start; rowIndex <= end; rowIndex += 1) {
        lines.push(colIndexes.map((colIndex) => String(rawMatrix[rowIndex]?.[colIndex] ?? '')).join('\t'));
      }
      return lines.join('\n');
    },
    [columnKeys, rawMatrix],
  );

  const getColumnKeysBetween = React.useCallback(
    (startColKey: string, endColKey: string) => {
      const startIndex = columnKeys.indexOf(startColKey);
      const endIndex = columnKeys.indexOf(endColKey);
      if (startIndex < 0 || endIndex < 0) return [];
      const minIndex = Math.min(startIndex, endIndex);
      const maxIndex = Math.max(startIndex, endIndex);
      return columnKeys.slice(minIndex, maxIndex + 1);
    },
    [columnKeys],
  );

  const getSelectedRangeBounds = React.useCallback(
    (range: GridCellSelectionRange) => {
      const selectedColumns = getColumnKeysBetween(range.anchor.colKey, range.focus.colKey);
      if (!selectedColumns.length) return null;
      const rowStart = Math.min(range.anchor.rowIndex, range.focus.rowIndex);
      const rowEnd = Math.max(range.anchor.rowIndex, range.focus.rowIndex);
      return { rowStart, rowEnd, selectedColumns };
    },
    [getColumnKeysBetween],
  );

  const getAllGridAsTsv = React.useCallback(() => {
    return rawMatrix.map((row) => columnKeys.map((_, colIndex) => String(row[colIndex] ?? '')).join('\t')).join('\n');
  }, [columnKeys, rawMatrix]);

  const getSelectionAsTsv = React.useCallback(() => {
    if (isAllGridSelected) return getAllGridAsTsv();
    if (!selectedRange) {
      return selectedCell ? buildTsvFromBounds(selectedCell.rowIndex, selectedCell.rowIndex, [selectedCell.colKey]) : '';
    }
    const bounds = getSelectedRangeBounds(selectedRange);
    if (!bounds) return '';
    return buildTsvFromBounds(bounds.rowStart, bounds.rowEnd, bounds.selectedColumns);
  }, [buildTsvFromBounds, getAllGridAsTsv, getSelectedRangeBounds, isAllGridSelected, selectedCell, selectedRange]);

  const updateSelectionFromRange = React.useCallback(
    (range: GridCellSelectionRange) => {
      const bounds = getSelectedRangeBounds(range);
      if (!bounds) return;
      const rowCount = bounds.rowEnd - bounds.rowStart + 1;
      const colCount = bounds.selectedColumns.length;
      const rangeSize = rowCount * colCount;
      const coversAllRows = rowCount === rawMatrix.length && rawMatrix.length > 0;
      const isSingleCell = rowCount === 1 && colCount === 1;
      const firstColumnKey = bounds.selectedColumns[0];
      const lastColumnKey = bounds.selectedColumns[bounds.selectedColumns.length - 1];
      const addressLabel = isSingleCell
        ? `${firstColumnKey}${bounds.rowStart + 1}`
        : `${firstColumnKey}${bounds.rowStart + 1}:${lastColumnKey}${bounds.rowEnd + 1}`;
      const mode: SelectionMode = isSingleCell
        ? 'cell'
        : coversAllRows && colCount === 1
          ? 'column'
          : rowCount === 1 && colCount === columnKeys.length
            ? 'row'
            : 'range';

      setSelectedRange(range);
      setIsAllGridSelected(false);
      setSelectedRowIndex(null);
      setSelectedColumnKey(null);
      setSelectedCell(isSingleCell ? { rowIndex: bounds.rowStart, colKey: firstColumnKey } : null);
      if (isSingleCell) {
        const colIndex = columnKeys.indexOf(firstColumnKey);
        const raw = rawMatrix[bounds.rowStart]?.[colIndex] ?? '';
        setFormulaInput(String(raw).startsWith('=') ? formatFormulaForDisplay(String(raw)) : '');
      }
      setGridSelection({ mode, rangeSize, addressLabel });
    },
    [columnKeys, formatFormulaForDisplay, getSelectedRangeBounds, rawMatrix],
  );

  const activeSearchValue = React.useMemo(() => deferredSearchValue.trim(), [deferredSearchValue]);

  const searchableMatrix = React.useMemo(() => rawMatrix.map((row) => row.map((cell) => String(cell ?? '').toLowerCase())), [rawMatrix]);

  const searchMatches = React.useMemo<SearchMatch[]>(() => {
    const needle = activeSearchValue.toLowerCase();
    if (!needle) return [];
    const matches: SearchMatch[] = [];
    searchableMatrix.forEach((row, rowIndex) => {
      columnKeys.forEach((colKey, colIndex) => {
        const cellValue = row[colIndex] ?? '';
        if (cellValue.includes(needle)) {
          matches.push({ rowIndex, colIndex, colKey });
        }
      });
    });
    return matches;
  }, [activeSearchValue, columnKeys, searchableMatrix]);

  const focusSearchMatch = React.useCallback(
    (match?: SearchMatch, options?: { focusGrid?: boolean }) => {
      if (!match) return;
      setIsAllGridSelected(false);
      setSelectedRowIndex(null);
      setSelectedColumnKey(null);
      setSelectedCell({ rowIndex: match.rowIndex, colKey: match.colKey });
      setSelectedRange({ anchor: { rowIndex: match.rowIndex, colKey: match.colKey }, focus: { rowIndex: match.rowIndex, colKey: match.colKey } });
      setGridSelection({ mode: 'cell', rangeSize: 1, addressLabel: `${match.colKey}${match.rowIndex + 1}` });
      const raw = rawMatrix[match.rowIndex]?.[match.colIndex] ?? '';
      setFormulaInput(String(raw).startsWith('=') ? formatFormulaForDisplay(String(raw)) : '');
      requestAnimationFrame(() => {
        const api = gridApiRef.current;
        if (!api) return;
        api.ensureIndexVisible(match.rowIndex, 'middle');
        api.ensureColumnVisible(match.colKey);
        if (options?.focusGrid) {
          api.setFocusedCell(match.rowIndex, match.colKey);
        }
      });
    },
    [formatFormulaForDisplay, rawMatrix],
  );

  React.useEffect(() => {
    setActiveSearchMatchIndex(0);
  }, [searchValue]);

  React.useEffect(() => {
    if (!searchMatches.length) {
      setActiveSearchMatchIndex(0);
      return;
    }
    setActiveSearchMatchIndex((prev) => Math.min(prev, searchMatches.length - 1));
  }, [searchMatches.length]);

  React.useEffect(() => {
    searchMatchCellIdsRef.current = new Set(searchMatches.map((match) => cellIdFromPosition(match.rowIndex, match.colKey)));
    const activeMatch = searchMatches[activeSearchMatchIndex];
    activeSearchMatchCellIdRef.current = activeMatch ? cellIdFromPosition(activeMatch.rowIndex, activeMatch.colKey) : null;
    scheduleGridCellRefresh();
  }, [activeSearchMatchIndex, cellIdFromPosition, scheduleGridCellRefresh, searchMatches]);

  const replaceFirstMatch = React.useCallback(
    (value: string) => {
      if (!activeSearchValue) return value;
      const nextValue = value.replace(new RegExp(escapeRegex(activeSearchValue), 'i'), replaceValue);
      return nextValue.startsWith('=') ? normalizeFormulaForEngine(nextValue) : nextValue;
    },
    [activeSearchValue, normalizeFormulaForEngine, replaceValue],
  );

  const replaceEveryMatch = React.useCallback(
    (value: string) => {
      if (!activeSearchValue) return value;
      const nextValue = value.replace(new RegExp(escapeRegex(activeSearchValue), 'gi'), replaceValue);
      return nextValue.startsWith('=') ? normalizeFormulaForEngine(nextValue) : nextValue;
    },
    [activeSearchValue, normalizeFormulaForEngine, replaceValue],
  );

  const handleSearchChange = React.useCallback((value: string) => {
    setSearchValue(value);
    setActiveSearchMatchIndex(0);
  }, []);

  const openSearchPanel = React.useCallback(() => {
    setIsSearchPanelOpen(true);
  }, []);

  React.useEffect(() => {
    if (!isSearchPanelOpen) return;
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }, [isSearchPanelOpen]);

  React.useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'f') return;
      event.preventDefault();
      event.stopPropagation();
      openSearchPanel();
    };

    window.addEventListener('keydown', handleWindowKeyDown, true);
    return () => window.removeEventListener('keydown', handleWindowKeyDown, true);
  }, [openSearchPanel]);

  const handlePreviousSearchMatch = React.useCallback(() => {
    if (!searchMatches.length) return;
    const nextIndex = (activeSearchMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    setActiveSearchMatchIndex(nextIndex);
    focusSearchMatch(searchMatches[nextIndex], { focusGrid: true });
  }, [activeSearchMatchIndex, focusSearchMatch, searchMatches]);

  const handleNextSearchMatch = React.useCallback(() => {
    if (!searchMatches.length) return;
    const nextIndex = (activeSearchMatchIndex + 1) % searchMatches.length;
    setActiveSearchMatchIndex(nextIndex);
    focusSearchMatch(searchMatches[nextIndex], { focusGrid: true });
  }, [activeSearchMatchIndex, focusSearchMatch, searchMatches]);

  const handleSearchInputKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== 'Enter' || !searchMatches.length) return;
      event.preventDefault();
      const nextIndex = event.shiftKey
        ? (activeSearchMatchIndex - 1 + searchMatches.length) % searchMatches.length
        : (activeSearchMatchIndex + 1) % searchMatches.length;
      setActiveSearchMatchIndex(nextIndex);
      focusSearchMatch(searchMatches[nextIndex]);
      requestAnimationFrame(() => searchInputRef.current?.focus());
    },
    [activeSearchMatchIndex, focusSearchMatch, searchMatches],
  );

  const handleReplaceCurrent = React.useCallback(() => {
    const match = searchMatches[activeSearchMatchIndex];
    if (!match) {
      toast.error('No matching cell found.');
      return;
    }
    setRawMatrixWithHistory((prev) => {
      const next = prev.map((row) => [...row]);
      next[match.rowIndex][match.colIndex] = replaceFirstMatch(String(next[match.rowIndex]?.[match.colIndex] ?? ''));
      return next;
    });
  }, [activeSearchMatchIndex, replaceFirstMatch, searchMatches, setRawMatrixWithHistory]);

  const handleReplaceAll = React.useCallback(() => {
    if (!searchMatches.length) {
      toast.error('No matching cells found.');
      return;
    }
    const matcher = new RegExp(escapeRegex(activeSearchValue), 'gi');
    let replacementCount = 0;
    setRawMatrixWithHistory((prev) =>
      prev.map((row) =>
        row.map((cell) => {
          const value = String(cell ?? '');
          const matches = value.match(matcher);
          if (!matches?.length) return cell;
          replacementCount += matches.length;
          return replaceEveryMatch(value);
        }),
      ),
    );
    toast.success(`Replaced ${replacementCount} match${replacementCount === 1 ? '' : 'es'}.`);
  }, [activeSearchValue, replaceEveryMatch, searchMatches.length, setRawMatrixWithHistory]);

  const syncSelectionFromState = React.useCallback(() => {
    if (isAllGridSelected) {
      setGridSelection({
        mode: 'all',
        rangeSize: Math.max(0, rawMatrix.length * columnKeys.length),
        addressLabel: columnKeys.length && rawMatrix.length ? `${columnKeys[0]}1:${columnKeys[columnKeys.length - 1]}${rawMatrix.length}` : '',
      });
      return;
    }
    if (!selectedRange) {
      setGridSelection({
        mode: selectedCell ? 'cell' : 'none',
        rangeSize: selectedCell ? 1 : 0,
        addressLabel: selectedCell ? `${selectedCell.colKey}${selectedCell.rowIndex + 1}` : '',
      });
      return;
    }
    updateSelectionFromRange(selectedRange);
  }, [columnKeys, isAllGridSelected, rawMatrix.length, selectedCell, selectedRange, updateSelectionFromRange]);

  const selectEntireGridRange = React.useCallback(() => {
    if (!columnKeys.length || !rawMatrix.length) return;
    setSelectedRange({
      anchor: { rowIndex: 0, colKey: columnKeys[0] },
      focus: { rowIndex: rawMatrix.length - 1, colKey: columnKeys[columnKeys.length - 1] },
    });
    setIsAllGridSelected(true);
    setSelectedRowIndex(null);
    setSelectedColumnKey(null);
    setSelectedCell(null);
    setGridSelection({
      mode: 'all',
      rangeSize: Math.max(0, rawMatrix.length * columnKeys.length),
      addressLabel: columnKeys.length && rawMatrix.length ? `${columnKeys[0]}1:${columnKeys[columnKeys.length - 1]}${rawMatrix.length}` : '',
    });
  }, [columnKeys, rawMatrix.length]);

  const isSelectableCell = React.useCallback((rowIndex: number | null | undefined, colKey: string | undefined, row?: GridRow) => {
    return (
      rowIndex !== null &&
      rowIndex !== undefined &&
      rowIndex >= 0 &&
      row?.__isAddRow !== 'true' &&
      Boolean(colKey) &&
      colKey !== ADD_COLUMN_FIELD &&
      colKey !== ROW_ACTION_FIELD
    );
  }, []);

  const handleRangeSelectionStart = React.useCallback(
    (cell: GridCellPosition) => {
      rangeSelectionAnchorRef.current = cell;
      isSelectingRangeRef.current = true;
      updateSelectionFromRange({ anchor: cell, focus: cell });
    },
    [updateSelectionFromRange],
  );

  const handleRangeSelectionMove = React.useCallback(
    (cell: GridCellPosition) => {
      const anchor = rangeSelectionAnchorRef.current;
      if (!isSelectingRangeRef.current || !anchor) return;
      updateSelectionFromRange({ anchor, focus: cell });
    },
    [updateSelectionFromRange],
  );

  const copyTextToClipboard = React.useCallback((value: string) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(value).catch(() => {
        // no-op fallback: copy event handler still sets clipboard data
      });
    }
  }, []);

  const showLockedCellTooltip = React.useCallback((left: number, top: number, message: string) => {
    setCellLockTooltip({ left, top, message });
    if (cellLockTooltipTimerRef.current !== null) {
      window.clearTimeout(cellLockTooltipTimerRef.current);
    }
    cellLockTooltipTimerRef.current = window.setTimeout(() => {
      setCellLockTooltip(null);
      cellLockTooltipTimerRef.current = null;
    }, 1200);
  }, []);

  const getPasteStartCell = React.useCallback((): GridCellPosition => {
    if (isAllGridSelected && columnKeys[0]) {
      return { rowIndex: 0, colKey: columnKeys[0] };
    }
    if (selectedRange) {
      const bounds = getSelectedRangeBounds(selectedRange);
      if (bounds) {
        return { rowIndex: bounds.rowStart, colKey: bounds.selectedColumns[0] };
      }
    }
    if (selectedCell) {
      return selectedCell;
    }

    const focusedCell = gridApiRef.current?.getFocusedCell?.();
    const focusedColKey = typeof focusedCell?.column === 'string' ? focusedCell.column : (focusedCell?.column?.getColId?.() ?? columnKeys[0]);
    return { rowIndex: focusedCell?.rowIndex ?? 0, colKey: focusedColKey };
  }, [columnKeys, getSelectedRangeBounds, isAllGridSelected, selectedCell, selectedRange]);

  const applyPastedTsv = React.useCallback(
    (pasteText: string) => {
      const parsedRows = pasteText
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => line.split('\t'));
      if (!parsedRows.length) return;

      const startCell = getPasteStartCell();
      const startRow = Math.max(0, startCell.rowIndex);
      const startColIndex = Math.max(0, columnKeys.indexOf(startCell.colKey));
      if (startColIndex < 0) return;
      let invalidNumberCells = 0;
      let skippedFormulaColumnCells = 0;

      setRawMatrixWithHistory((prev) => {
        const requiredRows = startRow + parsedRows.length;
        const next = [...prev.map((row) => [...row])];
        while (next.length < requiredRows) {
          next.push(Array.from({ length: columnKeys.length }, () => ''));
        }
        parsedRows.forEach((cells, rowOffset) => {
          const targetRow = startRow + rowOffset;
          cells.forEach((cell, colOffset) => {
            const targetCol = startColIndex + colOffset;
            if (targetCol >= columnKeys.length) return;
            const targetColKey = columnKeys[targetCol];
            const activeColumnConfig = columnConfigs[targetColKey];
            if (columnFormulaByKey[targetColKey]) {
              skippedFormulaColumnCells += 1;
              return;
            }
            const incoming = String(cell ?? '');
            const incomingTrimmed = incoming.trim();

            if (activeColumnConfig?.columnType === 'NUMBER' && incomingTrimmed && !incomingTrimmed.startsWith('=')) {
              const parsedNumber = Number(incomingTrimmed);
              if (!Number.isFinite(parsedNumber)) {
                invalidNumberCells += 1;
                return;
              }
            }

            next[targetRow][targetCol] = incoming.startsWith('=') ? normalizeFormulaForEngine(incoming) : incoming;
          });
        });
        return next;
      });

      if (invalidNumberCells > 0) {
        toast.error(
          `${invalidNumberCells} pasted cell${invalidNumberCells === 1 ? '' : 's'} skipped: only numeric values are allowed in Number type columns.`,
        );
      }
      if (skippedFormulaColumnCells > 0) {
        toast.error(
          `${skippedFormulaColumnCells} pasted cell${skippedFormulaColumnCells === 1 ? '' : 's'} skipped: formula-driven columns cannot be overwritten.`,
        );
      }

      const pastedColumnCount = parsedRows.reduce((max, row) => Math.max(max, row.length), 0);
      const endRow = startRow + parsedRows.length - 1;
      const endColIndex = Math.min(columnKeys.length - 1, startColIndex + pastedColumnCount - 1);
      const focusColKey = columnKeys[endColIndex] ?? columnKeys[startColIndex];
      if (focusColKey) {
        updateSelectionFromRange({
          anchor: { rowIndex: startRow, colKey: columnKeys[startColIndex] },
          focus: { rowIndex: endRow, colKey: focusColKey },
        });
      }
    },
    [columnConfigs, columnFormulaByKey, columnKeys, getPasteStartCell, normalizeFormulaForEngine, setRawMatrixWithHistory, updateSelectionFromRange],
  );

  const handleGridKeyDown = React.useCallback(
    (event: CellKeyDownEvent<GridRow>) => {
      const keyboardEvent = event.event as KeyboardEvent | undefined;
      if (!keyboardEvent) return;
      if (ARROW_NAVIGATION_KEYS.has(keyboardEvent.key) && !(keyboardEvent.ctrlKey || keyboardEvent.metaKey || keyboardEvent.altKey)) {
        const rowIndex = event.rowIndex;
        const colKey = event.colDef.field;
        const colIndex = colKey ? columnKeys.indexOf(colKey) : -1;
        if (rowIndex === null || rowIndex === undefined || rowIndex < 0 || rowIndex >= rawMatrix.length || colIndex < 0) {
          return;
        }

        const rowDelta = keyboardEvent.key === 'ArrowDown' ? 1 : keyboardEvent.key === 'ArrowUp' ? -1 : 0;
        const colDelta = keyboardEvent.key === 'ArrowRight' ? 1 : keyboardEvent.key === 'ArrowLeft' ? -1 : 0;
        const nextRowIndex = Math.min(Math.max(rowIndex + rowDelta, 0), Math.max(rawMatrix.length - 1, 0));
        const nextColIndex = Math.min(Math.max(colIndex + colDelta, 0), columnKeys.length - 1);
        const nextColKey = columnKeys[nextColIndex];
        if (!nextColKey || (nextRowIndex === rowIndex && nextColIndex === colIndex)) return;

        keyboardEvent.preventDefault();
        keyboardEvent.stopPropagation();
        event.api.stopEditing();
        event.api.ensureIndexVisible(nextRowIndex);
        event.api.ensureColumnVisible(nextColKey);
        shouldSkipNextFocusedSyncRef.current = true;
        event.api.setFocusedCell(nextRowIndex, nextColKey);
        setIsAllGridSelected(false);
        setSelectedRowIndex(null);
        setSelectedColumnKey(null);
        setSelectedCell({ rowIndex: nextRowIndex, colKey: nextColKey });
        setSelectedRange({
          anchor: { rowIndex: nextRowIndex, colKey: nextColKey },
          focus: { rowIndex: nextRowIndex, colKey: nextColKey },
        });
        setGridSelection({ mode: 'cell', rangeSize: 1, addressLabel: `${nextColKey}${nextRowIndex + 1}` });
        const raw = rawMatrix[nextRowIndex]?.[nextColIndex] ?? '';
        setFormulaInput(String(raw).startsWith('=') ? formatFormulaForDisplay(String(raw)) : '');
        return;
      }
      if (
        keyboardEvent.key === 'Delete' &&
        event.rowIndex !== null &&
        event.rowIndex !== undefined &&
        event.rowIndex >= 0 &&
        event.colDef.field !== ADD_COLUMN_FIELD
      ) {
        keyboardEvent.preventDefault();
        deleteRowAtIndex(event.rowIndex);
        return;
      }
      if (keyboardEvent.key === ' ' && keyboardEvent.shiftKey) {
        keyboardEvent.preventDefault();
        keyboardEvent.stopPropagation();
        const rowIndex = event.rowIndex;
        if (rowIndex === null || rowIndex === undefined || rowIndex < 0) return;
        setIsAllGridSelected(false);
        setSelectedRowIndex(rowIndex);
        setSelectedColumnKey(null);
        setSelectedCell(null);
        if (columnKeys.length) {
          setSelectedRange({
            anchor: { rowIndex, colKey: columnKeys[0] },
            focus: { rowIndex, colKey: columnKeys[columnKeys.length - 1] },
          });
        }
        setGridSelection({
          mode: 'row',
          rangeSize: columnKeys.length,
          addressLabel: columnKeys.length ? `${columnKeys[0]}${rowIndex + 1}:${columnKeys[columnKeys.length - 1]}${rowIndex + 1}` : '',
        });
        return;
      }
      if (keyboardEvent.key === ' ') {
        if (!(keyboardEvent.ctrlKey || keyboardEvent.metaKey)) return;
        keyboardEvent.preventDefault();
        keyboardEvent.stopPropagation();
        const colKey = event.colDef.field;
        if (!colKey || colKey === ADD_COLUMN_FIELD || colKey === ROW_ACTION_FIELD) return;
        setIsAllGridSelected(false);
        setSelectedRowIndex(null);
        setSelectedColumnKey(colKey);
        setSelectedCell(null);
        setSelectedRange(
          rawMatrix.length
            ? {
                anchor: { rowIndex: 0, colKey },
                focus: { rowIndex: rawMatrix.length - 1, colKey },
              }
            : null,
        );
        setGridSelection({
          mode: 'column',
          rangeSize: rawMatrix.length,
          addressLabel: rawMatrix.length ? `${colKey}1:${colKey}${rawMatrix.length}` : `${colKey}1`,
        });
        return;
      }
      if (!(keyboardEvent.ctrlKey || keyboardEvent.metaKey)) return;
      const key = keyboardEvent.key.toLowerCase();
      if (key === 'f') {
        keyboardEvent.preventDefault();
        keyboardEvent.stopPropagation();
        openSearchPanel();
        return;
      }
      if (key === 'z' && !keyboardEvent.shiftKey) {
        keyboardEvent.preventDefault();
        keyboardEvent.stopPropagation();
        handleUndo();
        return;
      }
      if (key === 'y' || (key === 'z' && keyboardEvent.shiftKey)) {
        keyboardEvent.preventDefault();
        keyboardEvent.stopPropagation();
        handleRedo();
        return;
      }
      if (key === 'a') {
        keyboardEvent.preventDefault();
        keyboardEvent.stopPropagation();
        selectEntireGridRange();
      }
      if (key === 'c') {
        const tsv = getSelectionAsTsv();
        if (!tsv) return;
        copyTextToClipboard(tsv);
      }
    },
    [
      columnKeys,
      copyTextToClipboard,
      deleteRowAtIndex,
      formatFormulaForDisplay,
      getSelectionAsTsv,
      handleRedo,
      handleUndo,
      openSearchPanel,
      rawMatrix,
      selectEntireGridRange,
    ],
  );

  const downloadInventorySheetCsv = React.useCallback(() => {
    const escapeCsvCell = (value: unknown) => {
      const text = String(value ?? '');
      return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

    const headers = columnKeys.map((key) => columnNames[key] ?? key);
    const rowsToDownload = rawMatrix.filter((row) => row.some((value) => sanitizeString(value)));
    const dataRows = rowsToDownload.length ? rowsToDownload : rawMatrix;
    const csvContent = [headers, ...dataRows.map((row) => columnKeys.map((_, colIndex) => row[colIndex] ?? ''))]
      .map((row) => row.map(escapeCsvCell).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.href = url;
    link.download = `inventory-sheet-${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [columnKeys, columnNames, rawMatrix]);

  const handleSave = React.useCallback(async () => {
    setIsSubmittingImport(true);
    try {
      const sheetHeaders = columnKeys.map((key) => columnNames[key] ?? key);
      const nextColumnSettings = columnKeys.reduce<Record<string, ColumnSetting>>((acc, key) => {
        const name = columnNames[key] ?? key;
        const config = columnConfigs[key];
        acc[name] = {
          displayName: name,
          columnType: config?.columnType,
          isShowIncostSheet: columnCostSheetFlags[key],
          isCostEditable: config?.isCostEditable,
          position: config?.position,
          referenceColumn: config?.referenceColumn,
          excelFormula: columnFormulaByKey[key],
          isStaticHeader: staticHeaderSet.has(normalizeHeaderKey(name)),
        };
        return acc;
      }, {});
      await onSave?.({
        matrix: rawMatrix,
        headers: sheetHeaders,
        columnSettings: nextColumnSettings,
      });
      downloadInventorySheetCsv();
      toast.success('Sheet saved.');
    } catch {
      toast.error('Could not save the sheet.');
    } finally {
      setIsSubmittingImport(false);
    }
  }, [
    columnConfigs,
    columnCostSheetFlags,
    columnFormulaByKey,
    columnKeys,
    columnNames,
    downloadInventorySheetCsv,
    onSave,
    rawMatrix,
    staticHeaderSet,
  ]);

  return (
    <div className='flex h-screen min-h-0 w-full flex-col gap-4 bg-white p-4'>
      <ToastViewport />
      <div className='flex items-center justify-between gap-3'>
        <div className='flex items-center'>
          {onBack ? (
            <Button className='hover:bg-transparent px-0' onClick={onBack} variant='tertiary' size='small' data-testid='cancel-inventory-sheet-button'>
              <ArrowLeft className='mr-3 text-blue-500' />
            </Button>
          ) : null}
          <h2 className='text-xl font-bold text-black' data-testid='inventory-sheet-title'>
            {title}
          </h2>
        </div>
        <Button
          type='button'
          size='medium'
          icon
          disabled={isSubmittingImport}
          onClick={handleSave}
          className='inline-flex h-9 flex-row flex-nowrap items-center justify-center gap-2 whitespace-nowrap bg-blue-600 px-4 text-white hover:bg-blue-700'
        >
          <Download className='h-4 w-4 shrink-0' aria-hidden />
          <span className='leading-none'>{isSubmittingImport ? 'Saving...' : 'Save & Download'}</span>
        </Button>
      </div>

      <section
        className={`inventory-excel-grid relative flex min-h-0 flex-1 w-full flex-col overflow-hidden rounded-xl border border-[#D9E1EF] bg-gradient-to-b from-[#FBFDFF] to-white shadow-[0_12px_28px_rgba(15,23,42,0.08)] ${columnSettingsState.open ? 'is-column-popover-open' : ''}`}
      >
        <InventoryExcelStyles />
        <InventoryExcelToolbar
          isFormulaPanelOpen={isFormulaPanelOpen}
          isSearchPanelOpen={isSearchPanelOpen}
          searchValue={searchValue}
          replaceValue={replaceValue}
          searchInputRef={searchInputRef}
          searchMatchCount={searchMatches.length}
          activeSearchMatchIndex={activeSearchMatchIndex}
          onReset={() => setIsResetDialogOpen(true)}
          onToggleFormulas={handleToggleFormulaPanel}
          onToggleSearchPanel={() => {
            setIsSearchPanelOpen((prev) => {
              const next = !prev;
              return next;
            });
          }}
          onSearchChange={handleSearchChange}
          onSearchKeyDown={handleSearchInputKeyDown}
          onReplaceChange={setReplaceValue}
          onPreviousMatch={handlePreviousSearchMatch}
          onNextMatch={handleNextSearchMatch}
          onReplaceCurrent={handleReplaceCurrent}
          onReplaceAll={handleReplaceAll}
        />

        <div
          className='relative grid min-h-0 flex-1 px-4 pb-4 transition-[grid-template-columns,gap] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]'
          style={{
            gridTemplateColumns: isFormulaPanelOpen ? 'minmax(0, 1fr) 380px' : 'minmax(0, 1fr) 0px',
            gap: isFormulaPanelOpen ? '0.75rem' : '0rem',
          }}
        >
          <div
            ref={gridRootRef}
            className='ag-theme-alpine h-full min-h-0 min-w-0 flex-1 bg-white'
            tabIndex={0}
            onMouseUpCapture={(event) => {
              if (isElementInsideActionMenu(event.target)) return;
              isSelectingRangeRef.current = false;
              rangeSelectionAnchorRef.current = null;
              syncSelectionFromState();
            }}
            onMouseLeave={() => {
              isSelectingRangeRef.current = false;
              rangeSelectionAnchorRef.current = null;
            }}
            onKeyUpCapture={(event) => {
              if (isElementInsideActionMenu(event.target)) return;
              syncSelectionFromState();
            }}
            onCopyCapture={(event) => {
              const tsv = getSelectionAsTsv();
              if (!tsv) return;
              event.preventDefault();
              event.clipboardData?.setData('text/plain', tsv);
            }}
            onPasteCapture={(event) => {
              const pasted = event.clipboardData?.getData('text/plain');
              if (!pasted) return;
              event.preventDefault();
              console.debug('[InventoryGrid] onPasteCapture', {
                chars: pasted.length,
                lines: pasted.split(/\r\n|\r|\n/).length,
              });
              applyPastedTsv(pasted);
            }}
          >
            <button
              type='button'
              className='inventory-add-column-fixed-rail'
              onClick={(event) => {
                event.stopPropagation();
                openCreateColumnPopover(event.currentTarget);
              }}
              aria-label='Add a new column'
              title='Add column'
            >
              <span className='inventory-add-column-fixed-label'>+ Add Column</span>
            </button>
            <AgGridReact<GridRow>
              rowData={rowData}
              pinnedBottomRowData={pinnedBottomRowData}
              getRowId={(params) => (params.data?.__isAddRow === 'true' ? '__add_row__' : String(params.data?.__rowIndex ?? ''))}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              onGridReady={(event: GridReadyEvent<GridRow>) => {
                gridApiRef.current = event.api;
                requestAnimationFrame(() => {
                  if (hasSizedColumnsRef.current) return;
                  sizeGridColumnsToFit();
                  hasSizedColumnsRef.current = true;
                });
              }}
              onGridSizeChanged={() => {
                // Keep user-resized widths stable; avoid repeated auto-fit on container changes.
              }}
              stopEditingWhenCellsLoseFocus
              singleClickEdit
              rowHeight={30}
              headerHeight={34}
              enterNavigatesVertically
              enterNavigatesVerticallyAfterEdit
              tabToNextCell={(params) => params.nextCellPosition ?? false}
              onCellKeyDown={handleGridKeyDown}
              onCellValueChanged={handleCellValueChanged}
              onCellMouseDown={(event) => {
                if (isElementInsideActionMenu(event.event?.target ?? null)) return;
                const mouseEvent = event.event as MouseEvent | undefined;
                if (mouseEvent && mouseEvent.button !== 0) return;
                const colKey = event.colDef.field;
                if (!isSelectableCell(event.rowIndex, colKey, event.data)) return;
                handleRangeSelectionStart({ rowIndex: event.rowIndex as number, colKey: colKey as string });
              }}
              onCellMouseOver={(event) => {
                if (isElementInsideActionMenu(event.event?.target ?? null)) return;
                const colKey = event.colDef.field;
                if (!isSelectableCell(event.rowIndex, colKey, event.data)) return;
                handleRangeSelectionMove({ rowIndex: event.rowIndex as number, colKey: colKey as string });
              }}
              onCellClicked={(event) => {
                if (event.colDef.field === ROW_ACTION_FIELD && isElementInsideActionMenu(event.event?.target ?? null)) {
                  return;
                }
                setIsAllGridSelected(false);
                setSelectedRowIndex(null);
                setSelectedColumnKey(null);
                if (event.data?.__isAddRow === 'true' && event.colDef.field !== ROW_ACTION_FIELD && event.colDef.field !== ADD_COLUMN_FIELD) {
                  insertRowAtIndex(rawMatrix.length);
                  return;
                }
                if (event.colDef.field === ROW_ACTION_FIELD && event.rowIndex !== null && event.rowIndex !== undefined && event.rowIndex >= 0) {
                  const targetRowIndex = event.rowIndex;
                  setSelectedRowIndex(targetRowIndex);
                  setSelectedCell(null);
                  if (columnKeys.length) {
                    setSelectedRange({
                      anchor: { rowIndex: targetRowIndex, colKey: columnKeys[0] },
                      focus: { rowIndex: targetRowIndex, colKey: columnKeys[columnKeys.length - 1] },
                    });
                  }
                  setGridSelection({
                    mode: 'row',
                    rangeSize: columnKeys.length,
                    addressLabel: columnKeys.length
                      ? `${columnKeys[0]}${targetRowIndex + 1}:${columnKeys[columnKeys.length - 1]}${targetRowIndex + 1}`
                      : '',
                  });
                }
                const clickedColKey = event.colDef.field;
                if (!clickedColKey || clickedColKey === ADD_COLUMN_FIELD || clickedColKey === ROW_ACTION_FIELD) return;
                const clickEvent = event.event as MouseEvent | undefined;
                if (columnFormulaByKey[clickedColKey]) {
                  showLockedCellTooltip(
                    clickEvent?.clientX ?? 20,
                    clickEvent?.clientY ?? 20,
                    "This is a system-calculated column. You can't change its value directly. Update the formula from Formula Builder.",
                  );
                  return;
                }
                if (columnConfigs[clickedColKey]?.isCostEditable === false) {
                  showLockedCellTooltip(
                    clickEvent?.clientX ?? 20,
                    clickEvent?.clientY ?? 20,
                    "This column is locked. You don't have permission to edit its value.",
                  );
                }
              }}
              onCellFocused={(event: CellFocusedEvent<GridRow>) => {
                const rowIndex = event.rowIndex;
                const colKey = typeof event.column === 'string' ? event.column : event.column?.getColId();
                if (
                  rowIndex === null ||
                  rowIndex === undefined ||
                  rowIndex < 0 ||
                  !colKey ||
                  colKey === ADD_COLUMN_FIELD ||
                  colKey === ROW_ACTION_FIELD
                ) {
                  return;
                }

                // Defer sync so AG Grid can enter single-click edit mode first.
                window.setTimeout(() => {
                  const activeRange = selectedRangeRef.current;
                  const activeBounds = activeRange ? getSelectedRangeBounds(activeRange) : null;
                  if (activeBounds && (activeBounds.rowEnd > activeBounds.rowStart || activeBounds.selectedColumns.length > 1)) {
                    return;
                  }
                  if (shouldSkipNextFocusedSyncRef.current) {
                    shouldSkipNextFocusedSyncRef.current = false;
                    return;
                  }
                  const isEditingCurrentCell = event.api
                    .getEditingCells()
                    .some((cell) => cell.rowIndex === rowIndex && cell.column?.getColId() === colKey);
                  if (isEditingCurrentCell) {
                    return;
                  }

                  setSelectedRowIndex(null);
                  setSelectedColumnKey(null);
                  setSelectedCell({ rowIndex, colKey });
                  setSelectedRange({ anchor: { rowIndex, colKey }, focus: { rowIndex, colKey } });
                  setIsAllGridSelected(false);
                  setGridSelection({ mode: 'cell', rangeSize: 1, addressLabel: `${colKey}${rowIndex + 1}` });
                  const colIndex = columnKeys.indexOf(colKey);
                  if (colIndex < 0) return;
                  const raw = rawMatrix[rowIndex]?.[colIndex] ?? '';
                  setFormulaInput(String(raw).startsWith('=') ? formatFormulaForDisplay(String(raw)) : '');
                }, 0);
              }}
              onColumnHeaderClicked={(event) => {
                if (skipNextHeaderSelectionRef.current) {
                  skipNextHeaderSelectionRef.current = false;
                  return;
                }
                const colKey = 'getColId' in event.column ? event.column.getColId() : '';
                if (colKey === ADD_COLUMN_FIELD || colKey === ROW_ACTION_FIELD) return;
                const now = Date.now();
                const isDoubleClick = lastHeaderClickRef.current.colKey === colKey && now - lastHeaderClickRef.current.timestamp <= 320;
                lastHeaderClickRef.current = { colKey, timestamp: now };

                if (isDoubleClick) return;
                setIsAllGridSelected(false);
                setSelectedRowIndex(null);
                setSelectedColumnKey(colKey);
                setSelectedCell(null);
                setSelectedRange(
                  rawMatrix.length
                    ? {
                        anchor: { rowIndex: 0, colKey },
                        focus: { rowIndex: rawMatrix.length - 1, colKey },
                      }
                    : null,
                );
                setGridSelection({
                  mode: 'column',
                  rangeSize: rawMatrix.length,
                  addressLabel: rawMatrix.length ? `${colKey}1:${colKey}${rawMatrix.length}` : `${colKey}1`,
                });
                setFormulaInput(getColumnFormulaDisplayPreview(colKey));
              }}
              onColumnResized={(event: ColumnResizedEvent<GridRow>) => {
                if (String(event.source).startsWith('ui')) {
                  hasManualColumnResizeRef.current = true;
                }
              }}
            />
          </div>
          {gridSelection.mode !== 'none' ? (
            <div
              className={`pointer-events-none absolute bottom-3 z-30 rounded-md border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 py-1 text-[11px] font-medium text-[#1E40AF] shadow-sm transition-[right] duration-300 ease-out ${isFormulaPanelOpen ? 'right-[calc(380px+0.75rem)]' : 'right-3'}`}
            >
              {gridSelection.mode === 'all'
                ? 'All cells selected (Ctrl+C to copy)'
                : `${gridSelection.mode === 'column' ? 'Column' : gridSelection.mode === 'row' ? 'Row' : gridSelection.mode === 'range' ? 'Range' : 'Cell'} selected (${gridSelection.rangeSize} cell${gridSelection.rangeSize === 1 ? '' : 's'})`}
            </div>
          ) : null}
          {cellLockTooltip ? (
            <div
              className='pointer-events-none fixed z-[150] max-w-[320px] -translate-x-1/2 -translate-y-full rounded-md bg-[#1E3A8A] px-3 py-2 text-xs font-medium text-white shadow-lg'
              style={{ left: `${cellLockTooltip.left}px`, top: `${Math.max(8, cellLockTooltip.top - 10)}px` }}
              role='status'
              aria-live='polite'
            >
              {cellLockTooltip.message}
            </div>
          ) : null}

          <FormulaBuilderPanel
            isOpen={isFormulaPanelOpen}
            selectedCell={selectedCell}
            selectedColumnKey={selectedColumnKey}
            selectedCellLabel={selectedCell ? (columnNames[selectedCell.colKey] ?? selectedCell.colKey) : null}
            selectedColumnLabel={selectedColumnKey ? (columnNames[selectedColumnKey] ?? selectedColumnKey) : null}
            quickTemplateColumns={quickTemplateColumnLabels}
            formulaInput={formulaInput}
            formulaPanelInputRef={formulaPanelInputRef}
            panelSuggestions={panelSuggestions}
            panelActiveIndex={panelActiveIndex}
            onFormulaInputChange={(value, cursor) => {
              setFormulaInput(value);
              updatePanelSuggestions(value, cursor);
            }}
            onFormulaInputFocus={handleFormulaInputFocus}
            onFormulaInputClick={handleFormulaInputClick}
            onFormulaInputKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                if (panelSuggestions.length && (hasNavigatedPanelSuggestionsRef.current || panelSuggestions.length === 1)) {
                  event.preventDefault();
                  applyPanelSuggestion(panelSuggestions[panelActiveIndex]);
                  hasNavigatedPanelSuggestionsRef.current = false;
                  return;
                }
                if (panelSuggestions.length) {
                  event.preventDefault();
                  setPanelSuggestions([]);
                  setPanelActiveIndex(0);
                  hasNavigatedPanelSuggestionsRef.current = false;
                }
                return;
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                setPanelSuggestions([]);
                setPanelActiveIndex(0);
                hasNavigatedPanelSuggestionsRef.current = false;
                return;
              }
              if (!panelSuggestions.length) return;
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                hasNavigatedPanelSuggestionsRef.current = true;
                setPanelActiveIndex((prev) => (prev + 1) % panelSuggestions.length);
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                hasNavigatedPanelSuggestionsRef.current = true;
                setPanelActiveIndex((prev) => (prev - 1 + panelSuggestions.length) % panelSuggestions.length);
              }
            }}
            onSuggestionMouseDown={(suggestion) => applyPanelSuggestion(suggestion)}
            formulaError={formulaCircularReferenceError}
            onApplyFormula={() => {
              if (selectedCell) {
                toast.error('Cell-level formula apply is disabled. Select a column header to apply formula.');
                return;
              }
              if (formulaCircularReferenceError) {
                toast.error(formulaCircularReferenceError);
                return;
              }
              const targetColKey = selectedColumnKey;
              if (!targetColKey) return;
              const colIndex = columnKeys.indexOf(targetColKey);
              if (colIndex < 0) return;
              const nextFormula = normalizeFormulaForEngine(formulaInput.startsWith('=') ? formulaInput : `=${formulaInput}`);
              const hasSelfColumnReference = new RegExp(`\\b${escapeRegex(targetColKey)}\\b`, 'i').test(nextFormula);
              setFormulaInput(formatFormulaForDisplay(nextFormula));
              setColumnFormulaByKey((prev) => ({ ...prev, [targetColKey]: nextFormula }));

              const evaluateAsValueTransform = (rowIndex: number): string => {
                const currentCellId = `${targetColKey}${rowIndex + 1}`;
                const value = evaluateFormulaExpression(nextFormula, (ref) => {
                  const normalizedRef = normalizeRefToCellId(ref, currentCellId);
                  if (!normalizedRef) {
                    throw new Error('Invalid reference');
                  }
                  const colMatch = normalizedRef.match(/^[A-Z]+/);
                  const rowMatch = normalizedRef.match(/[0-9]+$/);
                  if (!colMatch || !rowMatch) {
                    throw new Error('Invalid reference');
                  }
                  const resolvedColKey = colMatch[0];
                  const resolvedRowIndex = Number(rowMatch[0]) - 1;
                  const resolvedColIndex = columnKeys.indexOf(resolvedColKey);
                  if (resolvedRowIndex < 0 || resolvedColIndex < 0) {
                    throw new Error('Invalid reference');
                  }
                  const resolvedValue = String(computedMatrix.matrix[resolvedRowIndex]?.[resolvedColIndex] ?? '');
                  if (resolvedValue === 'ERROR') {
                    throw new Error('Invalid reference');
                  }
                  return parseRawCellAsFormulaValue(resolvedValue);
                });
                return formatFormulaValue(value);
              };

              const next = rawMatrix.map((row) => [...row]);

              next.forEach((row, rowIndex) => {
                try {
                  row[colIndex] = hasSelfColumnReference ? evaluateAsValueTransform(rowIndex) : nextFormula;
                } catch {
                  row[colIndex] = 'ERROR';
                }
              });
              if (hasSelfColumnReference && next.some((row) => row[colIndex] === 'ERROR')) {
                toast.error('Some rows could not be calculated. Check formula syntax and referenced column values.');
              }
              setRawMatrixWithHistory(next);
            }}
            onTemplateClick={(template) => setFormulaInput(template)}
          />
        </div>

        <ColumnSettingsPopover
          state={columnSettingsState}
          onStateChange={setColumnSettingsState}
          onApply={() => {
            const trimmedName = columnSettingsState.value.trim();
            if (!trimmedName) {
              setColumnSettingsState((prev) => ({ ...prev, editNameMessage: 'Column name is required.' }));
              return;
            }
            if (hasDuplicateColumnName(trimmedName, columnSettingsState.isCreateMode ? undefined : columnSettingsState.colKey)) {
              setColumnSettingsState((prev) => ({ ...prev, editNameMessage: 'Column name already exists. Choose a unique name.' }));
              return;
            }
            if (columnSettingsState.isCreateMode && !columnSettingsState.colKey) {
              const agreementColumnIndex = resolveAgreementColumnIndex();
              const fallbackInsertIndex = Math.max(0, Math.min(columnSettingsState.pendingInsertIndex, columnKeys.length));
              const insertIndex =
                agreementColumnIndex >= 0
                  ? columnSettingsState.position === 'BEFORE'
                    ? agreementColumnIndex
                    : agreementColumnIndex + 1
                  : fallbackInsertIndex;
              const fallbackKey = getColumnLabel(Math.max(0, Math.min(insertIndex, columnKeys.length)));
              const resolvedColumnType = columnSettingsState.isShowIncostSheet ? 'NUMBER' : columnSettingsState.columnType;
              const insertedColKey = insertColumnAtIndex(insertIndex, {
                headerName: trimmedName || fallbackKey,
                isShowIncostSheet: columnSettingsState.isShowIncostSheet,
                columnType: resolvedColumnType,
                isCostEditable: columnSettingsState.isCostEditable,
                referenceColumn: columnSettingsState.referenceColumn,
                position: columnSettingsState.position,
              });
              requestAnimationFrame(() => {
                const api = gridApiRef.current;
                if (!api || !insertedColKey) return;
                api.ensureColumnVisible(insertedColKey);
                api.setFocusedCell(0, insertedColKey);
              });
              setColumnSettingsState((prev) => ({
                ...prev,
                open: false,
                colKey: '',
                value: '',
                columnType: 'NUMBER',
                position: 'AFTER',
                referenceColumn: 'AGREEMENT_VALUE',
                isCostEditable: true,
                canEditName: true,
                isStaticHeader: false,
                isCreateMode: false,
                pendingInsertIndex: -1,
                editNameMessage: '',
              }));
              return;
            }
            if (!columnSettingsState.colKey) return;
            const colKey = columnSettingsState.colKey;
            if (columnSettingsState.canEditName) {
              setColumnNames((prev) => ({
                ...prev,
                [colKey]: formatGridHeaderName(trimmedName || colKey, colKey),
              }));
            }
            setColumnCostSheetFlags((prev) => ({ ...prev, [colKey]: columnSettingsState.isShowIncostSheet }));
            setColumnConfigs((prev) => ({
              ...prev,
              [colKey]: {
                columnType: columnSettingsState.isShowIncostSheet ? 'NUMBER' : columnSettingsState.columnType,
                isCostEditable: columnSettingsState.isCostEditable,
                referenceColumn: columnSettingsState.referenceColumn,
                position: columnSettingsState.position,
                isCostSheet: columnSettingsState.isShowIncostSheet,
                orderIndex: columnKeys.indexOf(colKey) + 1,
              },
            }));
            setColumnSettingsState((prev) => ({
              ...prev,
              open: false,
              colKey: '',
              value: '',
              columnType: 'NUMBER',
              position: 'AFTER',
              referenceColumn: 'AGREEMENT_VALUE',
              isCostEditable: true,
              canEditName: true,
              isStaticHeader: false,
              isCreateMode: false,
              pendingInsertIndex: -1,
              editNameMessage: '',
            }));
          }}
        />

        <ConfirmationDialog
          open={isResetDialogOpen}
          onClose={() => setIsResetDialogOpen(false)}
          onConfirm={() => {
            setIsResetDialogOpen(false);
            resetSheet();
          }}
          title='Reset Inventory Sheet'
          description='This will clear all sheet data and restore the initial columns. Are you sure you want to continue?'
          buttonText='Reset'
          variant='delete'
        />
      </section>
    </div>
  );
};

export default ExcelInventoryGrid;
