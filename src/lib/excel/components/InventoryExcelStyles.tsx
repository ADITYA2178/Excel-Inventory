import * as React from 'react';

const InventoryExcelStyles: React.FC = () => {
  return (
    <style>
      {`
        .inventory-excel-grid .ag-theme-alpine {
          --ag-background-color: #ffffff;
          --ag-foreground-color: #0f172a;
          --ag-border-color: #e9eaeb;
          --ag-header-background-color: rgba(233, 237, 241, 1);
          --ag-header-foreground-color: #374151;
          --ag-header-column-resize-handle-color: #94a3b8;
          --ag-row-border-color: #e9eaeb;
          --ag-odd-row-background-color: #fcfdff;
          --ag-selected-row-background-color: #edf4ff;
          --ag-range-selection-background-color: rgba(37, 99, 235, 0.1);
          --ag-range-selection-border-color: rgba(37, 99, 235, 0.4);
          --ag-input-focus-border-color: #2563eb;
          --ag-font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
          --ag-font-size: 12px;
          --ag-cell-horizontal-padding: 14px;
          --ag-header-height: 42px;
          --ag-row-height: 30px;
          border: 1px solid #e9eaeb;
          border-radius: 12px;
          overflow: hidden;
          position: relative;
          box-shadow: inset 0 1px 0 #ffffff;
        }

        .inventory-excel-grid .ag-theme-alpine .ag-root-wrapper {
          border: 0;
          border-radius: 12px;
        }

        .inventory-excel-grid .ag-theme-alpine .ag-header {
          border-bottom: 1px solid #e9eaeb;
          background: rgba(233, 237, 241, 1);
        }

        .inventory-excel-grid .ag-theme-alpine .ag-header-cell {
          border-right: 1px solid #e9eaeb;
          font-weight: 700;
          color: #374151;
        }

        .inventory-excel-grid .ag-theme-alpine .ag-header-cell-label {
          height: 100%;
        }

        .inventory-excel-grid .ag-theme-alpine .ag-row {
          border-bottom: 1px solid #e9eaeb;
        }

        .inventory-excel-grid .ag-theme-alpine .ag-row:hover .ag-cell {
          background-color: #f5f9ff;
        }

        .inventory-excel-grid .ag-theme-alpine .ag-floating-bottom {
          border-top: 1px solid #e9eaeb;
          background-color: #ffffff;
          position: relative;
        }

        .inventory-excel-grid .ag-theme-alpine .ag-floating-bottom .ag-row {
          position: relative;
          background-color: #ffffff;
          border-bottom: 0;
          cursor: pointer;
        }

        .inventory-excel-grid .ag-theme-alpine .ag-floating-bottom::before {
          content: '+  Add Row';
          position: absolute;
          left: 50%;
          top: 50%;
          z-index: 2;
          color: #1d4ed8;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          line-height: 1;
          pointer-events: none;
          text-transform: uppercase;
          transform: translate(-50%, -50%);
        }

        .inventory-excel-grid .ag-theme-alpine .ag-floating-bottom .ag-cell {
          background-color: #ffffff;
          border-left: 0 !important;
          border-right: 0 !important;
        }

        .inventory-excel-grid .ag-theme-alpine .ag-floating-bottom .ag-row:hover .ag-cell,
        .inventory-excel-grid .ag-theme-alpine .ag-floating-bottom .ag-row:hover .inventory-add-row-cell {
          background: #eff6ff !important;
        }

        .inventory-excel-grid .ag-theme-alpine .ag-cell.inventory-add-row-cell {
          color: transparent;
          cursor: pointer;
        }

        .inventory-excel-grid .ag-theme-alpine .ag-cell {
          border-right: 1px solid #eef2f8;
          transition: background-color 120ms ease;
        }

        .inventory-excel-grid .ag-theme-alpine .ag-cell.inventory-cell-row-selected {
          background-color: rgba(37, 99, 235, 0.06);
        }

        .inventory-excel-grid .ag-theme-alpine .ag-cell.inventory-cell-column-selected {
          background-color: #e8f1ff;
        }

        .inventory-excel-grid .ag-theme-alpine .ag-cell.inventory-cell-row-column-intersection {
          background-color: #dbeafe;
        }

        .inventory-excel-grid .ag-theme-alpine .ag-cell.inventory-cell-range-selected {
          background-color: rgba(37, 99, 235, 0.1);
          box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.18);
        }

        .inventory-excel-grid .ag-theme-alpine .ag-cell.inventory-cell-search-match {
          background-color: #fef3c7;
          box-shadow: inset 0 0 0 1px rgba(245, 158, 11, 0.35);
        }

        .inventory-excel-grid .ag-theme-alpine .ag-cell.inventory-cell-search-active {
          background-color: #fde68a;
          box-shadow:
            inset 0 0 0 2px #f59e0b,
            0 0 0 1px rgba(245, 158, 11, 0.18);
        }

        .inventory-excel-grid .ag-theme-alpine .ag-pinned-left-header,
        .inventory-excel-grid .ag-theme-alpine .ag-pinned-left-cols-container {
          border-right: 1px solid #e9eaeb !important;
        }

        .inventory-excel-grid .ag-theme-alpine .ag-pinned-right-header,
        .inventory-excel-grid .ag-theme-alpine .ag-pinned-right-cols-container,
        .inventory-excel-grid .ag-theme-alpine .ag-pinned-right-floating-bottom {
          border-left: 1px solid #e9eaeb !important;
          background: transparent;
        }

        .inventory-excel-grid .ag-theme-alpine .ag-pinned-right-header,
        .inventory-excel-grid .ag-theme-alpine .ag-pinned-right-header .ag-header-row,
        .inventory-excel-grid .ag-theme-alpine .ag-pinned-right-header .ag-header-cell,
        .inventory-excel-grid .ag-theme-alpine .ag-pinned-right-header .ag-header-cell-comp-wrapper {
          background: rgba(233, 237, 241, 1) !important;
        }

        .inventory-excel-grid .ag-theme-alpine .ag-header-cell.inventory-add-column-header-cell {
          padding: 0;
          border-right: 0;
          background: rgba(233, 237, 241, 1);
          overflow: hidden;
        }

        .inventory-excel-grid .ag-theme-alpine .ag-header-cell.inventory-add-column-header-cell .ag-header-cell-comp-wrapper {
          height: 100%;
          width: 100%;
          align-items: center;
          justify-content: center;
        }

        .inventory-excel-grid .ag-theme-alpine .ag-cell.inventory-add-column-cell {
          border: 0 !important;
          padding: 0;
          background: #fcfdff !important;
        }

        .inventory-excel-grid .ag-theme-alpine .ag-pinned-right-cols-container .ag-row,
        .inventory-excel-grid .ag-theme-alpine .ag-pinned-right-floating-bottom .ag-row {
          border-bottom: 0 !important;
        }

        .inventory-excel-grid .ag-theme-alpine .ag-pinned-right-floating-bottom {
          border-left: 0 !important;
          background: #ffffff !important;
        }

        .inventory-excel-grid .ag-theme-alpine .ag-pinned-right-cols-container .ag-cell,
        .inventory-excel-grid .ag-theme-alpine .ag-pinned-right-floating-bottom .ag-cell {
          border: 0 !important;
          background: #fcfdff !important;
        }

        .inventory-excel-grid .ag-theme-alpine .inventory-add-column-fixed-rail {
          position: absolute;
          right: 0;
          top: var(--ag-header-height, 42px);
          bottom: var(--ag-row-height, 30px);
          z-index: 4;
          display: flex;
          width: 48px;
          align-items: center;
          justify-content: center;
          border: 0;
          background: transparent;
          color: #1d4ed8;
          cursor: pointer;
          padding: 0;
          transition: background-color 120ms ease, color 120ms ease;
        }

        .inventory-excel-grid .ag-theme-alpine .inventory-add-column-fixed-rail:hover {
          background: #eff6ff;
          color: #1e40af;
        }

        .inventory-excel-grid .ag-theme-alpine .inventory-add-column-fixed-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          line-height: 1;
          pointer-events: none;
          text-transform: uppercase;
          transform: rotate(180deg);
          writing-mode: vertical-rl;
        }

        .inventory-excel-grid .ag-theme-alpine .ag-cell.inventory-add-column-cell.ag-cell-focus {
          outline: 0 !important;
          box-shadow: none;
          background: #fcfdff !important;
        }

        .inventory-excel-grid .ag-theme-alpine .inventory-add-column-rail {
          display: none;
        }


        .inventory-excel-grid .ag-theme-alpine .ag-cell-focus {
          outline: 2px solid #2563eb !important;
          outline-offset: -2px;
          background-color: #eff6ff;
          box-shadow: inset 0 0 0 1px #bfdbfe;
        }

        .inventory-excel-grid .ag-theme-alpine .ag-fill-handle {
          width: 8px;
          height: 8px;
          border-radius: 9999px;
          border: 1px solid #1d4ed8;
          background-color: #2563eb;
          box-shadow: 0 0 0 1px #ffffff;
          opacity: 1;
        }

        .inventory-excel-grid .ag-theme-alpine .ag-cell-range-selected .ag-fill-handle,
        .inventory-excel-grid .ag-theme-alpine .ag-cell-focus .ag-fill-handle {
          opacity: 1;
        }

        .inventory-excel-grid .ag-theme-alpine .ag-cell-range-selected:not(.ag-cell-focus) {
          background-color: rgba(37, 99, 235, 0.08);
        }

        .inventory-excel-grid .ag-theme-alpine .ag-header-cell-resize {
          opacity: 0.35;
        }

        .inventory-excel-grid .ag-theme-alpine .ag-header-cell:hover .ag-header-cell-resize {
          opacity: 1;
        }

        .inventory-excel-grid .ag-theme-alpine .ag-body-viewport,
        .inventory-excel-grid .ag-theme-alpine .ag-center-cols-viewport,
        .inventory-excel-grid .ag-theme-alpine .ag-body-horizontal-scroll-viewport,
        .inventory-excel-grid .ag-theme-alpine .ag-body-vertical-scroll-viewport {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .inventory-excel-grid .ag-theme-alpine .ag-body-viewport::-webkit-scrollbar,
        .inventory-excel-grid .ag-theme-alpine .ag-center-cols-viewport::-webkit-scrollbar,
        .inventory-excel-grid .ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar,
        .inventory-excel-grid .ag-theme-alpine .ag-body-vertical-scroll-viewport::-webkit-scrollbar {
          width: 0;
          height: 0;
          display: none;
        }

        .inventory-excel-grid .ag-theme-alpine .ag-body-viewport::-webkit-scrollbar-button,
        .inventory-excel-grid .ag-theme-alpine .ag-center-cols-viewport::-webkit-scrollbar-button,
        .inventory-excel-grid .ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-button,
        .inventory-excel-grid .ag-theme-alpine .ag-body-vertical-scroll-viewport::-webkit-scrollbar-button,
        .inventory-excel-grid .ag-theme-alpine .ag-body-viewport::-webkit-scrollbar-corner,
        .inventory-excel-grid .ag-theme-alpine .ag-center-cols-viewport::-webkit-scrollbar-corner,
        .inventory-excel-grid .ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-corner,
        .inventory-excel-grid .ag-theme-alpine .ag-body-vertical-scroll-viewport::-webkit-scrollbar-corner {
          display: none;
          width: 0;
          height: 0;
        }

        .inventory-excel-grid .ag-theme-alpine .ag-body-horizontal-scroll,
        .inventory-excel-grid .ag-theme-alpine .ag-body-vertical-scroll,
        .inventory-excel-grid .ag-theme-alpine .ag-body-horizontal-scroll-container,
        .inventory-excel-grid .ag-theme-alpine .ag-body-vertical-scroll-container,
        .inventory-excel-grid .ag-theme-alpine .ag-body-vertical-scroll-viewport,
        .inventory-excel-grid .ag-theme-alpine .ag-body-vertical-scroll-container,
        .inventory-excel-grid .ag-theme-alpine .ag-body-vertical-scroll .ag-scrollbar-button,
        .inventory-excel-grid .ag-theme-alpine .ag-horizontal-left-spacer,
        .inventory-excel-grid .ag-theme-alpine .ag-horizontal-right-spacer {
          display: none !important;
          width: 0 !important;
          min-width: 0 !important;
          height: 0 !important;
          min-height: 0 !important;
        }

        .inventory-excel-grid.is-column-popover-open .ag-theme-alpine .ag-body-viewport,
        .inventory-excel-grid.is-column-popover-open .ag-theme-alpine .ag-center-cols-viewport,
        .inventory-excel-grid.is-column-popover-open .ag-theme-alpine .ag-body-horizontal-scroll-viewport,
        .inventory-excel-grid.is-column-popover-open .ag-theme-alpine .ag-body-vertical-scroll-viewport {
          overflow: hidden !important;
        }

        @media (orientation: landscape) {
          .inventory-excel-grid .inventory-add-column-label {
            font-weight: 600;
            letter-spacing: 0.01em;
          }
        }
      `}
    </style>
  );
};

export default InventoryExcelStyles;
