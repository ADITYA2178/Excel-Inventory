import * as React from 'react';
import Button from '../../../ui/Button';
import Input from '../../../ui/Input';
import { Checkbox } from '../../../ui/Checkbox';
import { RadioGroup, RadioGroupItem } from '../../../ui/RadioGroup';
import { Popover, PopoverContent, PopoverTrigger } from '../../../ui/Popover';

export type ColumnTypeOption = 'NUMBER' | 'STRING';
export type RelativeColumnPosition = 'BEFORE' | 'AFTER';

export interface ColumnSettingsState {
  open: boolean;
  colKey: string;
  value: string;
  isShowIncostSheet: boolean;
  columnType: ColumnTypeOption;
  position: RelativeColumnPosition;
  referenceColumn: 'AGREEMENT_VALUE';
  isCostEditable: boolean;
  canEditName: boolean;
  isStaticHeader: boolean;
  isCreateMode: boolean;
  pendingInsertIndex: number;
  editNameMessage: string;
  anchorLeft: number;
  anchorTop: number;
}

interface ColumnSettingsPopoverProps {
  state: ColumnSettingsState;
  onStateChange: React.Dispatch<React.SetStateAction<ColumnSettingsState>>;
  onApply: () => void;
}

const resetState = (prev: ColumnSettingsState): ColumnSettingsState => ({
  ...prev,
  open: false,
  colKey: '',
  value: '',
  canEditName: true,
  columnType: 'NUMBER',
  position: 'AFTER',
  referenceColumn: 'AGREEMENT_VALUE',
  isCostEditable: true,
  isStaticHeader: false,
  isCreateMode: false,
  pendingInsertIndex: -1,
  editNameMessage: '',
});

