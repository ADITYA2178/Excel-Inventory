export type FormulaValue = number | string;

const OPERATOR_PRECEDENCE: Record<string, number> = {
  '+': 1,
  '-': 1,
  '*': 2,
  '/': 2,
  '%': 2,
};

const COMPARISON_OPERATORS = new Set(['>', '<', '>=', '<=', '=', '==', '!=', '<>']);

const isOperator = (token: string) => ['+', '-', '*', '/', '%'].includes(token);

const isComparisonOperator = (token: string) => COMPARISON_OPERATORS.has(token);

const isStringLiteral = (token: string) => (token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"));

const getStringLiteralValue = (token: string) => token.slice(1, -1);

const isNumericLiteral = (token: string) => /^-?\d+(\.\d+)?$/.test(token);

const isReference = (token: string) => /^[A-Z]+[0-9]*$/i.test(token);

const FORMULA_FUNCTION_NAMES = new Set(['IF']);

/** Values like 2BHK, RTB (not a column ref, not a number) used without quotes in IF conditions. */
const isUnquotedStringOperand = (token: string) => {
  if (!token || isStringLiteral(token) || isNumericLiteral(token) || isReference(token)) {
    return false;
  }
  if (FORMULA_FUNCTION_NAMES.has(token.toUpperCase())) {
    return false;
  }
  return /^[A-Za-z0-9_-]+$/.test(token);
};

const readComparisonOperator = (source: string, index: number) => {
  const pair = source.slice(index, index + 2);
  if (pair === '>=' || pair === '<=' || pair === '<>' || pair === '!=' || pair === '==') {
    return { operator: pair, length: 2 };
  }
  const char = source[index];
  if (char === '>' || char === '<' || char === '=') {
    return { operator: char, length: 1 };
  }
  return null;
};

const stripWhitespaceOutsideStrings = (source: string) => {
  let result = '';
  let inQuote: '"' | "'" | null = null;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (inQuote) {
      result += char;
      if (char === inQuote) {
        inQuote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inQuote = char;
      result += char;
      continue;
    }

    if (/\s/.test(char)) {
      continue;
    }

    result += char;
  }

  return result;
};

export const parseRawCellAsFormulaValue = (raw: string): FormulaValue => {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('=')) {
    throw new Error('Formula cell must be evaluated before reading its value');
  }
  if (isNumericLiteral(trimmed)) {
    return Number(trimmed);
  }
  return trimmed;
};

export const formatFormulaValue = (value: FormulaValue): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (!Number.isFinite(value)) {
    throw new Error('Invalid number');
  }
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
};

const coerceToNumber = (value: FormulaValue): number => {
  if (typeof value === 'number') {
    return value;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }
  if (isNumericLiteral(trimmed)) {
    return Number(trimmed);
  }
  throw new Error('Expected a numeric value');
};

const isTruthyFormulaValue = (value: FormulaValue) => {
  if (typeof value === 'number') {
    return value !== 0;
  }
  return value.trim() !== '';
};

const compareValues = (left: FormulaValue, operator: string, right: FormulaValue): boolean => {
  const leftText = typeof left === 'string' ? left : String(left);
  const rightText = typeof right === 'string' ? right : String(right);
  const leftNumber = typeof left === 'number' ? left : Number(left);
  const rightNumber = typeof right === 'number' ? right : Number(right);
  const canCompareAsNumbers = typeof left === 'number' && typeof right === 'number' && Number.isFinite(leftNumber) && Number.isFinite(rightNumber);

  if (operator === '=' || operator === '==') {
    if (canCompareAsNumbers) {
      return leftNumber === rightNumber;
    }
    return leftText === rightText;
  }

  if (operator === '!=' || operator === '<>') {
    if (canCompareAsNumbers) {
      return leftNumber !== rightNumber;
    }
    return leftText !== rightText;
  }

  if (canCompareAsNumbers) {
    if (operator === '>') return leftNumber > rightNumber;
    if (operator === '<') return leftNumber < rightNumber;
    if (operator === '>=') return leftNumber >= rightNumber;
    if (operator === '<=') return leftNumber <= rightNumber;
  }

  const comparison = leftText.localeCompare(rightText);
  if (operator === '>') return comparison > 0;
  if (operator === '<') return comparison < 0;
  if (operator === '>=') return comparison >= 0;
  if (operator === '<=') return comparison <= 0;

  throw new Error('Invalid comparison');
};

