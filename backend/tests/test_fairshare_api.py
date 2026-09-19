from decimal import Decimal
from uuid import UUID

import pytest

from app.models import GroupMember
from app.services.invite_service import _delete_auth_user, _send_invitation, _find_auth_user_by_email

from tests.conftest import TestingSessionLocal, USER_A, USER_B, USER_C


def add_members(group_id: str):
    session = TestingSessionLocal()
    session.add_all([
        GroupMember(group_id=UUID(group_id), user_id=USER_B, email='b@example.com', role='member', status='active'),
        GroupMember(group_id=UUID(group_id), user_id=USER_C, email='c@example.com', role='member', status='active'),
    ])
    session.commit()
    session.close()


def create_group(client, name='Test Group', currency='INR'):
    response = client.post('/api/v1/groups', json={
        'name': name,
        'type': 'Friends',
        'currency': currency,
        'description': 'Integration test',
    })
    assert response.status_code == 201, response.text
    return response.json()


def test_health_and_me(client):
    assert client.get('/api/v1/health').status_code == 200
    me = client.get('/api/v1/me')
    assert me.status_code == 200
    assert me.json()['email'] == 'a@example.com'


def test_group_crud_and_members(client, seed_users):
    group = create_group(client)
    gid = group['id']
    add_members(gid)

    groups = client.get('/api/v1/groups')
    assert groups.status_code == 200
    assert any(row['id'] == gid for row in groups.json())

    members = client.get(f'/api/v1/groups/{gid}/members')
    assert members.status_code == 200
    assert {row['user_id'] for row in members.json()} >= {str(USER_A), str(USER_B), str(USER_C)}

    detail = client.get(f'/api/v1/groups/{gid}')
    assert detail.status_code == 200
    assert detail.json()['name'] == 'Test Group'


def test_all_split_modes_and_edit_delete(client, seed_users):
    group = create_group(client)
    gid = group['id']
    add_members(gid)

    cases = [
        ('Equal', [{'user_id': str(USER_A), 'value': '0'}, {'user_id': str(USER_B), 'value': '0'}, {'user_id': str(USER_C), 'value': '0'}]),
        ('Exact', [{'user_id': str(USER_A), 'value': '500'}, {'user_id': str(USER_B), 'value': '300'}, {'user_id': str(USER_C), 'value': '200'}]),
        ('Percentage', [{'user_id': str(USER_A), 'value': '50'}, {'user_id': str(USER_B), 'value': '30'}, {'user_id': str(USER_C), 'value': '20'}]),
        ('Shares', [{'user_id': str(USER_A), 'value': '2'}, {'user_id': str(USER_B), 'value': '1'}, {'user_id': str(USER_C), 'value': '2'}]),
    ]
    expense_ids = []
    for idx, (split_type, splits) in enumerate(cases, start=1):
        response = client.post(f'/api/v1/groups/{gid}/expenses', json={
            'title': f'Expense {idx}', 'amount': '1000', 'paid_by': str(USER_A),
            'split_type': split_type, 'splits': splits,
        })
        assert response.status_code == 201, response.text
        expense_ids.append(response.json()['id'])
        details = client.get(f"/api/v1/expenses/{response.json()['id']}")
        assert details.status_code == 200
        split_sum = sum(Decimal(str(row['amount'])) for row in details.json()['splits'])
        assert split_sum == Decimal('1000.00')

    # Edit the first expense from Equal -> Exact and switch payer to B.
    updated = client.put(f'/api/v1/expenses/{expense_ids[0]}', json={
        'title': 'Edited Expense', 'amount': '900', 'paid_by': str(USER_B), 'split_type': 'Exact',
        'splits': [
            {'user_id': str(USER_A), 'value': '400'},
            {'user_id': str(USER_B), 'value': '300'},
            {'user_id': str(USER_C), 'value': '200'},
        ],
    })
    assert updated.status_code == 200, updated.text
    assert updated.json()['title'] == 'Edited Expense'
    assert updated.json()['paid_by'] == str(USER_B)

    deleted = client.delete(f'/api/v1/expenses/{expense_ids[-1]}')
    assert deleted.status_code == 204
    assert client.get(f'/api/v1/expenses/{expense_ids[-1]}').status_code == 404


