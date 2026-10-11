export interface ColumnSetting {
  displayName?: string;
  isShowIncostSheet?: boolean;
  columnType?: 'NUMBER' | 'STRING' | 'BOOLEAN';
  isCostEditable?: boolean;
  isExcelEditable?: boolean;
  excelFormula?: string;
  referenceColumn?: 'AGREEMENT_VALUE';
  position?: 'BEFORE' | 'AFTER';
  isStaticHeader?: boolean;
}

export interface ExcelInventorySaveResult {
  matrix: string[][];
  headers: string[];
  columnSettings: Record<string, ColumnSetting>;
}

export interface ExcelInventoryGridProps {
  title?: string;
  initialMatrix?: string[][];
  headers?: string[];
  staticHeaders?: string[];
  metadataHeaders?: string[];
  columnSettings?: Record<string, ColumnSetting>;
  onBack?: () => void;
  onSave?: (result: ExcelInventorySaveResult) => Promise<void> | void;
}
