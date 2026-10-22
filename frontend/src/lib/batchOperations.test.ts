import { describe, it, expect, vi } from 'vitest';
import BatchOperationManager from './batchOperations';

describe('BatchOperationManager', () => {
  it('initializes with empty selection', () => {
    const manager = new BatchOperationManager();
    expect(manager.getSelectionCount()).toBe(0);
    expect(manager.hasSelection()).toBe(false);
  });

  it('toggles item selection', () => {
    const manager = new BatchOperationManager();
    manager.toggleSelection('item1');

    expect(manager.isSelected('item1')).toBe(true);
    expect(manager.getSelectionCount()).toBe(1);

    manager.toggleSelection('item1');
    expect(manager.isSelected('item1')).toBe(false);
    expect(manager.getSelectionCount()).toBe(0);
  });

  it('selects all items', () => {
    const manager = new BatchOperationManager();
    const ids = ['item1', 'item2', 'item3'];

    manager.selectAll(ids);

    expect(manager.getSelectionCount()).toBe(3);
    expect(manager.getSelectedIds()).toEqual(ids);
  });

  it('deselects all items', () => {
    const manager = new BatchOperationManager();
    manager.selectAll(['item1', 'item2']);
    manager.deselectAll();

    expect(manager.getSelectionCount()).toBe(0);
    expect(manager.hasSelection()).toBe(false);
  });

  it('returns selected IDs', () => {
    const manager = new BatchOperationManager();
    manager.toggleSelection('item1');
    manager.toggleSelection('item2');

    const selected = manager.getSelectedIds();
    expect(selected).toContain('item1');
    expect(selected).toContain('item2');
    expect(selected.length).toBe(2);
  });

  it('executes batch operation successfully', async () => {
    const manager = new BatchOperationManager();
    const selectedIds = ['item1', 'item2'];

    const result = await manager.executeOperation('transfer', selectedIds);

    expect(result.success).toBe(true);
    expect(result.itemsProcessed).toBe(2);
    expect(result.itemsFailed).toBe(0);
  });

  it('handles empty selection in operation', async () => {
    const manager = new BatchOperationManager();

    const result = await manager.executeOperation('transfer', []);

    expect(result.success).toBe(false);
    expect(result.itemsFailed).toBe(0);
    expect(result.errors).toBeDefined();
  });

  it('tracks selection state correctly', () => {
    const manager = new BatchOperationManager();

    expect(manager.hasSelection()).toBe(false);

    manager.toggleSelection('item1');
    expect(manager.hasSelection()).toBe(true);

    manager.deselectAll();
    expect(manager.hasSelection()).toBe(false);
  });
});
