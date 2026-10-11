import * as React from 'react';
import { cn } from './cn';

interface ButtonProps extends React.ComponentProps<'button'> {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'ghost';
  size?: 'small' | 'medium';
  icon?: boolean;
}

const Button = ({ className, variant = 'primary', size = 'medium', icon, type = 'button', ...props }: ButtonProps) => {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'small' ? 'h-8 px-2' : 'h-9 px-3',
        icon ? 'px-2' : '',
        variant === 'secondary' ? 'border border-slate-200 bg-white text-gray-700 hover:bg-slate-50' : '',
        variant === 'tertiary' || variant === 'ghost' ? 'bg-transparent text-gray-700 hover:bg-gray-100' : '',
        className,
      )}
      {...props}
    />
  );
};

export default Button;
