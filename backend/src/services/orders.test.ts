import { describe, it, expect } from 'vitest';
import { selectProductPrice, computeOrderTotal } from './orders.js';

describe('selectProductPrice', () => {
  const product = { wholesale_price: 200, retail_price: 300 };

  it('розница → розничная цена', () => {
    expect(selectProductPrice(product, 'розница')).toBe(300);
  });

  it('опт → оптовая цена', () => {
    expect(selectProductPrice(product, 'опт')).toBe(200);
  });

  it('явно заданная цена имеет приоритет', () => {
    expect(selectProductPrice(product, 'розница', 250)).toBe(250);
  });

  it('дроп по умолчанию — розничная', () => {
    expect(selectProductPrice(product, 'дроп')).toBe(300);
  });
});

describe('computeOrderTotal', () => {
  it('без скидки', () => {
    expect(computeOrderTotal(1000, 0, 0)).toBe(1000);
  });

  it('скидка в деньгах', () => {
    expect(computeOrderTotal(1000, 150, 0)).toBe(850);
  });

  it('скидка в процентах', () => {
    expect(computeOrderTotal(1000, 0, 10)).toBe(900);
  });

  it('скидка деньгами и процентами вместе', () => {
    // 1000 − 100 − 10% = 1000 − 100 − 100 = 800
    expect(computeOrderTotal(1000, 100, 10)).toBe(800);
  });

  it('не уходит ниже нуля', () => {
    expect(computeOrderTotal(100, 500, 0)).toBe(0);
  });
});
