export type SplitType = 'Equal' | 'Exact' | 'Percentage' | 'Shares';

export type SplitInput = {
  userId: string;
  value: number;
};

export type CalculatedSplit = {
  userId: string;
  value: number;
  amount: number;
};

function uniqueInputs(inputs: SplitInput[]): SplitInput[] {
  const seen = new Set<string>();

  return inputs.filter((input) => {
    if (!input.userId || seen.has(input.userId)) {
      return false;
    }

    seen.add(input.userId);
    return true;
  });
}

function toCents(value: number): number {
  return Math.round(value * 100);
}

function fromCents(cents: number): number {
  return cents / 100;
}

function distributeByIntegerWeight(
  totalCents: number,
  inputs: SplitInput[],
  weights: number[],
  weightTotal: number
): CalculatedSplit[] {
  if (inputs.length === 0 || totalCents <= 0 || weightTotal <= 0) {
    return inputs.map((input) => ({
      userId: input.userId,
      value: input.value,
      amount: 0,
    }));
  }

  const baseCents = weights.map((weight) =>
    Math.floor((totalCents * weight) / weightTotal)
  );
  const remainders = weights.map(
    (weight) => (totalCents * weight) % weightTotal
  );

  let remainingCents =
    totalCents - baseCents.reduce((sum, cents) => sum + cents, 0);

  const rankedIndexes = inputs
    .map((_, index) => index)
    .sort((a, b) => {
      if (remainders[b] !== remainders[a]) {
        return remainders[b] - remainders[a];
      }

      return a - b;
    });

  const bonusCents = new Set<number>();
  for (const index of rankedIndexes) {
    if (remainingCents <= 0) break;
    if (weights[index] <= 0) continue;

    bonusCents.add(index);
    remainingCents -= 1;
  }

  return inputs.map((input, index) => ({
    userId: input.userId,
    value: input.value,
    amount: fromCents(baseCents[index] + (bonusCents.has(index) ? 1 : 0)),
  }));
}


export function calculateEqualShares(
  amount: number,
  userIds: string[]
): CalculatedSplit[] {
  const uniqueUserIds = Array.from(
    new Set(userIds.filter(Boolean))
  );

  const inputs = uniqueUserIds.map((userId) => ({
    userId,
    value: 1,
  }));

  const totalCents = toCents(amount);

  if (!Number.isFinite(amount) || amount <= 0 || inputs.length === 0) {
    return inputs.map((input) => ({
      userId: input.userId,
      value: input.value,
      amount: 0,
    }));
  }

  const baseCents = Math.floor(totalCents / inputs.length);

  return inputs.map((input, index) => {
    const cents =
      index === inputs.length - 1
        ? totalCents - baseCents * (inputs.length - 1)
        : baseCents;

    return {
      userId: input.userId,
      value: 1,
      amount: fromCents(cents),
    };
  });
}

export function calculateExactShares(
  amount: number,
  inputs: SplitInput[]
): CalculatedSplit[] {
  const unique = uniqueInputs(inputs);
  const normalized = unique.map((input) => ({
    ...input,
    value: Number.isFinite(input.value) ? Math.max(0, input.value) : 0,
  }));

  return normalized.map((input) => ({
    userId: input.userId,
    value: input.value,
    amount: Number.isFinite(amount) && amount > 0 ? fromCents(toCents(input.value)) : 0,
  }));
}

export function calculatePercentageShares(
  amount: number,
  inputs: SplitInput[]
): CalculatedSplit[] {
  const unique = uniqueInputs(inputs);
  const normalized = unique.map((input) => ({
    ...input,
    value: Number.isFinite(input.value) ? Math.max(0, input.value) : 0,
  }));

  const totalCents = toCents(amount);
  const weights = normalized.map((input) => Math.round(input.value * 100));
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);

  return distributeByIntegerWeight(
    Number.isFinite(amount) && amount > 0 ? totalCents : 0,
    normalized,
    weights,
    weightTotal
  );
}

