import * as React from 'react';
import ExcelInventoryGrid from './lib/ExcelInventoryGrid';
import type { ExcelInventorySaveResult } from './lib/types';
import { DEMO_COLUMN_SETTINGS, DEMO_HEADERS, DEMO_MATRIX } from './demoData';

const DemoPage: React.FC = () => {
  const handleSave = async (result: ExcelInventorySaveResult) => {
    const filledRows = result.matrix.filter((row) => row.some((cell) => String(cell).trim())).length;
    console.info('Excel inventory saved', { headers: result.headers, filledRows, columnSettings: result.columnSettings });
  };

  return (
    <ExcelInventoryGrid
      title='Excel Inventory'
      headers={DEMO_HEADERS}
      staticHeaders={DEMO_HEADERS}
      initialMatrix={DEMO_MATRIX}
      columnSettings={DEMO_COLUMN_SETTINGS}
      onSave={handleSave}
    />
  );
};

export default DemoPage;
