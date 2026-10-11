import * as React from 'react';
import { cn } from './cn';

const Input = ({ className, ...props }: React.ComponentProps<'input'>) => {
  return (
    <input
      className={cn(
        'h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100',
        className,
      )}
      {...props}
    />
  );
};

export default Input;
