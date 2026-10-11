import * as React from 'react';
import Button from '../../../ui/Button';
import { AlertCircle, Calculator, Check, ChevronDown, ChevronRight, Sparkles, Target, Wand2 } from 'lucide-react';
import type { FormulaSuggestion } from '../../autocompleteEngine';

interface FormulaBuilderPanelProps {
  isOpen: boolean;
  selectedCell: { rowIndex: number; colKey: string } | null;
  selectedColumnKey: string | null;
  selectedCellLabel?: string | null;
  selectedColumnLabel?: string | null;
  quickTemplateColumns?: string[];
  formulaInput: string;
  formulaPanelInputRef: React.RefObject<HTMLTextAreaElement | null>;
  panelSuggestions: FormulaSuggestion[];
  panelActiveIndex: number;
  onFormulaInputChange: (value: string, cursor: number) => void;
  onFormulaInputFocus: () => void;
  onFormulaInputClick: () => void;
  onFormulaInputKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSuggestionMouseDown: (suggestion: FormulaSuggestion) => void;
  onApplyFormula: () => void;
  onTemplateClick: (template: string) => void;
  formulaError?: string | null;
}

const formatFormulaPreview = (formula: string) => formula.replace(/,(?=IF\()/gi, ',\n  ').replace(/,(?=[^)]*$)/, ',\n  ');

