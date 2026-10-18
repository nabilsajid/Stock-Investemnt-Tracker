import { describe, it, expect } from 'vitest';
import {
  calculatePurchase,
  calculateWeightedAverage,
  calculateMinimumSellingPrice,
  calculateSale,
  calculateUnrealized,
  calculatePortfolioTotals,
} from './calculator';
import { replayLedger, RawTransaction } from './ledger-replay';

describe('Financial Calculation Engine', () => {
  describe('A. Buying calculations', () => {
    it('calculates single purchase correctly per user example (100 shares @ 50 BDT)', () => {
      // Example from spec:
      // Purchase 100 shares at ৳50.
      // Total Transaction = ৳5,000.
      // Buying Brokerage = ৳25.
      // Total Purchase Cost = ৳5,025.
      // Average Cost per Share = ৳50.25.
      const purchase = calculatePurchase(100, 50, 0.005);
      expect(purchase.grossAmount).toBe('5000.00');
      expect(purchase.brokerageAmount).toBe('25.00');
      expect(purchase.totalCost).toBe('5025.00');
      expect(purchase.costPerShare).toBe('50.2500');
    });
  });

  describe('B. Multiple purchases and weighted-average calculation', () => {
    it('calculates multiple purchases weighted average including brokerage', () => {
      // First purchase: 100 shares at ৳50 -> cost ৳5,025
      const p1 = calculatePurchase(100, 50, 0.005);
      const state1 = calculateWeightedAverage(0, 0, p1);
      expect(state1.updatedTotalShares).toBe('100');
      expect(state1.updatedTotalCostBasis).toBe('5025.00');
      expect(state1.updatedAveragePrice).toBe('50.2500');

      // Second purchase: 50 shares at ৳60 -> cost ৳3,015
      const p2 = calculatePurchase(50, 60, 0.005);
      expect(p2.grossAmount).toBe('3000.00');
      expect(p2.brokerageAmount).toBe('15.00');
      expect(p2.totalCost).toBe('3015.00');

      // Combined: Total cost = ৳8,040, Total shares = 150, Weighted avg = ৳53.60
      const state2 = calculateWeightedAverage(
        state1.updatedTotalShares,
        state1.updatedTotalCostBasis,
        p2
      );
      expect(state2.updatedTotalShares).toBe('150');
      expect(state2.updatedTotalCostBasis).toBe('8040.00');
      expect(state2.updatedAveragePrice).toBe('53.6000');
    });
  });

  describe('C. Minimum Selling Price (Break-Even)', () => {
    it('calculates break-even selling price per share including selling brokerage', () => {
      // Spec: Avg cost ৳50.25, Selling brokerage 0.5% (0.005)
      // Break-even = 50.25 / (1 - 0.005) = 50.25 / 0.995 ≈ ৳50.5025
      const minPrice = calculateMinimumSellingPrice('50.25', '0.005');
      expect(minPrice.breakEvenPrice).toBe('50.5025');
    });
  });

  describe('D & E. Selling calculations and available shares', () => {
    it('calculates partial sale and preserves average purchase cost of remaining shares', () => {
      // Spec Example:
      // Buy 100 @ 50 -> avg cost = 50.25
      // Sell 40 @ 55:
      // Gross selling amount = ৳2,200
      // Selling brokerage = ৳11
      // Net selling amount = ৳2,189
      // Cost of 40 shares = ৳2,010
      // Realized profit = ৳179
      // Available shares = 60
      // Remaining cost basis = ৳3,015
      const sale = calculateSale(40, 55, '50.25', 100, '5025.00', '0.005');
      expect(sale.grossSellingAmount).toBe('2200.00');
      expect(sale.sellingBrokerageAmount).toBe('11.00');
      expect(sale.netSellingAmount).toBe('2189.00');
      expect(sale.costBasisOfSharesSold).toBe('2010.00');
      expect(sale.realizedProfitLoss).toBe('179.00');
      expect(sale.remainingShares).toBe('60');
      expect(sale.remainingCostBasis).toBe('3015.00');
    });

    it('rejects selling more shares than are available', () => {
      expect(() => {
        calculateSale(105, 55, '50.25', 100, '5025.00', '0.005');
      }).toThrow(/exceeds available shares/);
    });

    it('calculates complete sale of all shares to 0 remaining', () => {
      const sale = calculateSale(100, 55, '50.25', 100, '5025.00', '0.005');
      expect(sale.remainingShares).toBe('0');
      expect(sale.remainingCostBasis).toBe('0.00');
      expect(sale.netSellingAmount).toBe('5472.50');
      expect(sale.realizedProfitLoss).toBe('447.50');
    });

    it('calculates loss-making sale correctly', () => {
      // Sell 50 @ 40 when cost basis was 50.25
      const sale = calculateSale(50, 40, '50.25', 100, '5025.00', '0.005');
      expect(sale.grossSellingAmount).toBe('2000.00');
      expect(sale.sellingBrokerageAmount).toBe('10.00');
      expect(sale.netSellingAmount).toBe('1990.00');
      expect(sale.costBasisOfSharesSold).toBe('2512.50');
      expect(sale.realizedProfitLoss).toBe('-522.50');
    });
  });

  describe('F. Unrealized Profit/Loss and Market Value', () => {
    it('returns null fields when manual market price has not been set', () => {
      const unrealized = calculateUnrealized(60, '3015.00', null);
      expect(unrealized.manualMarketPrice).toBeNull();
      expect(unrealized.currentMarketValue).toBeNull();
      expect(unrealized.unrealizedProfitLoss).toBeNull();
    });

    it('calculates unrealized profit after estimated selling brokerage', () => {
      // 60 shares @ manual market price 60
      // Current Market Value = 60 * 60 = 3600
      // Estimated Selling Brokerage = 3600 * 0.005 = 18
      // Remaining Cost Basis = 3015.00
      // Unrealized P/L = 3600 - 18 - 3015 = 567.00
      const unrealized = calculateUnrealized(60, '3015.00', 60, 0.005);
      expect(unrealized.currentMarketValue).toBe('3600.00');
      expect(unrealized.estimatedSellingBrokerage).toBe('18.00');
      expect(unrealized.unrealizedProfitLoss).toBe('567.00');
    });
  });

  describe('Ledger Replay Engine', () => {
    it('replays a sequence of BUY, BUY, SELL, BUY accurately', () => {
      const txs: RawTransaction[] = [
        {
          id: '1',
          type: 'BUY',
          date: '2026-01-01',
          quantity: 100,
          pricePerShare: 50,
          brokerageRate: 0.005,
          sequence: 1,
        },
        {
          id: '2',
          type: 'BUY',
          date: '2026-01-02',
          quantity: 50,
          pricePerShare: 60,
          brokerageRate: 0.005,
          sequence: 1,
        },
        {
          id: '3',
          type: 'SELL',
          date: '2026-01-03',
          quantity: 40,
          pricePerShare: 70,
          brokerageRate: 0.005,
          sequence: 1,
        },
      ];

      const res = replayLedger(txs);
      expect(res.valid).toBe(true);
      expect(res.finalState.availableShares).toBe('110');
      expect(res.finalState.totalSharesPurchased).toBe('150');
      expect(res.finalState.totalSharesSold).toBe('40');
      // 150 shares cost 8040 -> avg 53.60. Sold 40 @ 70 -> net 2786, cost of 40 = 2144, profit = 642
      expect(res.finalState.totalRealizedPL).toBe('642.00');
      expect(res.finalState.costBasis).toBe('5896.00'); // 8040 - 2144
    });

    it('rejects a ledger where a sale exceeds available shares at that point in time', () => {
      const txs: RawTransaction[] = [
        {
          id: '1',
          type: 'BUY',
          date: '2026-01-01',
          quantity: 50,
          pricePerShare: 50,
          brokerageRate: 0.005,
        },
        {
          id: '2',
          type: 'SELL',
          date: '2026-01-02',
          quantity: 100, // Invalid! Only 50 available
          pricePerShare: 60,
          brokerageRate: 0.005,
        },
      ];

      const res = replayLedger(txs);
      expect(res.valid).toBe(false);
      expect(res.error).toBeDefined();
    });
  });
});