export const tokenizeFormula = (formulaBody: string): string[] => {
  const cleaned = stripWhitespaceOutsideStrings(formulaBody);
  const tokens: string[] = [];
  let current = '';

  for (let index = 0; index < cleaned.length; index += 1) {
    const char = cleaned[index];

    if (char === '"' || char === "'") {
      if (current) {
        tokens.push(current);
        current = '';
      }

      const quote = char;
      let literal = quote;
      index += 1;
      while (index < cleaned.length && cleaned[index] !== quote) {
        literal += cleaned[index];
        index += 1;
      }
      if (index >= cleaned.length || cleaned[index] !== quote) {
        throw new Error('Unclosed string literal');
      }
      literal += quote;
      tokens.push(literal);
      continue;
    }

    if (/[A-Za-z0-9.]/.test(char)) {
      current += char;
      continue;
    }

    if (current) {
      tokens.push(current);
      current = '';
    }

    const comparisonOperator = readComparisonOperator(cleaned, index);
    if (comparisonOperator) {
      tokens.push(comparisonOperator.operator);
      index += comparisonOperator.length - 1;
      continue;
    }

    if (char === '!' && cleaned[index + 1] === '=') {
      tokens.push('!=');
      index += 1;
      continue;
    }

    if (isOperator(char) || char === '(' || char === ')' || char === ',') {
      tokens.push(char);
    } else {
      throw new Error('Invalid token');
    }
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
};

export const infixToPostfix = (tokens: string[]): string[] => {
  const output: string[] = [];
  const operators: string[] = [];

  tokens.forEach((token) => {
    if (isNumericLiteral(token) || isReference(token)) {
      output.push(token);
      return;
    }

    if (isOperator(token)) {
      while (
        operators.length &&
        isOperator(operators[operators.length - 1]) &&
        OPERATOR_PRECEDENCE[operators[operators.length - 1]] >= OPERATOR_PRECEDENCE[token]
      ) {
        output.push(operators.pop() as string);
      }
      operators.push(token);
      return;
    }

    if (token === '(') {
      operators.push(token);
      return;
    }

    if (token === ')') {
      while (operators.length && operators[operators.length - 1] !== '(') {
        output.push(operators.pop() as string);
      }
      if (!operators.length) {
        throw new Error('Mismatched parentheses');
      }
      operators.pop();
      return;
    }

    throw new Error('Invalid expression');
  });

  while (operators.length) {
    const op = operators.pop() as string;
    if (op === '(' || op === ')') {
      throw new Error('Mismatched parentheses');
    }
    output.push(op);
  }

  return output;
};

export const evaluatePostfix = (postfixTokens: string[], resolveReference: (ref: string) => number): number => {
  const stack: number[] = [];

  postfixTokens.forEach((token) => {
    if (isNumericLiteral(token)) {
      stack.push(Number(token));
      return;
    }

    if (isReference(token)) {
      stack.push(resolveReference(token));
      return;
    }

    if (!isOperator(token) || stack.length < 2) {
      throw new Error('Invalid expression');
    }

    const right = stack.pop() as number;
    const left = stack.pop() as number;

    if (token === '+') stack.push(left + right);
    if (token === '-') stack.push(left - right);
    if (token === '*') stack.push(left * right);
    if (token === '/') {
      if (right === 0) {
        throw new Error('Division by zero');
      }
      stack.push(left / right);
    }
    if (token === '%') stack.push((left * right) / 100);
  });

  if (stack.length !== 1) {
    throw new Error('Invalid expression');
  }

  return stack[0];
};

const evaluateTokens = (tokens: string[], resolveReference: (ref: string) => FormulaValue): FormulaValue => {
  let currentIndex = 0;

  const peek = () => tokens[currentIndex];
  const consume = () => tokens[currentIndex++];

  const parsePrimaryValue = (): FormulaValue => {
    const token = consume();

    if (!token) {
      throw new Error('Invalid expression');
    }

    if (token === '(') {
      const value = parseExpression();
      if (consume() !== ')') {
        throw new Error('Mismatched parentheses');
      }
      return value;
    }

    if (isStringLiteral(token)) {
      return getStringLiteralValue(token);
    }

    if (isUnquotedStringOperand(token)) {
      return token;
    }

    if (isNumericLiteral(token)) {
      return Number(token);
    }

    if (token.toUpperCase() === 'IF' && peek() === '(') {
      return parseIfExpression();
    }

    if (isReference(token)) {
      return resolveReference(token);
    }

    if (/^[A-Z]+$/i.test(token) && peek() === '(') {
      throw new Error(`Unsupported function: ${token.toUpperCase()}`);
    }

    throw new Error('Invalid expression');
  };

  const parsePrimaryNumber = (): number => {
    const value = parsePrimaryValue();
    return coerceToNumber(value);
  };

  const parseExpression = (minPrecedence = 0): number => {
    let left = parsePrimaryNumber();

    while (true) {
      const nextToken = peek();
      if (!nextToken || !isOperator(nextToken) || OPERATOR_PRECEDENCE[nextToken] < minPrecedence) {
        break;
      }
      const operator = consume();
      const right = parseExpression(OPERATOR_PRECEDENCE[operator] + 1);

      if (operator === '+') left += right;
      if (operator === '-') left -= right;
      if (operator === '*') left *= right;
      if (operator === '/') {
        if (right === 0) throw new Error('Division by zero');
        left /= right;
      }
      if (operator === '%') left = (left * right) / 100;
    }

    return left;
  };

  const parseValue = (): FormulaValue => {
    const token = peek();

    if (token === '(') {
      consume();
      const value = parseValue();
      if (consume() !== ')') {
        throw new Error('Mismatched parentheses');
      }
      return value;
    }

    if (token && isStringLiteral(token)) {
      consume();
      return getStringLiteralValue(token);
    }

    if (token && isUnquotedStringOperand(token)) {
      consume();
      return token;
    }

    if (token?.toUpperCase() === 'IF' && tokens[currentIndex + 1] === '(') {
      consume();
      return parseIfExpression();
    }

    if (token && isReference(token)) {
      consume();
      return resolveReference(token);
    }

    if (token && /^[A-Z]+$/i.test(token) && tokens[currentIndex + 1] === '(') {
      throw new Error(`Unsupported function: ${token.toUpperCase()}`);
    }

    return parseExpression();
  };

  const parseIfBranch = (): FormulaValue => {
    const token = peek();
    if (token && (isStringLiteral(token) || isUnquotedStringOperand(token) || token.toUpperCase() === 'IF')) {
      return parseValue();
    }
    return parseExpression();
  };

  const parseCondition = (): boolean => {
    const left = parseValue();
    const nextToken = peek();
    if (nextToken && isComparisonOperator(nextToken)) {
      const operator = consume() as string;
      const right = parseValue();
      return compareValues(left, operator, right);
    }
    return isTruthyFormulaValue(left);
  };

  const parseIfExpression = () => {
    if (consume() !== '(') {
      throw new Error('IF requires parentheses');
    }

    const condition = parseCondition();
    if (consume() !== ',') {
      throw new Error('IF requires three arguments');
    }
    const trueValue = parseIfBranch();
    if (consume() !== ',') {
      throw new Error('IF requires three arguments');
    }
    const falseValue = parseIfBranch();
    if (consume() !== ')') {
      throw new Error('Mismatched parentheses');
    }

    return condition ? trueValue : falseValue;
  };

  const usesConditionalValues = tokens.some((token) => token.toUpperCase() === 'IF') || tokens.some((token) => isStringLiteral(token));

  const value = usesConditionalValues ? parseValue() : parseExpression();

  if (currentIndex !== tokens.length) {
    throw new Error('Invalid expression');
  }

  return value;
};

export const evaluateFormulaExpression = (formula: string, resolveReference: (ref: string) => FormulaValue): FormulaValue => {
  const expressionBody = formula.startsWith('=') ? formula.slice(1) : formula;
  const tokens = tokenizeFormula(expressionBody);
  return evaluateTokens(tokens, resolveReference);
};
