import type { ColumnSetting } from './lib/types';

export const DEMO_HEADERS = ['Phase', 'Wing', 'Floor', 'Unit', 'Carpet Area', 'Rate', 'Amount'];

const emptyRow = () => DEMO_HEADERS.map(() => '');

export const DEMO_MATRIX: string[][] = [
  ['Phase 1', 'A', '3', '301', '850', '12000', ''],
  ['Phase 1', 'A', '3', '302', '920', '12500', ''],
  ['Phase 1', 'B', '5', '501', '1100', '13000', ''],
  ['Phase 2', 'C', '2', '201', '760', '11000', ''],
  ...Array.from({ length: 8 }, emptyRow),
];

export const DEMO_COLUMN_SETTINGS: Record<string, ColumnSetting> = {
  'Carpet Area': { displayName: 'Carpet Area', columnType: 'NUMBER', isShowIncostSheet: true },
  Rate: { displayName: 'Rate', columnType: 'NUMBER', isShowIncostSheet: true },
  Amount: {
    displayName: 'Amount',
    columnType: 'NUMBER',
    isShowIncostSheet: true,
    excelFormula: '=E*F',
  },
};
