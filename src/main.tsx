import * as React from 'react';
import { createRoot } from 'react-dom/client';
import DemoPage from './DemoPage';
import './index.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element not found');
}

createRoot(root).render(
  <React.StrictMode>
    <DemoPage />
  </React.StrictMode>,
);
