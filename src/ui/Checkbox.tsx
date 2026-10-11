import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { cn } from './cn';

interface CheckboxProps extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  size?: 'sm' | 'md';
}

export const Checkbox = ({ className, size = 'md', ...props }: CheckboxProps) => {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        'flex shrink-0 items-center justify-center rounded border border-slate-300 bg-white data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600',
        size === 'sm' ? 'h-4 w-4' : 'h-5 w-5',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <Check className={size === 'sm' ? 'h-3 w-3 text-white' : 'h-3.5 w-3.5 text-white'} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
};
