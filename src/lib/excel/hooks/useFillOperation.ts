import * as React from 'react';

export const useFillOperation = () => {
  return React.useCallback((params: { values?: unknown[]; currentIndex?: number; direction?: string }) => {
    const values = Array.isArray(params.values) ? params.values : [];
    const currentIndex = Number(params.currentIndex ?? 0);
    const direction = String(params.direction ?? '');
    const isVerticalFill = direction === 'down' || direction === 'up';

    if (!isVerticalFill || values.length === 0) {
      return undefined;
    }

    const numericValues = values.map((value) => Number(String(value ?? '').trim())).filter((value) => Number.isFinite(value));

    if (numericValues.length !== values.length) {
      return undefined;
    }

    if (numericValues.length === 1) {
      const seed = numericValues[0];
      const step = direction === 'down' ? 1 : -1;
      return seed + step * (currentIndex + 1);
    }

    const lastValue = numericValues[numericValues.length - 1];
    const previousValue = numericValues[numericValues.length - 2];
    const diff = lastValue - previousValue;
    return lastValue + diff * (currentIndex + 1);
  }, []);
};
