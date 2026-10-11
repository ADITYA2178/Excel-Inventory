import * as React from 'react';

interface ToastItem {
  id: number;
  tone: 'error' | 'success';
  message: string;
}

let toasts: ToastItem[] = [];
const listeners = new Set<() => void>();
let nextId = 1;

const emit = () => {
  listeners.forEach((listener) => listener());
};

const pushToast = (tone: ToastItem['tone'], message: string) => {
  const id = nextId;
  nextId += 1;
  toasts = [...toasts, { id, tone, message }];
  emit();
  window.setTimeout(() => {
    toasts = toasts.filter((item) => item.id !== id);
    emit();
  }, 3200);
};

export const toast = {
  error: (message: string) => pushToast('error', message),
  success: (message: string) => pushToast('success', message),
};

export const ToastViewport: React.FC = () => {
  const items = React.useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => toasts,
  );

  if (!items.length) return null;

  return (
    <div className='pointer-events-none fixed bottom-4 right-4 z-[200] flex w-[320px] flex-col gap-2'>
      {items.map((item) => (
        <div
          key={item.id}
          role='status'
          className={`inventory-toast-in pointer-events-auto rounded-lg px-3 py-2 text-sm text-white shadow-lg ${item.tone === 'error' ? 'bg-red-600' : 'bg-slate-900'}`}
        >
          {item.message}
        </div>
      ))}
    </div>
  );
};