def test_balances_debts_and_settlement_lifecycle(client, seed_users):
    group = create_group(client)
    gid = group['id']
    add_members(gid)

    response = client.post(f'/api/v1/groups/{gid}/expenses', json={
        'title': 'Dinner', 'amount': '900', 'paid_by': str(USER_A), 'split_type': 'Exact',
        'splits': [
            {'user_id': str(USER_A), 'value': '300'},
            {'user_id': str(USER_B), 'value': '300'},
            {'user_id': str(USER_C), 'value': '300'},
        ],
    })
    assert response.status_code == 201

    balances = client.get(f'/api/v1/groups/{gid}/balances')
    assert balances.status_code == 200
    by_id = {row['user_id']: Decimal(str(row['net_balance'])) for row in balances.json()}
    assert by_id[str(USER_A)] == Decimal('600.00')
    assert by_id[str(USER_B)] == Decimal('-300.00')
    assert by_id[str(USER_C)] == Decimal('-300.00')

    debts = client.get(f'/api/v1/groups/{gid}/debts')
    assert debts.status_code == 200
    simplified = debts.json()['simplified']
    assert len(simplified) == 2
    assert {row['from_user_id'] for row in simplified} == {str(USER_B), str(USER_C)}

    first = simplified[0]
    settlement = client.post(f'/api/v1/groups/{gid}/settlements', json={
        'from_user_id': first['from_user_id'], 'to_user_id': first['to_user_id'],
        'amount': str(first['amount']), 'note': 'UPI',
    })
    assert settlement.status_code == 201, settlement.text
    sid = settlement.json()['id']

    # Partial settlement keeps the remaining obligation on the next balance check.
    current = client.get(f'/api/v1/groups/{gid}/balances')
    assert current.status_code == 200

    # Edit the settlement to half its amount and then delete it.
    old_amount = Decimal(str(settlement.json()['amount']))
    new_amount = old_amount / 2
    edited = client.put(f'/api/v1/groups/{gid}/settlements/{sid}', json={'amount': str(new_amount), 'note': 'Updated'})
    assert edited.status_code == 200, edited.text
    assert Decimal(str(edited.json()['amount'])) == new_amount

    removed = client.delete(f'/api/v1/groups/{gid}/settlements/{sid}')
    assert removed.status_code == 204
    assert not client.get(f'/api/v1/groups/{gid}/settlements').json()


def test_roles_currency_and_viewer_permissions(client, seed_users):
    group = create_group(client)
    gid = group['id']
    add_members(gid)

    role = client.patch(f'/api/v1/groups/{gid}/members/{USER_B}/role', json={'role': 'viewer'})
    assert role.status_code == 200
    assert role.json()['role'] == 'viewer'

    # Viewer cannot create money records. Change the auth dependency for this request.
    from app.core.security import CurrentUser, get_current_user
    from app.main import app
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(id=USER_B, email='b@example.com', full_name='B')
    blocked = client.post(f'/api/v1/groups/{gid}/expenses', json={
        'title': 'Blocked', 'amount': '100', 'paid_by': str(USER_B), 'split_type': 'Equal',
        'splits': [{'user_id': str(USER_B), 'value': '0'}],
    })
    assert blocked.status_code == 403
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(id=USER_A, email='a@example.com', full_name='A')

    # Owner can change the currency only before financial records exist.
    updated = client.patch(f'/api/v1/groups/{gid}', json={
        'name': 'USD Group', 'type': 'Friends', 'currency': 'USD', 'description': None,
    })
    assert updated.status_code == 200
    assert updated.json()['currency'] == 'USD'


def test_remove_member_requires_settled_balance(client, seed_users):
    group = create_group(client)
    gid = group['id']
    add_members(gid)
    response = client.post(f'/api/v1/groups/{gid}/expenses', json={
        'title': 'Debt', 'amount': '100', 'paid_by': str(USER_A), 'split_type': 'Exact',
        'splits': [{'user_id': str(USER_A), 'value': '50'}, {'user_id': str(USER_B), 'value': '50'}],
    })
    assert response.status_code == 201
    members = client.get(f'/api/v1/groups/{gid}/members').json()
    member_b = next(row for row in members if row['user_id'] == str(USER_B))
    assert client.delete(f"/api/v1/groups/{gid}/members/{member_b['id']}").status_code == 409


def test_invitation_flow_contract_with_mocked_auth_api(client, seed_users, monkeypatch):
    group = create_group(client)
    gid = group['id']
    monkeypatch.setattr('app.services.invite_service._find_auth_user_by_email', lambda email: None)
    monkeypatch.setattr('app.services.invite_service._send_invitation', lambda email, redirect_to, group_id: {'user': {'id': str(USER_C)}})
    response = client.post(f'/api/v1/groups/{gid}/members/invite', json={'email': 'new@example.com', 'redirect_to': 'fairshare://accept-invite'})
    assert response.status_code == 200, response.text
    assert response.json()['status'] == 'pending'


