import * as React from 'react';
import Button from './Button';

interface ConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  description: string;
  buttonText?: string;
  variant?: 'delete' | 'confirm' | 'info';
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({ open, onClose, onConfirm, title, description, buttonText = 'Confirm' }) => {
  if (!open) return null;

  return (
    <div className='fixed inset-0 z-[180] flex items-center justify-center bg-slate-900/40 p-4' role='presentation' onClick={onClose}>
      <div
        role='dialog'
        aria-modal='true'
        aria-labelledby='excel-confirm-title'
        className='w-full max-w-md rounded-xl bg-white p-5 shadow-xl'
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id='excel-confirm-title' className='text-lg font-semibold text-slate-900'>
          {title}
        </h3>
        <p className='mt-2 text-sm text-slate-600'>{description}</p>
        <div className='mt-5 flex justify-end gap-2'>
          <Button variant='tertiary' onClick={onClose}>
            Cancel
          </Button>
          <Button className='bg-red-600 px-4 text-white hover:bg-red-700' onClick={onConfirm}>
            {buttonText}
          </Button>
        </div>
      </div>
    </div>
  );
};
