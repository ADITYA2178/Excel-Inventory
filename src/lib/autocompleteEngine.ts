export interface FormulaSuggestion {
  value: string;
  type: 'column' | 'operator' | 'template' | 'function';
  group: string;
  description?: string;
  insertText?: string;
}

const OPERATORS = [
  { value: '+', description: 'Addition' },
  { value: '-', description: 'Subtraction' },
  { value: '*', description: 'Multiplication' },
  { value: '/', description: 'Division' },
  { value: '%', description: 'Percentage (left value % right value)' },
];

const COMPARISON_OPERATORS = [
  { value: '>', description: 'Greater than' },
  { value: '<', description: 'Less than' },
  { value: '>=', description: 'Greater than or equal' },
  { value: '<=', description: 'Less than or equal' },
  { value: '=', description: 'Equal to' },
  { value: '!=', description: 'Not equal to' },
];

const FORMULA_FUNCTIONS = [
  {
    value: 'IF',
    description: 'If condition is true, return first value; otherwise return second (supports text and numbers)',
    insertText: 'IF(,,)',
  },
];

const MAX_SUGGESTIONS = 10;

const getCurrentToken = (input: string, cursorPosition: number) => {
  const leftPart = input.slice(0, cursorPosition);
  const tokenMatch = leftPart.match(/[A-Za-z0-9 _-]+$/);
  return tokenMatch?.[0]?.trimStart() ?? '';
};

const getLastMeaningfulChar = (input: string, cursorPosition: number) => {
  const leftPart = input.slice(0, cursorPosition).replace(/\s+$/g, '');
  return leftPart[leftPart.length - 1] ?? '';
};

const normalizeSuggestionText = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '');

const buildTemplateSuggestions = (columns: string[]) => {
  const a = columns[0] ?? 'A';
  const b = columns[1] ?? 'B';
  const c = columns[2] ?? 'C';
  return [
    `=${a}+${b}`,
    `=${a}-${b}`,
    `=${a}*${b}`,
    `=${a}/${b}`,
    `=IF(${a}>0,${a},0)`,
    `=IF(${a}>${b},${a},${b})`,
    `=IF(${a}>0,${a}*${b},0)`,
    `=IF(${a}="${b}","Yes","No")`,
    `=IF(${a}==2BHK,${b}%10,${b}%20)`,
    `=IF(${a}="${b}",${a},${b})`,
    `=(${a}+${b})*${c}`,
    `=${a}*(${b}+${c})`,
    `=(${a}+${b})/${c}`,
    `=(${a}-${b})*${c}`,
    `=(${a}+${b})-(${c})`,
  ];
};

const isSameSuggestion = (left: FormulaSuggestion, right: FormulaSuggestion) =>
  left.type === right.type && left.value.toUpperCase() === right.value.toUpperCase();

const uniqueSuggestions = (suggestions: FormulaSuggestion[]) =>
  suggestions.filter((suggestion, index) => suggestions.findIndex((item) => isSameSuggestion(item, suggestion)) === index);

export const getFormulaSuggestions = (input: string, cursorPosition: number, columns: string[]): FormulaSuggestion[] => {
  if (!input.startsWith('=')) {
    return [];
  }

  const token = getCurrentToken(input, cursorPosition).toUpperCase();
  const normalizedToken = normalizeSuggestionText(token);
  const lastChar = getLastMeaningfulChar(input, cursorPosition);
  const atExpressionStart = cursorPosition <= 1 || input.slice(0, cursorPosition).trim() === '=';
  const isAfterOperator = !token && ['+', '-', '*', '/', '%'].includes(lastChar);
  const expectsOperand = !token && (atExpressionStart || ['+', '-', '*', '/', '%', '(', ','].includes(lastChar));
  const expectsComparisonOperand = !token && ['>', '<', '=', '!'].includes(lastChar);
  const hasTypedIdentifier = token.length > 0;
  const isCompletedColumnToken = columns.some((column) => normalizeSuggestionText(column) === normalizedToken);
  const isInsideIfCondition = /IF\s*\([^,)]*$/i.test(input.slice(0, cursorPosition));

  const templateSuggestions = buildTemplateSuggestions(columns)
    .filter((template) => !normalizedToken || normalizeSuggestionText(template).includes(normalizedToken))
    .map((template) => ({
      value: template,
      type: 'template' as const,
      group: 'Templates',
      description: 'Ready formula pattern',
      insertText: template,
    }));

  const columnSuggestions = columns
    .filter((column) => {
      if (expectsOperand || expectsComparisonOperand) return true;
      if (hasTypedIdentifier) return normalizeSuggestionText(column).startsWith(normalizedToken);
      return false;
    })
    .map((column) => ({
      value: column,
      type: 'column' as const,
      group: 'Columns',
      description: 'Use this column from the current row',
    }));

  const functionSuggestions = FORMULA_FUNCTIONS.filter(({ value }) => {
    if (!hasTypedIdentifier) return expectsOperand || atExpressionStart;
    return normalizeSuggestionText(value).startsWith(normalizedToken);
  }).map(({ value, description, insertText }) => ({
    value,
    type: 'function' as const,
    group: 'IF',
    description,
    insertText,
  }));

  const operatorSuggestions = OPERATORS.filter(({ value }) => {
    if (token && !isCompletedColumnToken) return value.startsWith(token);
    if (hasTypedIdentifier && !isCompletedColumnToken) return false;
    return /[A-Za-z0-9)]/.test(lastChar);
  }).map(({ value, description }) => ({
    value,
    type: 'operator' as const,
    group: 'Arithmetic Operators',
    description,
    insertText: value,
  }));

  const comparisonSuggestions = COMPARISON_OPERATORS.filter(({ value }) => {
    if (isInsideIfCondition || expectsComparisonOperand) {
      if (!hasTypedIdentifier) return true;
      return value.startsWith(token);
    }
    if (hasTypedIdentifier && !isCompletedColumnToken) return false;
    return /[A-Za-z0-9)]/.test(lastChar);
  }).map(({ value, description }) => ({
    value,
    type: 'operator' as const,
    group: 'Comparison Operators',
    description,
    insertText: value,
  }));

  if (isCompletedColumnToken) {
    return uniqueSuggestions([
      ...(isInsideIfCondition ? comparisonSuggestions : []),
      ...operatorSuggestions,
      ...columnSuggestions.filter((suggestion) => suggestion.value.toUpperCase() !== token),
    ]).slice(0, MAX_SUGGESTIONS);
  }

  if (isAfterOperator) {
    return uniqueSuggestions([...functionSuggestions, ...columnSuggestions]).slice(0, MAX_SUGGESTIONS);
  }

  if (expectsOperand || hasTypedIdentifier) {
    return uniqueSuggestions([
      ...functionSuggestions,
      ...columnSuggestions,
      ...operatorSuggestions,
      ...(isInsideIfCondition ? comparisonSuggestions : []),
    ]).slice(0, MAX_SUGGESTIONS);
  }

  return uniqueSuggestions([
    ...templateSuggestions,
    ...functionSuggestions,
    ...columnSuggestions,
    ...operatorSuggestions,
    ...comparisonSuggestions,
  ]).slice(0, MAX_SUGGESTIONS);
};
