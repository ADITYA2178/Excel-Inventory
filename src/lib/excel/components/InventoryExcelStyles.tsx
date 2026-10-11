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

        .inventory-excel-grid .ag-theme-alpine,
        .inventory-excel-grid .ag-theme-alpine .ag-root-wrapper,
        .inventory-excel-grid .ag-theme-alpine .ag-root-wrapper-body,
        .inventory-excel-grid .ag-theme-alpine .ag-root {
          height: 100%;
          width: 100%;
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
          border-top: 1px solid #e7edf5;
          background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
          position: relative;
        }

        .inventory-excel-grid .ag-theme-alpine .ag-floating-bottom .ag-row {
          position: relative;
          background-color: transparent;
          border-bottom: 0;
          cursor: pointer;
        }

        .inventory-excel-grid .ag-theme-alpine .ag-floating-bottom::before {
          content: '+   Add row';
          position: absolute;
          left: 50%;
          top: 50%;
          z-index: 2;
          display: inline-flex;
          align-items: center;
          height: 22px;
          padding: 0 12px;
          border: 1px solid #dbe3ee;
          border-radius: 999px;
          background: #ffffff;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
          color: #334155;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.01em;
          line-height: 22px;
          pointer-events: none;
          white-space: nowrap;
          transform: translate(-50%, -50%);
          transition: border-color 160ms ease, color 160ms ease, box-shadow 160ms ease, background-color 160ms ease;
          animation: inventory-row-pill-in 520ms cubic-bezier(0.22, 1, 0.36, 1) both, inventory-pill-glow 3.8s ease-in-out 0.7s infinite;
        }

        .inventory-excel-grid .ag-theme-alpine .ag-floating-bottom:hover::before {
          border-color: #bfdbfe;
          background: #f8fbff;
          color: #1d4ed8;
          box-shadow: 0 4px 10px rgba(37, 99, 235, 0.12);
          animation: none;
        }

        .inventory-excel-grid .ag-theme-alpine .ag-floating-bottom .ag-cell {
          background-color: transparent;
          border-left: 0 !important;
          border-right: 0 !important;
        }

        .inventory-excel-grid .ag-theme-alpine .ag-floating-bottom .ag-row:hover .ag-cell,
        .inventory-excel-grid .ag-theme-alpine .ag-floating-bottom .ag-row:hover .inventory-add-row-cell {
          background: transparent !important;
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
          width: 52px;
          align-items: center;
          justify-content: center;
          border: 0;
          border-left: 1px solid #e7edf5;
          background: linear-gradient(180deg, #f8fafc 0%, #ffffff 70%);
          color: #334155;
          cursor: pointer;
          padding: 0;
        }

        .inventory-excel-grid .ag-theme-alpine .inventory-add-column-fixed-rail:hover {
          background: linear-gradient(180deg, #f8fbff 0%, #ffffff 70%);
        }

        .inventory-excel-grid .ag-theme-alpine .inventory-add-column-fixed-rail:focus-visible {
          outline: none;
        }

        .inventory-excel-grid .ag-theme-alpine .inventory-add-column-fixed-rail:focus-visible .inventory-add-column-fixed-label {
          border-color: #93c5fd;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.16);
        }

        .inventory-excel-grid .ag-theme-alpine .inventory-add-column-fixed-label {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          min-height: 28px;
          padding: 12px 7px;
          border: 1px solid #dbe3ee;
          border-radius: 999px;
          background: #ffffff;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
          color: #334155;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.02em;
          line-height: 1;
          pointer-events: none;
          text-transform: none;
          writing-mode: vertical-rl;
          transform: rotate(180deg);
          transition: border-color 160ms ease, color 160ms ease, box-shadow 160ms ease, background-color 160ms ease;
          animation: inventory-column-pill-in 560ms cubic-bezier(0.22, 1, 0.36, 1) 120ms both, inventory-pill-glow 3.8s ease-in-out 0.9s infinite;
        }

        .inventory-excel-grid .ag-theme-alpine .inventory-add-column-fixed-rail:hover .inventory-add-column-fixed-label {
          border-color: #bfdbfe;
          background: #f8fbff;
          color: #1d4ed8;
          box-shadow: 0 4px 10px rgba(37, 99, 235, 0.12);
          animation: none;
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

        .inventory-rise {
          animation: inventory-rise 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .inventory-fade-in {
          animation: inventory-fade 420ms ease 80ms both;
        }

        .inventory-toolbar button {
          transition: transform 180ms ease, background-color 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
        }

        .inventory-toolbar button:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .inventory-drop {
          animation: inventory-drop 280ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .inventory-toast-in {
          animation: inventory-toast-in 320ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .inventory-fade {
          animation: inventory-fade 180ms ease both;
        }

        .inventory-pop {
          animation: inventory-pop 240ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        @keyframes inventory-rise {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes inventory-drop {
          from {
            opacity: 0;
            transform: translateY(-6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes inventory-row-pill-in {
          from {
            opacity: 0;
            transform: translate(-50%, -36%) scale(0.94);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }

        @keyframes inventory-column-pill-in {
          from {
            opacity: 0;
            transform: rotate(180deg) scale(0.92);
          }
          to {
            opacity: 1;
            transform: rotate(180deg) scale(1);
          }
        }

        @keyframes inventory-pill-glow {
          0%,
          100% {
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
          }
          50% {
            box-shadow: 0 6px 16px rgba(37, 99, 235, 0.16);
          }
        }

        @keyframes inventory-toast-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes inventory-fade {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes inventory-pop {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .inventory-rise,
          .inventory-fade-in,
          .inventory-drop,
          .inventory-toast-in,
          .inventory-fade,
          .inventory-pop,
          .inventory-excel-grid .ag-theme-alpine .ag-floating-bottom::before,
          .inventory-excel-grid .ag-theme-alpine .inventory-add-column-fixed-label {
            animation: none;
          }

          .inventory-toolbar button:hover:not(:disabled) {
            transform: none;
          }
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
