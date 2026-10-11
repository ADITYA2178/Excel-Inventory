import * as React from 'react';
import { escapeRegex, formatGridHeaderName, getColumnLabel, normalizeHeaderKey } from '../utils';
import type { ColumnTypeOption, RelativeColumnPosition } from '../components/ColumnSettingsPopover';

interface ColumnConfig {
  columnType: ColumnTypeOption;
  isCostEditable: boolean;
  referenceColumn: 'AGREEMENT_VALUE';
  position: RelativeColumnPosition;
  isCostSheet: boolean;
  orderIndex: number;
}

interface UseExcelColumnsParams {
  columnKeys: string[];
  columnNames: Record<string, string>;
  columnFormulaByKey: Record<string, string>;
  setColumnKeys: React.Dispatch<React.SetStateAction<string[]>>;
  setColumnNames: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setColumnCostSheetFlags: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setColumnConfigs: React.Dispatch<React.SetStateAction<Record<string, ColumnConfig>>>;
  setUserCreatedColumnFlags: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setRawMatrix: React.Dispatch<React.SetStateAction<string[][]>>;
  setColumnFormulaByKey: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setSelectedCell: React.Dispatch<React.SetStateAction<{ rowIndex: number; colKey: string } | null>>;
  setSelectedColumnKey: React.Dispatch<React.SetStateAction<string | null>>;
  setFormulaInput: React.Dispatch<React.SetStateAction<string>>;
  setIsAllGridSelected: React.Dispatch<React.SetStateAction<boolean>>;
}

const isAgreementValueHeader = (header: string) => {
  const normalized = normalizeHeaderKey(header);
  return normalized === 'agreementvalue' || normalized.startsWith('agreementval');
};

const isAllInclusivePriceHeader = (header: string) => {
  const normalized = normalizeHeaderKey(header);
  return normalized === 'allinclusiveprice' || normalized.startsWith('allinclusivepr');
};

const remapFormulaColumnRefs = (formula: string, oldToNewKeyMap: Record<string, string>) => {
  if (!formula.startsWith('=')) return formula;
  const oldKeys = Object.keys(oldToNewKeyMap);
  if (!oldKeys.length) return formula;
  let nextFormula = formula;

  oldKeys
    .slice()
    .sort((left, right) => right.length - left.length)
    .forEach((oldKey, index) => {
      const tokenPattern = new RegExp(`\\b${oldKey}(\\d*)\\b`, 'g');
      nextFormula = nextFormula.replace(tokenPattern, `__COL_REF_${index}__$1`);
    });

  oldKeys.forEach((oldKey, index) => {
    const mappedKey = oldToNewKeyMap[oldKey] ?? oldKey;
    const placeholderPattern = new RegExp(`__COL_REF_${index}__(\\d*)`, 'g');
    nextFormula = nextFormula.replace(placeholderPattern, `${mappedKey}$1`);
  });

  return nextFormula;
};

const stripDeletedColumnRefsFromFormula = (formula: string, deletedKey: string) => {
  if (!formula.startsWith('=') || !deletedKey) return formula;
  const pattern = new RegExp(`\\b${escapeRegex(deletedKey)}\\d*\\b`, 'g');
  let condensed = formula.slice(1).replace(pattern, '').replace(/\s+/g, '');
  for (let guard = 0; guard < 16; guard += 1) {
    const before = condensed;
    condensed = condensed.replace(/\++/g, '+').replace(/\(\+/g, '(').replace(/\+\)/g, ')').replace(/\+-/g, '-').replace(/-\+/g, '-');
    condensed = condensed.replace(/^\++/, '').replace(/\++$/, '');
    if (condensed === before) break;
  }
  const trimmed = condensed.trim();
  if (!trimmed || trimmed === '+' || trimmed === '-') return '';
  return `=${trimmed}`;
};

const rewriteFormulaAfterColumnDelete = (formula: string, deletedKey: string, oldToNewKeyMap: Record<string, string>) => {
  if (!formula.startsWith('=')) return formula;
  const stripped = stripDeletedColumnRefsFromFormula(formula, deletedKey);
  if (!stripped) return '';
  return remapFormulaColumnRefs(stripped, oldToNewKeyMap);
};

