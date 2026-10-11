import * as React from 'react';
import type { GridRow } from '../types';

interface UseExcelRowsParams {
  columnKeys: string[];
  computedMatrix: string[][];
  rawMatrix: string[][];
  columnFormulaByKey: Record<string, string>;
  setRawMatrix: React.Dispatch<React.SetStateAction<string[][]>>;
  setRowIds?: React.Dispatch<React.SetStateAction<(number | null)[]>>;
  setSelectedCell: React.Dispatch<React.SetStateAction<{ rowIndex: number; colKey: string } | null>>;
  setSelectedColumnKey: React.Dispatch<React.SetStateAction<string | null>>;
  setFormulaInput: React.Dispatch<React.SetStateAction<string>>;
  setIsAllGridSelected: React.Dispatch<React.SetStateAction<boolean>>;
}

export const useExcelRows = ({
  columnKeys,
  computedMatrix,
  rawMatrix,
  columnFormulaByKey,
  setRawMatrix,
  setRowIds,
  setSelectedCell,
  setSelectedColumnKey,
  setFormulaInput,
  setIsAllGridSelected,
}: UseExcelRowsParams) => {
  const clearSelectionState = React.useCallback(() => {
    setSelectedCell(null);
    setSelectedColumnKey(null);
    setFormulaInput('');
    setIsAllGridSelected(false);
  }, [setFormulaInput, setIsAllGridSelected, setSelectedCell, setSelectedColumnKey]);

  const rowData = React.useMemo(() => {
    const dataRows: GridRow[] = computedMatrix.map((row, rowIndex) =>
      columnKeys.reduce<GridRow>(
        (acc, key, colIndex) => {
          acc[key] = row[colIndex];
          return acc;
        },
        { __rowIndex: rowIndex },
      ),
    );
    return dataRows;
  }, [columnKeys, computedMatrix]);

  const pinnedBottomRowData = React.useMemo<GridRow[]>(() => [{ __isAddRow: 'true' }], []);

  const deleteRowAtIndex = React.useCallback(
    (rowIndex: number) => {
      setRawMatrix((prev) => {
        if (rowIndex < 0 || rowIndex >= prev.length) return prev;
        if (prev.length <= 1) {
          return [Array.from({ length: columnKeys.length }, () => '')];
        }
        return prev.filter((_, index) => index !== rowIndex);
      });
      setRowIds?.((prev) => {
        if (rowIndex < 0 || rowIndex >= prev.length) return prev;
        if (prev.length <= 1) {
          return [null];
        }
        return prev.filter((_, index) => index !== rowIndex);
      });
      clearSelectionState();
    },
    [clearSelectionState, columnKeys.length, setRawMatrix, setRowIds],
  );

  const insertRowAtIndex = React.useCallback(
    (insertIndex: number) => {
      const boundedIndex = Math.max(0, Math.min(insertIndex, rawMatrix.length));
      setRawMatrix((prev) => {
        const next = [...prev.map((row) => [...row])];
        const formulaSeedRow = columnKeys.map((colKey) => columnFormulaByKey[colKey] ?? '');
        next.splice(boundedIndex, 0, formulaSeedRow);
        return next;
      });
      setRowIds?.((prev) => {
        const next = [...prev];
        next.splice(boundedIndex, 0, null);
        return next;
      });
      clearSelectionState();
    },
    [clearSelectionState, columnFormulaByKey, columnKeys, rawMatrix.length, setRawMatrix, setRowIds],
  );

  const duplicateRowAtIndex = React.useCallback(
    (rowIndex: number) => {
      setRawMatrix((prev) => {
        if (rowIndex < 0 || rowIndex >= prev.length) return prev;
        const next = prev.map((row) => [...row]);
        next.splice(rowIndex + 1, 0, [...next[rowIndex]]);
        return next;
      });
      setRowIds?.((prev) => {
        if (rowIndex < 0 || rowIndex >= prev.length) return prev;
        const next = [...prev];
        next.splice(rowIndex + 1, 0, null);
        return next;
      });
      clearSelectionState();
    },
    [clearSelectionState, setRawMatrix, setRowIds],
  );

  const getColumnFormulaPreview = React.useCallback(
    (colKey: string) => {
      const colIndex = columnKeys.indexOf(colKey);
      if (colIndex < 0) return '';
      let firstFormula = '';
      for (let rowIndex = 0; rowIndex < rawMatrix.length; rowIndex += 1) {
        const value = String(rawMatrix[rowIndex]?.[colIndex] ?? '');
        if (!value.startsWith('=')) continue;
        if (!firstFormula) {
          firstFormula = value;
          continue;
        }
        if (value !== firstFormula) return '';
      }
      return firstFormula;
    },
    [columnKeys, rawMatrix],
  );

  return {
    rowData,
    pinnedBottomRowData,
    deleteRowAtIndex,
    insertRowAtIndex,
    duplicateRowAtIndex,
    getColumnFormulaPreview,
  };
};