export function calculateSharesShares(
  amount: number,
  inputs: SplitInput[]
): CalculatedSplit[] {
  const unique = uniqueInputs(inputs);
  const normalized = unique.map((input) => ({
    ...input,
    value: Number.isFinite(input.value)
      ? Math.max(0, Math.round(input.value))
      : 0,
  }));

  const totalCents = toCents(amount);
  const weights = normalized.map((input) => input.value);
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);

  return distributeByIntegerWeight(
    Number.isFinite(amount) && amount > 0 ? totalCents : 0,
    normalized,
    weights,
    weightTotal
  );
}

export function calculateSplits(
  type: SplitType,
  amount: number,
  inputs: SplitInput[]
): CalculatedSplit[] {
  switch (type) {
    case 'Exact':
      return calculateExactShares(amount, inputs);
    case 'Percentage':
      return calculatePercentageShares(amount, inputs);
    case 'Shares':
      return calculateSharesShares(amount, inputs);
    case 'Equal':
    default:
      return calculateEqualShares(
        amount,
        inputs.map((input) => input.userId)
      );
  }
}

export function sharesTotal(shares: CalculatedSplit[]): number {
  return Number(
    shares
      .reduce((sum, share) => sum + share.amount, 0)
      .toFixed(2)
  );
}

export function valuesTotal(
  type: SplitType,
  inputs: SplitInput[]
): number {
  if (type === 'Shares') {
    return inputs.reduce(
      (sum, input) => sum + (Number.isFinite(input.value) ? input.value : 0),
      0
    );
  }

  return Number(
    inputs
      .reduce(
        (sum, input) =>
          sum + (Number.isFinite(input.value) ? input.value : 0),
        0
      )
      .toFixed(2)
  );
}

export function validateSplit(
  type: SplitType,
  amount: number,
  inputs: SplitInput[]
): string | null {
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'Enter a valid expense amount first.';
  }

  const unique = uniqueInputs(inputs);

  if (unique.length === 0) {
    return 'Select at least one member for the split.';
  }

  if (type === 'Equal') {
    return null;
  }

  if (type === 'Exact') {
    const invalid = unique.some(
      (input) =>
        !Number.isFinite(input.value) ||
        input.value < 0 ||
        toCents(input.value) !== Math.round(input.value * 100)
    );

    if (invalid) {
      return 'Enter valid exact amounts with up to 2 decimal places.';
    }

    if (toCents(valuesTotal(type, unique)) !== toCents(amount)) {
      return 'Exact amounts must add up to the expense total.';
    }

    return null;
  }

  if (type === 'Percentage') {
    const invalid = unique.some(
      (input) =>
        !Number.isFinite(input.value) ||
        input.value < 0 ||
        input.value > 100 ||
        toCents(input.value) !== Math.round(input.value * 100)
    );

    if (invalid) {
      return 'Enter percentages from 0 to 100 with up to 2 decimal places.';
    }

    const percentageBasisPoints = unique.reduce(
      (sum, input) => sum + Math.round(input.value * 100),
      0
    );

    if (percentageBasisPoints !== 10000) {
      return 'Percentages must add up to exactly 100%.';
    }

    return null;
  }

  const invalidShares = unique.some(
    (input) =>
      !Number.isFinite(input.value) ||
      !Number.isInteger(input.value) ||
      input.value <= 0
  );

  if (invalidShares) {
    return 'Shares must be whole numbers greater than 0.';
  }

  return null;
}

export function buildDefaultInputs(
  type: SplitType,
  amount: number,
  userIds: string[]
): SplitInput[] {
  const ids = Array.from(new Set(userIds.filter(Boolean)));

  if (type === 'Shares') {
    return ids.map((userId) => ({ userId, value: 1 }));
  }

  if (ids.length === 0) {
    return [];
  }

  const equal = calculateEqualShares(amount, ids);

  if (type === 'Exact') {
    return equal.map((share) => ({
      userId: share.userId,
      value: share.amount,
    }));
  }

  if (type === 'Percentage') {
    if (!Number.isFinite(amount) || amount <= 0) {
      return ids.map((userId) => ({ userId, value: 0 }));
    }

    const basisPoints = 10000;
    const base = Math.floor(basisPoints / ids.length);
    const remainder = basisPoints - base * (ids.length - 1);

    return ids.map((userId, index) => ({
      userId,
      value: Number(
        (index === ids.length - 1 ? remainder : base) / 100
      ),
    }));
  }

  return ids.map((userId) => ({ userId, value: 1 }));
}
