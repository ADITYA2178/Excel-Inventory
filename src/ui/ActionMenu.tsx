import * as React from 'react';
import { EllipsisVertical } from 'lucide-react';
import Button from './Button';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './Tooltip';
import { cn } from './cn';

export interface ActionMenuItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  disabledTooltip?: string;
}

interface ActionMenuProps {
  className?: string;
  disabled?: boolean;
  items: ActionMenuItem[];
  triggerClassName?: string;
  iconClassName?: string;
  iconSize?: number;
  buttonVariant?: 'tertiary' | 'ghost';
}

export const ActionMenu: React.FC<ActionMenuProps> = ({
  className = '',
  disabled = false,
  items,
  triggerClassName,
  iconClassName,
  iconSize = 16,
  buttonVariant = 'tertiary',
}) => {
  const [open, setOpen] = React.useState(false);

  return (
    <div className='inline-flex'>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            size='medium'
            variant={buttonVariant}
            icon
            className={cn('px-2', triggerClassName, className)}
            disabled={disabled}
            onClick={(event) => event.stopPropagation()}
          >
            <EllipsisVertical size={iconSize} className={iconClassName ?? 'text-gray-600'} />
          </Button>
        </PopoverTrigger>
        <PopoverContent align='end' className='w-48 rounded-lg border border-[#E9EAEB] bg-white p-2 shadow-lg'>
          <div className='py-1'>
            {items.map((item, index) => {
              const menuButton = (
                <button
                  type='button'
                  onClick={(event) => {
                    event.stopPropagation();
                    if (item.disabled) return;
                    setOpen(false);
                    item.onClick();
                  }}
                  disabled={item.disabled}
                  className={cn(
                    'flex w-full cursor-pointer items-center gap-2 rounded-md px-4 py-2 text-sm',
                    item.disabled ? 'cursor-not-allowed bg-gray-50 text-gray-400 opacity-50' : item.className || 'text-gray-700 hover:bg-blue-50',
                  )}
                >
                  <span className='flex h-4 w-4 shrink-0 items-center justify-center'>{item.icon}</span>
                  <span className='flex-1 text-left'>{item.label}</span>
                </button>
              );

              if (item.disabled && item.disabledTooltip) {
                return (
                  <TooltipProvider key={`${item.label}-${index}`}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className='inline-flex w-full'>{menuButton}</span>
                      </TooltipTrigger>
                      <TooltipContent side='left'>{item.disabledTooltip}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              }

              return (
                <div key={`${item.label}-${index}`} className='w-full'>
                  {menuButton}
                </div>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
