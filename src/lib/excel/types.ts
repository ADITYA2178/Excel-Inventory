export interface GridRow {
  __rowIndex?: number;
  __isAddRow?: string;
  [key: string]: string | number | undefined;
}

export interface GridCellPosition {
  rowIndex: number;
  colKey: string;
}

export interface GridCellSelectionRange {
  anchor: GridCellPosition;
  focus: GridCellPosition;
}
