export interface DependencyMaps {
  forward: Map<string, Set<string>>;
  reverse: Map<string, Set<string>>;
}

export const extractCellReferences = (formula: string): string[] => {
  const body = formula.startsWith('=') ? formula.slice(1) : formula;
  const matches = body.match(/[A-Z]+[0-9]*/gi) ?? [];
  return matches.map((match) => match.toUpperCase());
};

export const buildDependencyMaps = (
  formulaByCell: Map<string, string>,
  normalizeRefToCellId: (ref: string, currentCellId: string) => string | null,
): DependencyMaps => {
  const forward = new Map<string, Set<string>>();
  const reverse = new Map<string, Set<string>>();

  formulaByCell.forEach((formula, cellId) => {
    const refs = extractCellReferences(formula);
    const deps = new Set<string>();
    refs.forEach((ref) => {
      const resolvedId = normalizeRefToCellId(ref, cellId);
      if (!resolvedId) {
        return;
      }
      deps.add(resolvedId);
      if (!reverse.has(resolvedId)) {
        reverse.set(resolvedId, new Set());
      }
      reverse.get(resolvedId)?.add(cellId);
    });
    forward.set(cellId, deps);
  });

  return { forward, reverse };
};

export const hasCircularDependency = (startCell: string, dependencies: Map<string, Set<string>>): boolean => {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const walk = (cellId: string): boolean => {
    if (visiting.has(cellId)) {
      return true;
    }
    if (visited.has(cellId)) {
      return false;
    }

    visiting.add(cellId);
    const deps = dependencies.get(cellId) ?? new Set<string>();
    for (const depId of deps) {
      if (walk(depId)) {
        return true;
      }
    }
    visiting.delete(cellId);
    visited.add(cellId);
    return false;
  };

  return walk(startCell);
};

export interface BuildFormulaByCellParams {
  columnKeys: string[];
  rawMatrix: string[][];
  columnFormulaByKey: Record<string, string>;
  targetColKey: string;
  proposedFormula: string;
}

export const buildFormulaByCellForCycleCheck = ({
  columnKeys,
  rawMatrix,
  columnFormulaByKey,
  targetColKey,
  proposedFormula,
}: BuildFormulaByCellParams): Map<string, string> => {
  const formulaByCell = new Map<string, string>();
  const rowCount = Math.max(rawMatrix.length, 1);
  const normalizedProposed = proposedFormula.startsWith('=') ? proposedFormula : `=${proposedFormula}`;

  columnKeys.forEach((colKey, colIndex) => {
    let formula = '';
    if (colKey === targetColKey) {
      formula = normalizedProposed;
    } else {
      const fromMap = String(columnFormulaByKey[colKey] ?? '').trim();
      if (fromMap.startsWith('=')) {
        formula = fromMap;
      } else {
        for (let rowIndex = 0; rowIndex < rawMatrix.length; rowIndex += 1) {
          const value = String(rawMatrix[rowIndex]?.[colIndex] ?? '');
          if (value.startsWith('=')) {
            formula = value;
            break;
          }
        }
      }
    }

    if (!formula.startsWith('=')) {
      return;
    }

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      formulaByCell.set(`${colKey}${rowIndex + 1}`, formula);
    }
  });

  return formulaByCell;
};

export const findCircularDependencyPath = (startCell: string, dependencies: Map<string, Set<string>>): string[] | null => {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  const walk = (cellId: string): string[] | null => {
    if (visiting.has(cellId)) {
      const startIndex = stack.indexOf(cellId);
      return startIndex >= 0 ? [...stack.slice(startIndex), cellId] : [cellId, cellId];
    }
    if (visited.has(cellId)) {
      return null;
    }

    visiting.add(cellId);
    stack.push(cellId);

    for (const depId of dependencies.get(cellId) ?? []) {
      const cycle = walk(depId);
      if (cycle) {
        return cycle;
      }
    }

    stack.pop();
    visiting.delete(cellId);
    visited.add(cellId);
    return null;
  };

  return walk(startCell);
};