def test_leave_group_owner_is_blocked(client, seed_users):
    group = create_group(client)
    response = client.post(f"/api/v1/groups/{group['id']}/leave")
    assert response.status_code == 400


def test_settlement_reduces_net_balance_and_can_be_deleted(client, seed_users):
    group = create_group(client)
    gid = group['id']
    add_members(gid)
    response = client.post(f'/api/v1/groups/{gid}/expenses', json={
        'title': 'Dinner', 'amount': '900', 'paid_by': str(USER_A), 'split_type': 'Exact',
        'splits': [
            {'user_id': str(USER_A), 'value': '300'},
            {'user_id': str(USER_B), 'value': '300'},
            {'user_id': str(USER_C), 'value': '300'},
        ],
    })
    assert response.status_code == 201

    debts = client.get(f'/api/v1/groups/{gid}/debts').json()['simplified']
    first = next(item for item in debts if item['from_user_id'] == str(USER_B))
    payment = client.post(f'/api/v1/groups/{gid}/settlements', json={
        'from_user_id': str(USER_B), 'to_user_id': str(USER_A),
        'amount': str(first['amount']), 'note': 'full settlement',
    })
    assert payment.status_code == 201

    balances = client.get(f'/api/v1/groups/{gid}/balances').json()
    by_id = {row['user_id']: Decimal(str(row['net_balance'])) for row in balances}
    assert by_id[str(USER_B)] == Decimal('0.00')
    assert by_id[str(USER_A)] == Decimal('300.00')


def test_currency_is_locked_after_financial_activity(client, seed_users):
    group = create_group(client, currency='INR')
    gid = group['id']
    add_members(gid)
    response = client.post(f'/api/v1/groups/{gid}/expenses', json={
        'title': 'Fuel', 'amount': '100', 'paid_by': str(USER_A), 'split_type': 'Exact',
        'splits': [{'user_id': str(USER_A), 'value': '50'}, {'user_id': str(USER_B), 'value': '50'}],
    })
    assert response.status_code == 201
    blocked = client.patch(f'/api/v1/groups/{gid}', json={
        'name': 'Locked Currency', 'type': 'Friends', 'currency': 'USD', 'description': None,
    })
    assert blocked.status_code == 409


def test_owner_role_cannot_be_reassigned_and_viewer_cannot_manage_members(client, seed_users):
    group = create_group(client)
    gid = group['id']
    add_members(gid)

    owner_change = client.patch(f'/api/v1/groups/{gid}/members/{USER_A}/role', json={'role': 'admin'})
    assert owner_change.status_code == 400

    viewer_change = client.patch(f'/api/v1/groups/{gid}/members/{USER_B}/role', json={'role': 'viewer'})
    assert viewer_change.status_code == 200

    from app.core.security import CurrentUser, get_current_user
    from app.main import app
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(id=USER_B, email='b@example.com', full_name='B')
    members = client.get(f'/api/v1/groups/{gid}/members')
    assert members.status_code == 200
    remove_target = next(row for row in members.json() if row['user_id'] == str(USER_C))
    assert client.delete(f"/api/v1/groups/{gid}/members/{remove_target['id']}").status_code == 403
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(id=USER_A, email='a@example.com', full_name='A')


def test_history_returns_both_expenses_and_settlements(client, seed_users):
    group = create_group(client)
    gid = group['id']
    add_members(gid)
    expense = client.post(f'/api/v1/groups/{gid}/expenses', json={
        'title': 'Lunch', 'amount': '300', 'paid_by': str(USER_A), 'split_type': 'Equal',
        'splits': [
            {'user_id': str(USER_A), 'value': '0'},
            {'user_id': str(USER_B), 'value': '0'},
            {'user_id': str(USER_C), 'value': '0'},
        ],
    })
    assert expense.status_code == 201
    debt = client.get(f'/api/v1/groups/{gid}/debts').json()['simplified'][0]
    settlement = client.post(f'/api/v1/groups/{gid}/settlements', json={
        'from_user_id': debt['from_user_id'], 'to_user_id': debt['to_user_id'],
        'amount': str(debt['amount']),
    })
    assert settlement.status_code == 201
    history = client.get(f'/api/v1/groups/{gid}/history?limit=100')
    assert history.status_code == 200
    payload = history.json()
    assert len(payload['expenses']) == 1
    assert len(payload['settlements']) == 1
