import { describe, it, expect } from 'vitest';
import { getStockStatus } from '../StockStatusBadge';

describe('getStockStatus color-coding logic', () => {
  it('identifies 0 and negative inventory as out of stock (red level)', () => {
    expect(getStockStatus(0).level).toBe('out');
    expect(getStockStatus(0).label).toBe('Out of Stock');
    expect(getStockStatus(-1).level).toBe('out');
  });

  it('identifies between 1 and 4 inventory as low stock (orange level)', () => {
    expect(getStockStatus(1).level).toBe('low');
    expect(getStockStatus(1).label).toBe('Low Stock');
    expect(getStockStatus(4).level).toBe('low');
  });

  it('identifies 5 or more inventory as in stock (green level)', () => {
    expect(getStockStatus(5).level).toBe('good');
    expect(getStockStatus(5).label).toBe('In Stock');
    expect(getStockStatus(20).level).toBe('good');
  });
});
