import * as React from 'react';
import Button from '../../../ui/Button';
import { Calculator, ChevronDown, ChevronUp, RotateCcw, Search, X } from 'lucide-react';

interface InventoryExcelToolbarProps {
  isFormulaPanelOpen: boolean;
  isSearchPanelOpen: boolean;
  searchValue: string;
  replaceValue: string;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  searchMatchCount: number;
  activeSearchMatchIndex: number;
  onReset: () => void;
  onToggleFormulas: () => void;
  onToggleSearchPanel: () => void;
  onSearchChange: (value: string) => void;
  onSearchKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onReplaceChange: (value: string) => void;
  onPreviousMatch: () => void;
  onNextMatch: () => void;
  onReplaceCurrent: () => void;
  onReplaceAll: () => void;
}

const InventoryExcelToolbar: React.FC<InventoryExcelToolbarProps> = ({
  isFormulaPanelOpen,
  isSearchPanelOpen,
  searchValue,
  replaceValue,
  searchInputRef,
  searchMatchCount,
  activeSearchMatchIndex,
  onReset,
  onToggleFormulas,
  onToggleSearchPanel,
  onSearchChange,
  onSearchKeyDown,
  onReplaceChange,
  onPreviousMatch,
  onNextMatch,
  onReplaceCurrent,
  onReplaceAll,
}) => {
  React.useEffect(() => {
    const handleOpenFindReplaceShortcut = (event: KeyboardEvent) => {
      const isFindShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f';
      if (!isFindShortcut) return;

      event.preventDefault();
      if (!isSearchPanelOpen) {
        onToggleSearchPanel();
      }

      requestAnimationFrame(() => {
        searchInputRef?.current?.focus();
      });
    };

    window.addEventListener('keydown', handleOpenFindReplaceShortcut);
    return () => {
      window.removeEventListener('keydown', handleOpenFindReplaceShortcut);
    };
  }, [isSearchPanelOpen, onToggleSearchPanel, searchInputRef]);

  const activeMatchLabel =
    searchValue.trim() && searchMatchCount > 0
      ? `${activeSearchMatchIndex + 1} of ${searchMatchCount}`
      : searchValue.trim()
        ? 'No matches'
        : 'Find & replace';

  return (
    <div className='relative flex flex-col gap-2 bg-white px-4 py-3'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex min-w-0 flex-1 flex-wrap items-center gap-3'>
          <div className='flex min-w-[320px] max-w-[520px] flex-1 items-center gap-2'>
            <div className='relative flex-1'>
              <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400' aria-hidden />
              <input
                ref={searchInputRef}
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder='Search rows, columns, or cell values'
                className='h-9 w-full rounded-lg border border-blue-100 bg-white pl-10 pr-3 text-sm text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100'
              />
            </div>
            {searchValue.trim() ? <span className='shrink-0 text-xs font-semibold text-gray-500'>{activeMatchLabel}</span> : null}
          </div>
        </div>

        <div className='flex shrink-0 flex-wrap items-center justify-end gap-2'>
          <Button
            type='button'
            size='medium'
            variant='secondary'
            icon
            onClick={onToggleFormulas}
            className={`inline-flex h-9 flex-row flex-nowrap items-center justify-center gap-2 whitespace-nowrap border-blue-100 text-gray-400 ${isFormulaPanelOpen ? 'bg-blue-50 text-blue-700' : ''}`}
          >
            <Calculator className='h-4 w-4 text-blue-700' aria-hidden />
            Formula
          </Button>
          <Button
            type='button'
            size='medium'
            variant='secondary'
            className='h-9 shrink-0 border-blue-100 text-gray-400'
            onClick={onToggleSearchPanel}
            aria-expanded={isSearchPanelOpen}
            title='Open find and replace (Ctrl+F)'
          >
            Find & replace
          </Button>
          <Button
            type='button'
            size='medium'
            variant='secondary'
            icon
            onClick={onReset}
            className='inline-flex h-9 flex-row flex-nowrap items-center justify-center gap-2 whitespace-nowrap border-blue-100 text-gray-400'
          >
            <RotateCcw className='h-4 w-4 text-blue-700' aria-hidden />
            Reset
          </Button>
        </div>
      </div>

      {isSearchPanelOpen ? (
        <div className='flex w-full items-center gap-2 rounded-lg border border-blue-100 bg-white px-2.5 py-2 shadow-sm'>
          <div className='flex shrink-0 items-center gap-2 pr-1'>
            <Search className='h-4 w-4 text-gray-400' aria-hidden />
            <span className='text-sm font-medium text-gray-700'>Search</span>
            <span className='rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500'>{activeMatchLabel}</span>
          </div>

          <div className='relative min-w-[180px] flex-1'>
            <input
              ref={searchInputRef}
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder='Find'
              className='h-9 w-full rounded-lg border border-blue-100 bg-white px-3 text-sm text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100'
              autoFocus
            />
          </div>

          <div className='flex items-center gap-1'>
            <button
              type='button'
              className='inline-flex h-9 w-9 items-center justify-center rounded-lg border border-blue-100 bg-white text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50'
              onClick={onPreviousMatch}
              disabled={!searchMatchCount}
              aria-label='Previous match'
            >
              <ChevronUp className='h-4 w-4' aria-hidden />
            </button>
            <button
              type='button'
              className='inline-flex h-9 w-9 items-center justify-center rounded-lg border border-blue-100 bg-white text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50'
              onClick={onNextMatch}
              disabled={!searchMatchCount}
              aria-label='Next match'
            >
              <ChevronDown className='h-4 w-4' aria-hidden />
            </button>
          </div>

          <div className='h-6 w-px bg-[#E2E8F0]' />

          <input
            value={replaceValue}
            onChange={(event) => onReplaceChange(event.target.value)}
            placeholder='Replace'
            className='h-9 min-w-[160px] flex-1 rounded-lg border border-blue-100 bg-white px-3 text-sm text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100'
          />
          <button
            type='button'
            className='inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-white px-3 text-sm font-bold text-gray-400 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50'
            onClick={onReplaceCurrent}
            disabled={!searchMatchCount}
          >
            Replace
          </button>
          <button
            type='button'
            className='inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 px-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100'
            onClick={onReplaceAll}
            disabled={!searchMatchCount}
          >
            All
          </button>
          <button
            type='button'
            className='inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-100'
            onClick={onToggleSearchPanel}
            aria-label='Close search and replace'
          >
            <X className='h-4 w-4' aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default InventoryExcelToolbar;