const FormulaBuilderPanel: React.FC<FormulaBuilderPanelProps> = ({
  isOpen,
  selectedCell,
  selectedColumnKey,
  selectedCellLabel,
  selectedColumnLabel,
  quickTemplateColumns = [],
  formulaInput,
  formulaPanelInputRef,
  panelSuggestions,
  panelActiveIndex,
  onFormulaInputChange,
  onFormulaInputFocus,
  onFormulaInputClick,
  onFormulaInputKeyDown,
  onSuggestionMouseDown,
  onApplyFormula,
  onTemplateClick,
  formulaError = null,
}) => {
  const isApplyDisabled = Boolean(selectedCell) || !selectedColumnKey || Boolean(formulaError);
  const suggestionsListId = React.useId();
  const [isIfGuideOpen, setIsIfGuideOpen] = React.useState(false);
  const activeSuggestionId = panelSuggestions.length ? `${suggestionsListId}-option-${panelActiveIndex}` : undefined;
  const targetLabel = selectedCell
    ? `${selectedCellLabel ?? selectedCell.colKey}${selectedCell.rowIndex + 1}`
    : selectedColumnKey
      ? (selectedColumnLabel ?? selectedColumnKey)
      : 'No cell or column selected';
  const targetMode = selectedCell ? 'Selected cell' : selectedColumnKey ? 'Selected column' : 'Target required';

  const [templateRefA, templateRefB, templateRefC] = React.useMemo(() => {
    const cleanedRefs = quickTemplateColumns.map((label) => String(label ?? '').trim()).filter(Boolean);
    const uniqueRefs = Array.from(new Set(cleanedRefs));
    const first = uniqueRefs[0] ?? 'A';
    const second = uniqueRefs[1] ?? first;
    const third = uniqueRefs[2] ?? second;
    return [first, second, third];
  }, [quickTemplateColumns]);

  const matchedColumnRefs = React.useMemo(() => {
    const cleanedRefs = quickTemplateColumns.map((label) => String(label ?? '').trim()).filter(Boolean);

    const normalizeLabel = (label: string) => label.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedRefs = cleanedRefs.map((label) => ({ label, normalized: normalizeLabel(label) }));

    const findLabelByPriority = (candidates: string[]) =>
      normalizedRefs.find(({ normalized }) => candidates.some((candidate) => normalized.includes(candidate)))?.label ?? null;

    return {
      basePrice: findLabelByPriority(['baseprice', 'baseamount', 'rate', 'unitprice']),
      carpetArea: findLabelByPriority(['carpetarea', 'carpet']),
      configuration: findLabelByPriority(['configuration', 'config', 'bhk']),
    };
  }, [quickTemplateColumns]);

  const quickTemplates = React.useMemo(() => {
    const { basePrice, carpetArea, configuration } = matchedColumnRefs;
    const configCol = configuration ?? templateRefA;
    const priceCol = basePrice ?? templateRefB;
    const areaCol = carpetArea ?? templateRefC;

    return [
      {
        id: 'four-bhk',
        label: '1–4 BHK pricing',
        description: '5%, 10%, 15%, 20% of base price',
        formula: `=IF(${configCol}==1BHK,${priceCol}%5,IF(${configCol}==2BHK,${priceCol}%10,IF(${configCol}==3BHK,${priceCol}%15,${priceCol}%20)))`,
      },
      {
        id: 'price-area',
        label: 'Price × area',
        description: 'Base price multiplied by carpet area',
        formula: `=${priceCol}*${areaCol}`,
      },
      {
        id: 'two-bhk',
        label: '2 BHK vs others',
        description: '10% for 2 BHK, 20% for all other types',
        formula: `=IF(${configCol}==2BHK,${priceCol}%10,${priceCol}%20)`,
      },
    ];
  }, [matchedColumnRefs, templateRefA, templateRefB, templateRefC]);

  const getSuggestionTypeClassName = (type: FormulaSuggestion['type']) => {
    if (type === 'function') return 'bg-violet-50 text-violet-700 ring-violet-100';
    if (type === 'column') return 'bg-blue-50 text-blue-700 ring-blue-100';
    if (type === 'operator') return 'bg-amber-50 text-amber-700 ring-amber-100';
    return 'bg-slate-100 text-slate-600 ring-slate-200';
  };

  const resizeFormulaInput = React.useCallback(() => {
    const textarea = formulaPanelInputRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, 120), 220);
    textarea.style.height = `${nextHeight}px`;
  }, [formulaPanelInputRef]);

  React.useEffect(() => {
    if (!isOpen) return;
    const focusTimer = window.setTimeout(() => {
      formulaPanelInputRef.current?.focus();
      resizeFormulaInput();
    }, 520);
    return () => window.clearTimeout(focusTimer);
  }, [formulaPanelInputRef, isOpen, resizeFormulaInput]);

  React.useEffect(() => {
    if (!isOpen) return;
    resizeFormulaInput();
  }, [formulaInput, isOpen, resizeFormulaInput]);

  const handleTemplateInsert = (formula: string) => {
    onTemplateClick(formula);
    requestAnimationFrame(() => {
      const textarea = formulaPanelInputRef.current;
      textarea?.focus();
      resizeFormulaInput();
    });
  };

  return (
    <aside
      className={`h-full w-full min-w-0 overflow-hidden rounded-xl border bg-white transition-[border-color] duration-300 ease-out ${
        isOpen ? 'border-[#E5EAF3] pointer-events-auto' : 'border-transparent pointer-events-none'
      }`}
      aria-hidden={!isOpen}
    >
      <div
        className={`flex h-full w-full min-w-0 flex-col transition-[opacity,transform] duration-300 ease-out ${
          isOpen ? 'translate-x-0 opacity-100 delay-150' : 'translate-x-3 opacity-0 delay-0'
        }`}
      >
        <div className='border-b border-[#E5EAF3] bg-white px-4 py-3'>
          <div className='flex items-start justify-between gap-3'>
            <div className='flex items-start gap-3'>
              <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F8FAFC] text-blue-700 ring-1 ring-[#E5EAF3]'>
                <Calculator className='h-4 w-4' aria-hidden />
              </div>
              <div className='min-w-0'>
                <p className='text-sm font-bold text-slate-900'>Formula Builder</p>
                <p className='mt-0.5 text-[11px] leading-4 text-slate-500'>Columns, IF/ELSE, and arithmetic.</p>
              </div>
            </div>
            <span className='rounded-full border border-[#E5EAF3] bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700'>
              Beta
            </span>
          </div>
        </div>

        <div className='min-h-0 min-w-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto p-3'>
          <section className='rounded-lg border border-[#E5EAF3] bg-white p-3'>
            <div className='flex items-center gap-2'>
              <Target className='h-4 w-4 text-blue-600' aria-hidden />
              <p className='text-[11px] font-bold uppercase tracking-wide text-slate-500'>{targetMode}</p>
            </div>
            <div
              className={`mt-2 rounded-lg border px-3 py-2 ${
                selectedCell || selectedColumnKey ? 'border-[#D5E3F7] bg-[#F8FAFC] text-blue-900' : 'border-amber-100 bg-amber-50 text-amber-800'
              }`}
            >
              <p className='truncate text-sm font-bold'>{targetLabel}</p>
              <p className='mt-0.5 text-[11px] opacity-75'>
                {selectedCell
                  ? 'Select a column header to apply a formula.'
                  : selectedColumnKey
                    ? 'Formula applies to every row in this column.'
                    : 'Select a column in the sheet first.'}
              </p>
            </div>
          </section>

          <section className='min-w-0 rounded-lg border border-[#E5EAF3] bg-white p-3'>
            <div className='mb-2 flex items-center justify-between gap-2'>
              <p className='text-[11px] font-bold uppercase tracking-wide text-slate-500'>Formula</p>
              <span className='rounded-full border border-[#E5EAF3] bg-[#F8FAFC] px-2 py-0.5 text-[10px] font-semibold text-slate-500'>
                Start with =
              </span>
            </div>

            <div className='min-w-0'>
              <textarea
                ref={formulaPanelInputRef}
                value={formulaInput}
                rows={5}
                spellCheck={false}
                onChange={(event) => {
                  onFormulaInputChange(event.target.value, event.target.selectionStart ?? event.target.value.length);
                  resizeFormulaInput();
                }}
                onFocus={onFormulaInputFocus}
                onClick={onFormulaInputClick}
                onKeyDown={onFormulaInputKeyDown}
                role='combobox'
                aria-autocomplete='list'
                aria-expanded={Boolean(panelSuggestions.length)}
                aria-controls={panelSuggestions.length ? suggestionsListId : undefined}
                aria-activedescendant={activeSuggestionId}
                placeholder={
                  selectedCell
                    ? `For ${selectedCellLabel ?? selectedCell.colKey}${selectedCell.rowIndex + 1}`
                    : selectedColumnKey
                      ? `For column ${selectedColumnLabel ?? selectedColumnKey}`
                      : 'Select a column, then type = to start'
                }
                className='block min-h-[120px] max-h-[220px] w-full resize-y overflow-y-auto rounded-lg border border-[#D8E1EE] bg-[#FAFBFD] px-3 py-2.5 font-mono text-[12px] leading-5 text-slate-800 outline-none transition-[border-color,box-shadow] placeholder:font-sans placeholder:text-[13px] placeholder:font-medium placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-50'
              />
              {panelSuggestions.length ? (
                <div
                  id={suggestionsListId}
                  role='listbox'
                  className='mt-1.5 max-h-48 w-full min-w-0 overflow-x-hidden overflow-y-auto rounded-lg border border-[#D8E1EE] bg-white p-1.5 shadow-[0_4px_16px_rgba(15,23,42,0.08)]'
                >
                  {panelSuggestions.map((suggestion, index) => {
                    const shouldShowGroup = index === 0 || panelSuggestions[index - 1]?.group !== suggestion.group;
                    const suggestionId = `${suggestionsListId}-option-${index}`;

                    return (
                      <React.Fragment key={`${suggestion.value}-${suggestion.type}-panel`}>
                        {shouldShowGroup ? (
                          <div className='px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-slate-400'>{suggestion.group}</div>
                        ) : null}
                        <Button
                          id={suggestionId}
                          type='button'
                          variant='tertiary'
                          size='small'
                          role='option'
                          aria-selected={index === panelActiveIndex}
                          tabIndex={-1}
                          className={`block h-auto w-full max-w-full min-w-0 overflow-hidden rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                            index === panelActiveIndex
                              ? 'bg-[#F1F6FF] text-slate-900 ring-1 ring-[#D5E3F7]'
                              : 'bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            onSuggestionMouseDown(suggestion);
                          }}
                          onClick={(event) => {
                            if (event.detail === 0) {
                              onSuggestionMouseDown(suggestion);
                            }
                          }}
                        >
                          <span className='flex items-center justify-between gap-2'>
                            <span className='min-w-0 truncate font-mono text-[12px] font-bold'>{suggestion.value}</span>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ring-1 ${getSuggestionTypeClassName(suggestion.type)}`}
                            >
                              {suggestion.type}
                            </span>
                          </span>
                          {suggestion.description ? (
                            <span className='mt-0.5 block break-words text-[10px] font-medium leading-4 text-slate-400'>
                              {suggestion.description}
                            </span>
                          ) : null}
                        </Button>
                      </React.Fragment>
                    );
                  })}
                </div>
              ) : null}
            </div>

            {formulaError ? (
              <div role='alert' className='mt-2 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2'>
                <AlertCircle className='mt-0.5 h-4 w-4 shrink-0 text-amber-600' aria-hidden />
                <div className='min-w-0'>
                  <p className='text-[11px] font-bold leading-4 text-amber-950'>This formula will not work</p>
                  <p className='mt-1 text-[11px] leading-4 text-amber-900'>{formulaError}</p>
                </div>
              </div>
            ) : null}

            <p className='mt-2 text-[10px] leading-4 text-slate-400'>
              <span className='font-medium text-slate-500'>Enter</span> to pick a suggestion ·{' '}
              <span className='font-medium text-slate-500'>Shift+Enter</span> for a new line
            </p>

            <button
              type='button'
              className='mt-2 flex w-full items-center gap-1.5 rounded-lg border border-[#E5EAF3] bg-[#F8FAFC] px-2.5 py-2 text-left transition-colors hover:bg-slate-50'
              onClick={() => setIsIfGuideOpen((open) => !open)}
              aria-expanded={isIfGuideOpen}
            >
              {isIfGuideOpen ? (
                <ChevronDown className='h-3.5 w-3.5 shrink-0 text-slate-500' aria-hidden />
              ) : (
                <ChevronRight className='h-3.5 w-3.5 shrink-0 text-slate-500' aria-hidden />
              )}
              <Sparkles className='h-3.5 w-3.5 shrink-0 text-blue-600' aria-hidden />
              <span className='text-[10px] font-bold uppercase tracking-wide text-slate-500'>IF guide (1–4 BHK)</span>
            </button>
            {isIfGuideOpen ? (
              <div className='mt-2 rounded-lg border border-[#E5EAF3] bg-[#F8FAFC] px-2.5 py-2'>
                <p className='text-[11px] leading-4 text-slate-600'>Chain IF for each BHK. The last value is the default (4 BHK).</p>
                <pre className='mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-white px-2 py-1.5 font-mono text-[10px] leading-4 text-slate-600 ring-1 ring-[#E5EAF3]'>
                  {`=IF(Configuration==1BHK, value1,\n  IF(Configuration==2BHK, value2,\n    IF(Configuration==3BHK, value3, value4)))`}
                </pre>
              </div>
            ) : null}
          </section>

          <section className='rounded-lg border border-[#E5EAF3] bg-white p-3'>
            <div className='mb-3 flex items-center justify-between gap-2'>
              <div className='flex items-center gap-2'>
                <Wand2 className='h-4 w-4 text-blue-600' aria-hidden />
                <p className='text-[11px] font-bold uppercase tracking-wide text-slate-500'>Quick Templates</p>
              </div>
            </div>

            <div className='space-y-2.5'>
              {quickTemplates.map((template) => (
                <article key={template.id} className='overflow-hidden rounded-lg border border-[#E5EAF3] bg-white transition-shadow hover:shadow-sm'>
                  <div className='flex items-start justify-between gap-2 border-b border-[#F0F4FA] bg-[#FAFBFD] px-3 py-2.5'>
                    <div className='min-w-0 flex-1'>
                      <p className='text-[12px] font-bold text-slate-800'>{template.label}</p>
                      <p className='mt-0.5 text-[10px] leading-4 text-slate-500'>{template.description}</p>
                    </div>
                    <Button
                      type='button'
                      variant='tertiary'
                      size='small'
                      className='shrink-0 rounded-md bg-blue-700 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-blue-800'
                      onClick={() => handleTemplateInsert(template.formula)}
                    >
                      Insert
                    </Button>
                  </div>
                  <pre className='max-h-[88px] overflow-y-auto whitespace-pre-wrap break-words px-3 py-2.5 font-mono text-[10px] leading-[1.35] text-blue-800'>
                    {formatFormulaPreview(template.formula)}
                  </pre>
                </article>
              ))}
            </div>
          </section>
        </div>

        <div className='shrink-0 border-t border-[#E5EAF3] bg-white p-3'>
          <Button
            type='button'
            size='small'
            disabled={isApplyDisabled}
            title={formulaError ?? undefined}
            className='inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-700 text-xs font-bold text-white transition-colors hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-50 disabled:cursor-not-allowed disabled:opacity-50'
            onClick={onApplyFormula}
          >
            <Check className='h-4 w-4' aria-hidden />
            {selectedCell ? 'Select Column to Apply' : selectedColumnKey ? 'Apply to Column' : 'Apply Formula'}
          </Button>
        </div>
      </div>
    </aside>
  );
};

export default FormulaBuilderPanel;