export const useExcelColumns = ({
  columnKeys,
  columnNames,
  columnFormulaByKey,
  setColumnKeys,
  setColumnNames,
  setColumnCostSheetFlags,
  setColumnConfigs,
  setUserCreatedColumnFlags,
  setRawMatrix,
  setColumnFormulaByKey,
  setSelectedCell,
  setSelectedColumnKey,
  setFormulaInput,
  setIsAllGridSelected,
}: UseExcelColumnsParams) => {
  const clearSelectionState = React.useCallback(() => {
    setSelectedCell(null);
    setSelectedColumnKey(null);
    setFormulaInput('');
    setIsAllGridSelected(false);
  }, [setFormulaInput, setIsAllGridSelected, setSelectedCell, setSelectedColumnKey]);

  const insertColumnAtIndex = React.useCallback(
    (
      insertIndex: number,
      options?: {
        headerName?: string;
        isShowIncostSheet?: boolean;
        columnType?: ColumnTypeOption;
        isCostEditable?: boolean;
        referenceColumn?: 'AGREEMENT_VALUE';
        position?: RelativeColumnPosition;
      },
    ): string => {
      const boundedInsertIndex = Math.max(0, Math.min(insertIndex, columnKeys.length));
      const nextColumnKeys = Array.from({ length: columnKeys.length + 1 }, (_, index) => getColumnLabel(index));
      const insertedKey = nextColumnKeys[boundedInsertIndex];
      const insertedHeaderName = formatGridHeaderName(options?.headerName ?? insertedKey, insertedKey);
      const insertedCostSheetFlag = options?.isShowIncostSheet ?? true;
      const insertedColumnType = options?.columnType ?? (insertedCostSheetFlag ? 'NUMBER' : 'STRING');
      const insertedIsCostEditable = options?.isCostEditable ?? true;
      const insertedReferenceColumn = options?.referenceColumn ?? 'AGREEMENT_VALUE';
      const insertedPosition = options?.position ?? 'AFTER';

      const nextColumnNameMap: Record<string, string> = {};
      let syncedOldIndex = 0;
      const oldToNewKeyMap: Record<string, string> = {};
      nextColumnKeys.forEach((newKey, newIndex) => {
        if (newIndex === boundedInsertIndex) {
          nextColumnNameMap[newKey] = insertedHeaderName;
          return;
        }
        const oldKey = columnKeys[syncedOldIndex];
        nextColumnNameMap[newKey] = columnNames[oldKey] ?? oldKey;
        oldToNewKeyMap[oldKey] = newKey;
        syncedOldIndex += 1;
      });

      const nextColumnFormulaMap: Record<string, string> = {};
      let formulaOldIndex = 0;
      nextColumnKeys.forEach((newKey, newIndex) => {
        if (newIndex === boundedInsertIndex) return;
        const oldKey = columnKeys[formulaOldIndex];
        if (columnFormulaByKey[oldKey]) {
          nextColumnFormulaMap[newKey] = remapFormulaColumnRefs(columnFormulaByKey[oldKey], oldToNewKeyMap);
        }
        formulaOldIndex += 1;
      });

      const agreementValueKey = nextColumnKeys.find((key) => isAgreementValueHeader(nextColumnNameMap[key] ?? key));
      const allInclusivePriceKey = nextColumnKeys.find((key) => isAllInclusivePriceHeader(nextColumnNameMap[key] ?? key));
      const autoFormulaTargetKey = insertedPosition === 'BEFORE' ? agreementValueKey : allInclusivePriceKey;
      const existingTargetFormula = autoFormulaTargetKey ? String(nextColumnFormulaMap[autoFormulaTargetKey] ?? '') : '';
      const hasInsertedReference = existingTargetFormula && new RegExp(`\\b${insertedKey}\\b`, 'i').test(existingTargetFormula);
      const hasAgreementReference =
        Boolean(agreementValueKey) && Boolean(existingTargetFormula) && new RegExp(`\\b${agreementValueKey}\\b`, 'i').test(existingTargetFormula);
      const appendOperand = (formulaBody: string, operand: string) => {
        const trimmedFormulaBody = formulaBody.trim();
        if (!trimmedFormulaBody) return operand;
        if (/[+\-*/(]$/.test(trimmedFormulaBody)) return `${trimmedFormulaBody}${operand}`;
        return `${trimmedFormulaBody}+${operand}`;
      };
      const nextAutoFormula = (() => {
        if (!autoFormulaTargetKey) return '';
        if (insertedPosition === 'AFTER' && autoFormulaTargetKey === allInclusivePriceKey && agreementValueKey) {
          const formulaBody = existingTargetFormula.startsWith('=') ? existingTargetFormula.slice(1).trim() : '';
          const bodyWithInserted = hasInsertedReference ? formulaBody : appendOperand(formulaBody, insertedKey);
          if (hasAgreementReference) {
            return `=${bodyWithInserted || agreementValueKey}`;
          }
          const normalizedBodyWithInserted = bodyWithInserted || insertedKey;
          return `=${appendOperand(agreementValueKey, normalizedBodyWithInserted)}`;
        }
        if (hasInsertedReference) return existingTargetFormula;
        const fallbackBaseKey = insertedPosition === 'AFTER' && autoFormulaTargetKey === allInclusivePriceKey ? agreementValueKey : '';
        if (!existingTargetFormula.startsWith('=')) {
          return fallbackBaseKey ? `=${fallbackBaseKey}+${insertedKey}` : `=${insertedKey}`;
        }
        const formulaBody = existingTargetFormula.slice(1).trim();
        if (!formulaBody) return fallbackBaseKey ? `=${fallbackBaseKey}+${insertedKey}` : `=${insertedKey}`;
        return `=${appendOperand(formulaBody, insertedKey)}`;
      })();

      if (autoFormulaTargetKey && nextAutoFormula) {
        nextColumnFormulaMap[autoFormulaTargetKey] = nextAutoFormula;
      }

      setColumnNames((prev) => {
        const next: Record<string, string> = {};
        let oldIndex = 0;
        nextColumnKeys.forEach((newKey, newIndex) => {
          if (newIndex === boundedInsertIndex) {
            next[newKey] = insertedHeaderName;
            return;
          }
          const oldKey = columnKeys[oldIndex];
          next[newKey] = prev[oldKey] ?? newKey;
          oldIndex += 1;
        });
        return next;
      });

      setColumnKeys(nextColumnKeys);
      setColumnCostSheetFlags((prev) => {
        const next: Record<string, boolean> = {};
        let oldIndex = 0;
        nextColumnKeys.forEach((newKey, newIndex) => {
          if (newIndex === boundedInsertIndex) {
            next[newKey] = insertedCostSheetFlag;
            return;
          }
          const oldKey = columnKeys[oldIndex];
          next[newKey] = prev[oldKey] ?? true;
          oldIndex += 1;
        });
        return next;
      });
      setColumnConfigs((prev) => {
        const next: Record<string, ColumnConfig> = {};
        let oldIndex = 0;
        nextColumnKeys.forEach((newKey, newIndex) => {
          if (newIndex === boundedInsertIndex) {
            next[newKey] = {
              columnType: insertedColumnType,
              isCostEditable: insertedIsCostEditable,
              referenceColumn: insertedReferenceColumn,
              position: insertedPosition,
              isCostSheet: insertedCostSheetFlag,
              orderIndex: boundedInsertIndex + 1,
            };
            return;
          }
          const oldKey = columnKeys[oldIndex];
          const previous = prev[oldKey];
          next[newKey] = {
            columnType: previous?.columnType ?? 'STRING',
            isCostEditable: previous?.isCostEditable ?? true,
            referenceColumn: previous?.referenceColumn ?? 'AGREEMENT_VALUE',
            position: previous?.position ?? 'AFTER',
            isCostSheet: previous?.isCostSheet ?? (previous ? previous.isCostSheet : (insertedCostSheetFlag ?? true)),
            orderIndex: newIndex + 1,
          };
          oldIndex += 1;
        });
        return next;
      });
      setUserCreatedColumnFlags((prev) => {
        const next: Record<string, boolean> = {};
        let oldIndex = 0;
        nextColumnKeys.forEach((newKey, newIndex) => {
          if (newIndex === boundedInsertIndex) {
            next[newKey] = true;
            return;
          }
          const oldKey = columnKeys[oldIndex];
          next[newKey] = prev[oldKey] ?? false;
          oldIndex += 1;
        });
        return next;
      });
      setRawMatrix((prev) =>
        prev.map((row) => {
          const nextRow = [...row];
          nextRow.splice(boundedInsertIndex, 0, '');
          nextColumnKeys.forEach((_, colIndex) => {
            const rawValue = String(nextRow[colIndex] ?? '');
            if (!rawValue.startsWith('=')) return;
            nextRow[colIndex] = remapFormulaColumnRefs(rawValue, oldToNewKeyMap);
          });
          if (autoFormulaTargetKey && nextAutoFormula) {
            const targetIndex = nextColumnKeys.indexOf(autoFormulaTargetKey);
            if (targetIndex >= 0) {
              nextRow[targetIndex] = nextAutoFormula;
            }
          }
          return nextRow;
        }),
      );
      setColumnFormulaByKey(nextColumnFormulaMap);
      setSelectedColumnKey(nextColumnKeys[boundedInsertIndex]);
      setSelectedCell(null);
      setFormulaInput('');
      setIsAllGridSelected(false);
      return insertedKey;
    },
    [
      columnFormulaByKey,
      columnKeys,
      columnNames,
      setColumnConfigs,
      setColumnCostSheetFlags,
      setColumnFormulaByKey,
      setColumnKeys,
      setColumnNames,
      setFormulaInput,
      setIsAllGridSelected,
      setRawMatrix,
      setSelectedCell,
      setSelectedColumnKey,
      setUserCreatedColumnFlags,
    ],
  );

  const duplicateColumnAtIndex = React.useCallback(
    (sourceIndex: number) => {
      if (sourceIndex < 0 || sourceIndex >= columnKeys.length) return;
      const nextColumnKeys = Array.from({ length: columnKeys.length + 1 }, (_, index) => getColumnLabel(index));

      setColumnNames((prev) => {
        const next: Record<string, string> = {};
        let oldIndex = 0;
        nextColumnKeys.forEach((newKey, newIndex) => {
          if (newIndex === sourceIndex + 1) {
            const sourceKey = columnKeys[sourceIndex];
            next[newKey] = prev[sourceKey] ?? sourceKey;
            return;
          }
          const oldKey = columnKeys[oldIndex];
          next[newKey] = prev[oldKey] ?? newKey;
          oldIndex += 1;
        });
        return next;
      });

      setColumnKeys(nextColumnKeys);
      setColumnCostSheetFlags((prev) => {
        const next: Record<string, boolean> = {};
        let oldIndex = 0;
        nextColumnKeys.forEach((newKey, newIndex) => {
          if (newIndex === sourceIndex + 1) {
            const sourceKey = columnKeys[sourceIndex];
            next[newKey] = prev[sourceKey] ?? true;
            return;
          }
          const oldKey = columnKeys[oldIndex];
          next[newKey] = prev[oldKey] ?? true;
          oldIndex += 1;
        });
        return next;
      });
      setColumnConfigs((prev) => {
        const next: Record<string, ColumnConfig> = {};
        let oldIndex = 0;
        nextColumnKeys.forEach((newKey, newIndex) => {
          if (newIndex === sourceIndex + 1) {
            const sourceKey = columnKeys[sourceIndex];
            const sourceConfig = prev[sourceKey];
            next[newKey] = {
              columnType: sourceConfig?.columnType ?? 'STRING',
              isCostEditable: sourceConfig?.isCostEditable ?? true,
              referenceColumn: sourceConfig?.referenceColumn ?? 'AGREEMENT_VALUE',
              position: sourceConfig?.position ?? 'AFTER',
              isCostSheet: sourceConfig?.isCostSheet ?? true,
              orderIndex: newIndex + 1,
            };
            return;
          }
          const oldKey = columnKeys[oldIndex];
          const previous = prev[oldKey];
          next[newKey] = {
            columnType: previous?.columnType ?? 'STRING',
            isCostEditable: previous?.isCostEditable ?? true,
            referenceColumn: previous?.referenceColumn ?? 'AGREEMENT_VALUE',
            position: previous?.position ?? 'AFTER',
            isCostSheet: previous?.isCostSheet ?? true,
            orderIndex: newIndex + 1,
          };
          oldIndex += 1;
        });
        return next;
      });
      setUserCreatedColumnFlags((prev) => {
        const next: Record<string, boolean> = {};
        let oldIndex = 0;
        nextColumnKeys.forEach((newKey, newIndex) => {
          if (newIndex === sourceIndex + 1) {
            next[newKey] = true;
            return;
          }
          const oldKey = columnKeys[oldIndex];
          next[newKey] = prev[oldKey] ?? false;
          oldIndex += 1;
        });
        return next;
      });
      setRawMatrix((prev) =>
        prev.map((row) => {
          const nextRow = [...row];
          nextRow.splice(sourceIndex + 1, 0, String(row[sourceIndex] ?? ''));
          return nextRow;
        }),
      );
      setColumnFormulaByKey((prev) => {
        const next: Record<string, string> = {};
        let oldIndex = 0;
        nextColumnKeys.forEach((newKey, newIndex) => {
          if (newIndex === sourceIndex + 1) {
            const sourceKey = columnKeys[sourceIndex];
            if (prev[sourceKey]) {
              next[newKey] = prev[sourceKey];
            }
            return;
          }
          const oldKey = columnKeys[oldIndex];
          if (prev[oldKey]) {
            next[newKey] = prev[oldKey];
          }
          oldIndex += 1;
        });
        return next;
      });
      setSelectedColumnKey(nextColumnKeys[sourceIndex + 1]);
      setSelectedCell(null);
      setFormulaInput('');
      setIsAllGridSelected(false);
    },
    [
      columnKeys,
      setColumnConfigs,
      setColumnCostSheetFlags,
      setColumnFormulaByKey,
      setColumnKeys,
      setColumnNames,
      setFormulaInput,
      setIsAllGridSelected,
      setRawMatrix,
      setSelectedCell,
      setSelectedColumnKey,
      setUserCreatedColumnFlags,
    ],
  );

  const deleteColumnAtIndex = React.useCallback(
    (sourceIndex: number) => {
      if (sourceIndex < 0 || columnKeys.length <= 1) return;
      const deletedKey = columnKeys[sourceIndex];
      const remainingKeys = columnKeys.filter((_, index) => index !== sourceIndex);
      const relabeledKeys = remainingKeys.map((_, index) => getColumnLabel(index));
      const oldToNewKeyMap: Record<string, string> = {};
      remainingKeys.forEach((oldKey, index) => {
        oldToNewKeyMap[oldKey] = relabeledKeys[index];
      });

      setColumnKeys(relabeledKeys);
      setColumnCostSheetFlags((prev) => {
        const next: Record<string, boolean> = {};
        remainingKeys.forEach((oldKey, index) => {
          const newKey = relabeledKeys[index];
          next[newKey] = prev[oldKey] ?? true;
        });
        return next;
      });
      setColumnNames((prev) => {
        const next: Record<string, string> = {};
        remainingKeys.forEach((oldKey, index) => {
          const newKey = relabeledKeys[index];
          next[newKey] = prev[oldKey] ?? newKey;
        });
        return next;
      });
      setColumnConfigs((prev) => {
        const next: Record<string, ColumnConfig> = {};
        remainingKeys.forEach((oldKey, index) => {
          const newKey = relabeledKeys[index];
          const previous = prev[oldKey];
          next[newKey] = {
            columnType: previous?.columnType ?? 'STRING',
            isCostEditable: previous?.isCostEditable ?? true,
            referenceColumn: previous?.referenceColumn ?? 'AGREEMENT_VALUE',
            position: previous?.position ?? 'AFTER',
            isCostSheet: previous?.isCostSheet ?? true,
            orderIndex: index + 1,
          };
        });
        return next;
      });
      setUserCreatedColumnFlags((prev) => {
        const next: Record<string, boolean> = {};
        remainingKeys.forEach((oldKey, index) => {
          const newKey = relabeledKeys[index];
          next[newKey] = prev[oldKey] ?? false;
        });
        return next;
      });
      setRawMatrix((prev) =>
        prev.map((row) => {
          const filtered = row.filter((_, index) => index !== sourceIndex);
          return filtered.map((cell) => {
            const rawValue = String(cell ?? '');
            if (!rawValue.startsWith('=')) return rawValue;
            const nextValue = rewriteFormulaAfterColumnDelete(rawValue, deletedKey, oldToNewKeyMap);
            return nextValue;
          });
        }),
      );
      setColumnFormulaByKey((prev) => {
        const next: Record<string, string> = {};
        remainingKeys.forEach((oldKey, index) => {
          const newKey = relabeledKeys[index];
          if (!prev[oldKey]) return;
          const rewritten = rewriteFormulaAfterColumnDelete(prev[oldKey], deletedKey, oldToNewKeyMap);
          if (rewritten) {
            next[newKey] = rewritten;
          }
        });
        return next;
      });
      clearSelectionState();
    },
    [
      clearSelectionState,
      columnKeys,
      setColumnConfigs,
      setColumnCostSheetFlags,
      setColumnFormulaByKey,
      setColumnKeys,
      setColumnNames,
      setRawMatrix,
      setUserCreatedColumnFlags,
    ],
  );

  return {
    insertColumnAtIndex,
    duplicateColumnAtIndex,
    deleteColumnAtIndex,
  };
};
