from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_FLOOR

CENT = Decimal("0.01")
EPSILON = Decimal("0.005")


@dataclass(frozen=True)
class SplitInput:
    user_id: str
    value: Decimal


@dataclass(frozen=True)
class CalculatedSplit:
    user_id: str
    value: Decimal
    amount: Decimal


def q2(value: Decimal) -> Decimal:
    return value.quantize(CENT)


def to_cents(value: Decimal) -> int:
    return int(q2(value) * 100)


def _largest_remainder(total_cents: int, weights: list[int]) -> list[int]:
    if not weights or total_cents < 0 or sum(weights) <= 0:
        return [0] * len(weights)
    total_weight = sum(weights)
    raw = [Decimal(total_cents * weight) / Decimal(total_weight) for weight in weights]
    base = [int(item.to_integral_value(rounding=ROUND_FLOOR)) for item in raw]
    remaining = total_cents - sum(base)
    order = sorted(range(len(weights)), key=lambda i: (-(raw[i] - Decimal(base[i])), i))
    for index in order[:remaining]:
        base[index] += 1
    return base


def normalize_inputs(inputs: list[SplitInput]) -> list[SplitInput]:
    unique: list[SplitInput] = []
    seen: set[str] = set()
    for item in inputs:
        if item.user_id and item.user_id not in seen:
            unique.append(item)
            seen.add(item.user_id)
    return unique


def calculate_splits(split_type: str, amount: Decimal, inputs: list[SplitInput]) -> list[CalculatedSplit]:
    normalized = split_type.strip().capitalize()
    unique = normalize_inputs(inputs)
    total_cents = to_cents(amount)

    if normalized == "Equal":
        base = total_cents // len(unique)
        cents = [base] * len(unique)
        cents[-1] += total_cents - sum(cents)
    elif normalized == "Exact":
        cents = [to_cents(max(item.value, Decimal("0"))) for item in unique]
    elif normalized == "Percentage":
        weights = [int((max(item.value, Decimal("0")) * 100).to_integral_value()) for item in unique]
        cents = _largest_remainder(total_cents, weights)
    elif normalized == "Shares":
        weights = [int(max(item.value, Decimal("0")).to_integral_value()) for item in unique]
        cents = _largest_remainder(total_cents, weights)
    else:
        raise ValueError("Unsupported split type.")

    return [CalculatedSplit(item.user_id, item.value, Decimal(cents[i]) / Decimal(100)) for i, item in enumerate(unique)]


def validate_split(split_type: str, amount: Decimal, inputs: list[SplitInput]) -> str | None:
    normalized = split_type.strip().capitalize()
    amount = q2(amount)
    if amount <= 0:
        return "Expense amount must be greater than 0."
    if not inputs:
        return "At least one split participant is required."
    if len({item.user_id for item in inputs}) != len(inputs):
        return "Each participant can appear only once in a split."
    if normalized not in {"Equal", "Exact", "Percentage", "Shares"}:
        return "Unsupported split type."
    for item in inputs:
        if item.value < 0:
            return "Split values cannot be negative."
    if normalized == "Exact":
        if any(item.value != q2(item.value) for item in inputs):
            return "Exact amounts support up to 2 decimal places."
        if sum((q2(item.value) for item in inputs), Decimal("0")) != amount:
            return "Exact amounts must add up to the expense total."
    elif normalized == "Percentage":
        if any(item.value > 100 or item.value != q2(item.value) for item in inputs):
            return "Percentages must be between 0 and 100 with up to 2 decimal places."
        if sum((q2(item.value) for item in inputs), Decimal("0")) != Decimal("100.00"):
            return "Percentages must add up to exactly 100%."
    elif normalized == "Shares":
        if any(item.value <= 0 or item.value != item.value.to_integral_value() for item in inputs):
            return "Shares must be whole numbers greater than 0."
    return None