const extractColKeyFromCellId = (cellId: string, columnKeys: string[]): string | null => {
  const sortedKeys = [...columnKeys].sort((left, right) => right.length - left.length);
  for (const key of sortedKeys) {
    if (!cellId.startsWith(key)) {
      continue;
    }
    const suffix = cellId.slice(key.length);
    if (/^\d+$/.test(suffix)) {
      return key;
    }
  }
  return null;
};

export interface CircularReferenceMessageParams {
  cycleCellIds: string[];
  columnKeys: string[];
  getColumnLabel: (colKey: string) => string;
  targetColKey: string;
}

export const buildCircularReferenceMessage = ({ cycleCellIds, columnKeys, getColumnLabel, targetColKey }: CircularReferenceMessageParams): string => {
  const colKeysInCycle = cycleCellIds.map((cellId) => extractColKeyFromCellId(cellId, columnKeys)).filter((key): key is string => Boolean(key));

  const dedupedKeys: string[] = [];
  colKeysInCycle.forEach((key) => {
    if (!dedupedKeys.length || dedupedKeys[dedupedKeys.length - 1] !== key) {
      dedupedKeys.push(key);
    }
  });

  const targetLabel = getColumnLabel(targetColKey);
  const uniqueKeys = Array.from(new Set(dedupedKeys));
  const otherKeys = uniqueKeys.filter((key) => key !== targetColKey);
  const otherLabel = otherKeys.length ? getColumnLabel(otherKeys[0]) : null;

  if (uniqueKeys.length <= 1) {
    return otherLabel
      ? `You are using "${otherLabel}" to calculate "${targetLabel}", but "${otherLabel}" already uses "${targetLabel}". The sheet cannot work out both numbers. Pick a column where you type the value yourself (for example Base price).`
      : `"${targetLabel}" cannot be calculated from itself. Pick a column where you type the value yourself (for example Base price).`;
  }

  if (uniqueKeys.length === 2 && otherLabel) {
    const firstLabel = getColumnLabel(uniqueKeys[0]);
    const secondLabel = getColumnLabel(uniqueKeys[1]);
    return `"${firstLabel}" and "${secondLabel}" need each other to get a value — like two people each saying “tell me your answer first.” The sheet gets stuck. For "${targetLabel}", use a column you fill in yourself (for example Base price or Area), not a total column.`;
  }

  const columnNames = uniqueKeys.map((key) => `"${getColumnLabel(key)}"`).join(', ');
  return `These columns depend on each other in a circle: ${columnNames}. The sheet cannot calculate them. For "${targetLabel}", use a column where you enter the amount yourself, not another calculated total.`;
};

export const detectCircularReferenceForColumnApply = (
  params: BuildFormulaByCellParams & {
    normalizeRefToCellId: (ref: string, currentCellId: string) => string | null;
    getColumnLabel: (colKey: string) => string;
  },
): string | null => {
  const { targetColKey, proposedFormula, columnKeys, normalizeRefToCellId, getColumnLabel } = params;
  const normalized = proposedFormula.startsWith('=') ? proposedFormula : `=${proposedFormula}`;
  if (!normalized.startsWith('=')) {
    return null;
  }

  const formulaByCell = buildFormulaByCellForCycleCheck({ ...params, proposedFormula: normalized });
  const probeCellId = `${targetColKey}1`;
  if (!formulaByCell.has(probeCellId)) {
    return null;
  }

  const dependencyMaps = buildDependencyMaps(formulaByCell, normalizeRefToCellId);
  if (!hasCircularDependency(probeCellId, dependencyMaps.forward)) {
    return null;
  }

  const cyclePath = findCircularDependencyPath(probeCellId, dependencyMaps.forward);
  return buildCircularReferenceMessage({
    cycleCellIds: cyclePath ?? [probeCellId],
    columnKeys,
    getColumnLabel,
    targetColKey,
  });
};

export const collectDependents = (cellId: string, reverse: Map<string, Set<string>>): Set<string> => {
  const affected = new Set<string>();
  const queue = [cellId];

  while (queue.length) {
    const current = queue.shift() as string;
    const dependents = reverse.get(current) ?? new Set<string>();
    dependents.forEach((dependent) => {
      if (affected.has(dependent)) {
        return;
      }
      affected.add(dependent);
      queue.push(dependent);
    });
  }

  return affected;
};