const ColumnSettingsPopover: React.FC<ColumnSettingsPopoverProps> = ({ state, onStateChange, onApply }) => {
  const isApplyDisabled =
    (!state.canEditName && state.isStaticHeader) || (state.canEditName && !state.value.trim()) || Boolean(state.editNameMessage && state.canEditName);
  const viewportPadding = 16;
  const availableHeightPx = Math.max(220, window.innerHeight - state.anchorTop - viewportPadding);
  const popoverHeightPx = Math.min(480, availableHeightPx);
  const popoverTopPx = Math.max(8, state.anchorTop - 14);

  return (
    <div className='fixed left-0 top-0 z-[120]' style={{ left: `${state.anchorLeft}px`, top: `${popoverTopPx}px` }}>
      <Popover open={state.open} onOpenChange={(open) => (open ? null : onStateChange((prev) => resetState(prev)))}>
        <PopoverTrigger asChild>
          <button type='button' className='h-2 w-2 rounded-full opacity-0' aria-hidden tabIndex={-1} />
        </PopoverTrigger>
        <PopoverContent
          className='flex w-[340px] max-w-[calc(100vw-20px)] flex-col overflow-hidden rounded-xl border border-[#C7D2FE] bg-white p-0 shadow-[0_16px_36px_rgba(30,41,59,0.2)]'
          style={{
            height: `${popoverHeightPx}px`,
            maxHeight: `calc(100dvh - ${viewportPadding}px)`,
          }}
          align='start'
          sideOffset={8}
          disablePortal
        >
          <div className='rounded-t-xl border-b border-[#C7D2FE] bg-gradient-to-r from-[#EEF2FF] via-[#E0E7FF] to-[#F1F5F9] px-4 py-3'>
            <div className='mb-1.5 inline-flex items-center rounded-full bg-[#1E3A8A] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white'>
              Column Preferences
            </div>
            <p className='text-base font-semibold leading-5 text-[#0F172A]'>Column Settings</p>
            <p className='mt-0.5 text-[11px] text-[#334155]'>Rename, organize visibility, and control behavior.</p>
          </div>

          <div className='flex-1 space-y-3 overflow-y-auto px-4 py-4'>
            <div className='rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5'>
              <label htmlFor='column-name-input' className='mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#334155]'>
                Column name
              </label>
              <Input
                id='column-name-input'
                value={state.value}
                disabled={!state.canEditName}
                onChange={(event) => onStateChange((prev) => ({ ...prev, value: event.target.value }))}
                className='h-9 bg-white text-sm'
                aria-label='Column name'
              />
              {!state.canEditName ? <p className='mt-1 text-xs text-[#64748B]'>{state.editNameMessage}</p> : null}
              {state.canEditName && !state.value.trim() ? <p className='mt-1 text-xs text-[#B45309]'>Column name is required.</p> : null}
              {state.canEditName && state.editNameMessage ? <p className='mt-1 text-xs text-[#B91C1C]'>{state.editNameMessage}</p> : null}
            </div>

            {!state.isStaticHeader ? (
              <div className='rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5'>
                <p className='mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#334155]'>Cost Sheet Visibility</p>
                <label className='flex cursor-pointer items-center gap-2.5'>
                  <Checkbox
                    size='sm'
                    checked={state.isShowIncostSheet}
                    onCheckedChange={(checked) =>
                      onStateChange((prev) => ({
                        ...prev,
                        isShowIncostSheet: Boolean(checked),
                        columnType: checked ? 'NUMBER' : prev.columnType,
                        isCostEditable: checked ? prev.isCostEditable : false,
                      }))
                    }
                    aria-label='Toggle show in cost sheet'
                  />
                  <span className='text-xs font-medium text-[#1E293B]'>Show in cost sheet</span>
                </label>
              </div>
            ) : null}

            {state.isCreateMode ? (
              <>
                <div className='rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5'>
                  <p className='mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#334155]'>Position</p>
                  <p className='mb-1.5 text-[11px] text-[#475569]'>Reference column: Agreement Value</p>
                  <RadioGroup
                    value={state.position}
                    onValueChange={(value) => onStateChange((prev) => ({ ...prev, position: value as RelativeColumnPosition }))}
                    className='flex items-center gap-4'
                  >
                    <label htmlFor='position-before' className='flex cursor-pointer items-center gap-1.5 text-xs text-[#1E293B]'>
                      <RadioGroupItem id='position-before' value='BEFORE' size='sm' />
                      Before
                    </label>
                    <label htmlFor='position-after' className='flex cursor-pointer items-center gap-1.5 text-xs text-[#1E293B]'>
                      <RadioGroupItem id='position-after' value='AFTER' size='sm' />
                      After
                    </label>
                  </RadioGroup>
                </div>

                <div className='rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5'>
                  <p className='mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#334155]'>Column Type</p>
                  <div className='grid grid-cols-2 gap-2'>
                    {(['NUMBER', 'STRING'] as const).map((typeOption) => {
                      const isDisabled = state.isShowIncostSheet && typeOption !== 'NUMBER';
                      return (
                        <button
                          key={typeOption}
                          type='button'
                          disabled={isDisabled}
                          onClick={() => onStateChange((prev) => ({ ...prev, columnType: typeOption }))}
                          className={`h-8 rounded-md border text-[11px] font-semibold transition-colors ${
                            state.columnType === typeOption
                              ? 'border-[#1D4ED8] bg-[#DBEAFE] text-[#1E3A8A]'
                              : 'border-[#CBD5E1] bg-white text-[#334155]'
                          } ${isDisabled ? 'cursor-not-allowed opacity-45' : 'hover:border-[#94A3B8]'}`}
                        >
                          {typeOption}
                        </button>
                      );
                    })}
                  </div>
                  {state.isShowIncostSheet ? <p className='mt-1.5 text-[11px] text-[#1E40AF]'>Cost sheet columns only allow Number type.</p> : null}
                </div>

                {state.isShowIncostSheet ? (
                  <div className='rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5'>
                    <p className='mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#334155]'>Editable in Cost</p>
                    <RadioGroup
                      value={state.isCostEditable ? 'YES' : 'NO'}
                      onValueChange={(value) => onStateChange((prev) => ({ ...prev, isCostEditable: value === 'YES' }))}
                      className='flex items-center gap-4'
                    >
                      <label htmlFor='cost-editable-yes' className='flex cursor-pointer items-center gap-1.5 text-xs text-[#1E293B]'>
                        <RadioGroupItem id='cost-editable-yes' value='YES' size='sm' />
                        Yes (Editable)
                      </label>
                      <label htmlFor='cost-editable-no' className='flex cursor-pointer items-center gap-1.5 text-xs text-[#1E293B]'>
                        <RadioGroupItem id='cost-editable-no' value='NO' size='sm' />
                        No (Read-only)
                      </label>
                    </RadioGroup>
                  </div>
                ) : null}

                <div className='rounded-md border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2'>
                  <p className='text-[11px] font-semibold text-[#1E3A8A]'>
                    Preview: This column will be inserted <span className='uppercase'>{state.position.toLowerCase()}</span> Agreement Value, as{' '}
                    <span className='uppercase'>{state.columnType.toLowerCase()}</span>
                    {state.isShowIncostSheet ? `, and remain ${state.isCostEditable ? 'editable' : 'read-only'} in cost sheet.` : '.'}
                  </p>
                </div>
              </>
            ) : null}
          </div>

          <div className='sticky bottom-0 z-10 flex items-center justify-end gap-2 rounded-b-xl border-t border-[#C7D2FE] bg-[#F8FAFC] px-4 py-3'>
            <Button
              type='button'
              size='small'
              variant='secondary'
              className='h-8 min-w-[82px] rounded-md px-3 text-xs'
              onClick={() => onStateChange((prev) => resetState(prev))}
            >
              Cancel
            </Button>
            <Button type='button' size='small' className='h-8 min-w-[82px] rounded-md px-3 text-xs' disabled={isApplyDisabled} onClick={onApply}>
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default ColumnSettingsPopover;
