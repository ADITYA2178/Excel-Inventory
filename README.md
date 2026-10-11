# Excel Inventory

Standalone spreadsheet for inventory-style sheets. It edits cells, formulas, columns, and find-and-replace without the Justo app.

## Run the demo

```bash
npm install
npm run dev
```

Open the URL Vite prints. The sheet starts with sample units. Amount is calculated as Carpet Area × Rate.

Save downloads a CSV and logs the sheet matrix in the browser console.

## Use it from another app

```bash
npm run build
```

Peer dependencies: `react`, `react-dom`, `ag-grid-community`, `ag-grid-react`, and `lucide-react`.
