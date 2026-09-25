from decimal import Decimal

import pytest

from app.services.split_calculator import SplitInput, calculate_splits, validate_split


def run(split_type: str, amount: str, values: list[str]):
    inputs = [SplitInput(str(index + 1), Decimal(value)) for index, value in enumerate(values)]
    calculated = calculate_splits(split_type, Decimal(amount), inputs)
    return calculated


def test_equal_handles_remainder_exactly():
    result = run('Equal', '100.00', ['0', '0', '0'])
    assert [item.amount for item in result] == [Decimal('33.33'), Decimal('33.33'), Decimal('33.34')]


def test_percentage_rounding_reaches_exact_total():
    result = run('Percentage', '10.00', ['33.33', '33.33', '33.34'])
    assert sum(item.amount for item in result) == Decimal('10.00')
    assert [item.amount for item in result] == [Decimal('3.33'), Decimal('3.33'), Decimal('3.34')]


def test_shares_rounding_reaches_exact_total():
    result = run('Shares', '100.00', ['2', '1', '2'])
    assert sum(item.amount for item in result) == Decimal('100.00')
    assert [item.amount for item in result] == [Decimal('40.00'), Decimal('20.00'), Decimal('40.00')]


def test_exact_requires_exact_total():
    inputs = [SplitInput('1', Decimal('60')), SplitInput('2', Decimal('30'))]
    assert validate_split('Exact', Decimal('100'), inputs) == 'Exact amounts must add up to the expense total.'


@pytest.mark.parametrize(
    ('split_type', 'values', 'expected'),
    [
        ('Percentage', ['50', '49.99'], 'Percentages must add up to exactly 100%.'),
        ('Shares', ['2', '0'], 'Shares must be whole numbers greater than 0.'),
    ],
)
def test_invalid_split_values_are_rejected(split_type, values, expected):
    inputs = [SplitInput(str(index), Decimal(value)) for index, value in enumerate(values)]
    assert validate_split(split_type, Decimal('100'), inputs) == expected
