import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from './cn';

export const Popover = (props: React.ComponentProps<typeof PopoverPrimitive.Root>) => {
  return <PopoverPrimitive.Root {...props} />;
};

export const PopoverTrigger = (props: React.ComponentProps<typeof PopoverPrimitive.Trigger>) => {
  return <PopoverPrimitive.Trigger {...props} />;
};

export const PopoverContent = ({
  className,
  align = 'end',
  sideOffset = 4,
  disablePortal = false,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content> & { disablePortal?: boolean }) => {
  const content = <PopoverPrimitive.Content align={align} sideOffset={sideOffset} className={cn('z-50 outline-none', className)} {...props} />;
  return disablePortal ? content : <PopoverPrimitive.Portal>{content}</PopoverPrimitive.Portal>;
};
