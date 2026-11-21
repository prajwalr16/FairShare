import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  CHECKLIST_TEMPLATE_PACKS,
  CATEGORY_ICONS,
  CATEGORY_COLORS,
} from '../constants/checklistTemplates.ts';

describe('checklistTemplates Unit Tests', () => {
  it('contains 5 standard starter packs', () => {
    assert.strictEqual(CHECKLIST_TEMPLATE_PACKS.length, 5);
    const packIds = CHECKLIST_TEMPLATE_PACKS.map((p) => p.id);
    assert.deepStrictEqual(packIds, ['beach', 'mountain', 'roadtrip', 'weekend', 'international']);
  });

  it('ensures each pack has valid metadata and non-empty items', () => {
    for (const pack of CHECKLIST_TEMPLATE_PACKS) {
      assert.ok(pack.id.length > 0, 'Pack ID must not be empty');
      assert.ok(pack.name.length > 0, 'Pack name must not be empty');
      assert.ok(pack.icon.length > 0, 'Pack icon must not be empty');
      assert.ok(pack.description.length > 0, 'Pack description must not be empty');
      assert.ok(pack.items.length >= 10, `Pack ${pack.id} must have at least 10 items`);
    }
  });

  it('guarantees unique item IDs across all template packs', () => {
    const allItemIds = new Set<string>();
    for (const pack of CHECKLIST_TEMPLATE_PACKS) {
      for (const item of pack.items) {
        assert.ok(!allItemIds.has(item.id), `Duplicate template item id detected: ${item.id}`);
        allItemIds.add(item.id);
      }
    }
    assert.ok(allItemIds.size >= 70, 'Should have at least 70 unique template items in total');
  });

  it('verifies all template items belong to valid categories and scopes', () => {
    const validCategories = new Set([
      'Clothing',
      'Toiletries',
      'Electronics',
      'Documents',
      'Medical',
      'Gear',
      'Food',
      'General',
    ]);
    const validScopes = new Set(['personal', 'group']);

    for (const pack of CHECKLIST_TEMPLATE_PACKS) {
      for (const item of pack.items) {
        assert.ok(item.title.trim().length > 0, 'Item title must not be empty');
        assert.ok(
          validCategories.has(item.category),
          `Invalid category: ${item.category} in item ${item.id}`
        );
        assert.ok(
          validScopes.has(item.scope),
          `Invalid scope: ${item.scope} in item ${item.id}`
        );
      }
    }
  });

  it('includes both personal packing and group gear items across templates', () => {
    for (const pack of CHECKLIST_TEMPLATE_PACKS) {
      const personalItems = pack.items.filter((i) => i.scope === 'personal');
      const groupItems = pack.items.filter((i) => i.scope === 'group');

      assert.ok(personalItems.length > 0, `Pack ${pack.id} must have personal items`);
      assert.ok(groupItems.length > 0, `Pack ${pack.id} must have group gear items`);
    }
  });

  it('defines icon and color mappings for every valid category', () => {
    const expectedCategories = [
      'Clothing',
      'Toiletries',
      'Electronics',
      'Documents',
      'Medical',
      'Gear',
      'Food',
      'General',
    ];

    for (const cat of expectedCategories) {
      assert.ok(CATEGORY_ICONS[cat], `Missing icon glyph for category ${cat}`);
      assert.ok(CATEGORY_COLORS[cat], `Missing color definition for category ${cat}`);
      assert.ok(CATEGORY_COLORS[cat].startsWith('#'), `Category color must be a hex code: ${cat}`);
    }
  });
});
