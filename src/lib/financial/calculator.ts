import {
  type DecimalInput,
  toDecimal,
  add,
  sub,
  mul,
  div,
  isZero,
  gt,
  round2,
  round4,
  ZERO,
  ONE,
} from './decimal';

export interface PurchaseCalculation {
  quantity: string; // decimal string
  pricePerShare: string;
  grossAmount: string; // quantity * price
  brokerageRate: string; // e.g. '0.005'
  brokerageAmount: string; // grossAmount * rate
  totalCost: string; // grossAmount + brokerageAmount
  costPerShare: string; // totalCost / quantity
}

export interface WeightedAverageUpdate {
  previousShares: string;
  previousCostBasis: string;
  newPurchase: PurchaseCalculation;
  updatedTotalShares: string;
  updatedTotalCostBasis: string;
  updatedAveragePrice: string; // updatedTotalCostBasis / updatedTotalShares
}

export interface MinimumSellingPrice {
  averagePurchasePrice: string;
  sellingBrokerageRate: string;
  breakEvenPrice: string; // avgPrice / (1 - sellingBrokerageRate)
}

export interface SaleCalculation {
  sellingQuantity: string;
  sellingPricePerShare: string;
  grossSellingAmount: string; // qty * price
  sellingBrokerageRate: string;
  sellingBrokerageAmount: string; // gross * rate
  netSellingAmount: string; // gross - brokerage
  preSaleAverageCost: string; // weighted avg cost before this sale
  costBasisOfSharesSold: string; // qty * preSaleAverageCost
  realizedProfitLoss: string; // net - costBasis
  realizedProfitLossPercent: string; // (realizedPL / costBasis) * 100
  remainingShares: string;
  remainingCostBasis: string; // previous cost basis - cost of sold shares
  grossCostOfSharesSold?: string; // qty * preSaleAverageGrossPrice
  grossRealizedProfitLoss?: string; // grossSellingAmount - grossCostOfSharesSold
  grossRealizedProfitLossPercent?: string;
}

export interface UnrealizedCalculation {
  availableShares: string;
  remainingCostBasis: string;
  remainingGrossCost?: string;
  manualMarketPrice: string | null;
  currentMarketValue: string | null; // shares * price
  estimatedSellingBrokerage: string | null; // marketValue * rate
  unrealizedProfitLoss: string | null; // net (after selling brokerage & buying brokerage)
  unrealizedProfitLossPercent: string | null;
  grossUnrealizedProfitLoss?: string | null; // gross (marketValue - remainingGrossCost)
  grossUnrealizedProfitLossPercent?: string | null;
  priceLastUpdated: string | null; // ISO date string
}

export interface PortfolioTotals {
  totalSharesPurchased: string;
  totalSharesSold: string;
  totalAvailableShares: string;
  cumulativePurchaseCost: string;
  remainingInvestmentCostBasis: string;
  remainingGrossCostBasis?: string;
  currentMarketValue: string | null;
  totalRealizedProfitLoss: string;
  totalGrossRealizedProfitLoss?: string;
  totalUnrealizedProfitLoss: string | null;
  totalGrossUnrealizedProfitLoss?: string | null;
  totalBrokeragePaid: string;
}

export function calculatePurchase(
  quantity: DecimalInput,
  pricePerShare: DecimalInput,
  brokerageRate: DecimalInput = '0.005'
): PurchaseCalculation {
  const q = toDecimal(quantity);
  const p = toDecimal(pricePerShare);
  const rate = toDecimal(brokerageRate);

  const grossAmount = mul(q, p);
  const brokerageAmount = mul(grossAmount, rate);
  const totalCost = add(grossAmount, brokerageAmount);
  const costPerShare = isZero(q) ? ZERO : div(totalCost, q);

  return {
    quantity: q.toString(),
    pricePerShare: round4(p),
    grossAmount: round2(grossAmount),
    brokerageRate: round4(rate),
    brokerageAmount: round2(brokerageAmount),
    totalCost: round2(totalCost),
    costPerShare: round4(costPerShare),
  };
}

export function calculateWeightedAverage(
  previousShares: DecimalInput,
  previousCostBasis: DecimalInput,
  purchase: PurchaseCalculation
): WeightedAverageUpdate {
  const prevShares = toDecimal(previousShares);
  const prevCost = toDecimal(previousCostBasis);
  const purchaseShares = toDecimal(purchase.quantity);
  const purchaseCost = toDecimal(purchase.totalCost);

  const updatedTotalShares = add(prevShares, purchaseShares);
  const updatedTotalCostBasis = add(prevCost, purchaseCost);
  const updatedAveragePrice = isZero(updatedTotalShares)
    ? ZERO
    : div(updatedTotalCostBasis, updatedTotalShares);

  return {
    previousShares: prevShares.toString(),
    previousCostBasis: round2(prevCost),
    newPurchase: purchase,
    updatedTotalShares: updatedTotalShares.toString(),
    updatedTotalCostBasis: round2(updatedTotalCostBasis),
    updatedAveragePrice: round4(updatedAveragePrice),
  };
}

export function calculateMinimumSellingPrice(
  averagePurchasePrice: DecimalInput,
  sellingBrokerageRate: DecimalInput = '0.005'
): MinimumSellingPrice {
  const avgPrice = toDecimal(averagePurchasePrice);
  const rate = toDecimal(sellingBrokerageRate);
  const oneMinusRate = sub(ONE, rate);

  if (oneMinusRate.lte(ZERO)) {
    throw new Error('Selling brokerage rate must be less than 1 (100%)');
  }

  const breakEvenPrice = div(avgPrice, oneMinusRate);

  return {
    averagePurchasePrice: round4(avgPrice),
    sellingBrokerageRate: round4(rate),
    breakEvenPrice: round4(breakEvenPrice),
  };
}

export function calculateSale(
  sellingQuantity: DecimalInput,
  sellingPricePerShare: DecimalInput,
  preSaleAverageCost: DecimalInput,
  preSaleAvailableShares: DecimalInput,
  preSaleCostBasis: DecimalInput,
  sellingBrokerageRate: DecimalInput = '0.005',
  preSaleAverageGrossPrice?: DecimalInput
): SaleCalculation {
  const sellQty = toDecimal(sellingQuantity);
  const sellPrice = toDecimal(sellingPricePerShare);
  const avgCost = toDecimal(preSaleAverageCost);
  const availShares = toDecimal(preSaleAvailableShares);
  const preCostBasis = toDecimal(preSaleCostBasis);
  const rate = toDecimal(sellingBrokerageRate);

  if (gt(sellQty, availShares)) {
    throw new Error(
      `Selling quantity (${sellQty.toString()}) exceeds available shares (${availShares.toString()})`
    );
  }

  const grossSellingAmount = mul(sellQty, sellPrice);
  const sellingBrokerageAmount = mul(grossSellingAmount, rate);
  const netSellingAmount = sub(grossSellingAmount, sellingBrokerageAmount);

  const remainingShares = sub(availShares, sellQty);
  const costBasisOfSharesSold = remainingShares.isZero()
    ? preCostBasis
    : mul(sellQty, avgCost);
  const realizedProfitLoss = sub(netSellingAmount, costBasisOfSharesSold);
  const realizedProfitLossPercent = isZero(costBasisOfSharesSold)
    ? ZERO
    : mul(div(realizedProfitLoss, costBasisOfSharesSold), 100);

  const remainingCostBasis = remainingShares.isZero()
    ? ZERO
    : sub(preCostBasis, costBasisOfSharesSold);

  const avgGross = preSaleAverageGrossPrice !== undefined ? toDecimal(preSaleAverageGrossPrice) : avgCost;
  const grossCostOfSharesSold = mul(sellQty, avgGross);
  const grossRealizedProfitLoss = sub(grossSellingAmount, grossCostOfSharesSold);
  const grossRealizedProfitLossPercent = isZero(grossCostOfSharesSold)
    ? ZERO
    : mul(div(grossRealizedProfitLoss, grossCostOfSharesSold), 100);

  return {
    sellingQuantity: sellQty.toString(),
    sellingPricePerShare: round4(sellPrice),
    grossSellingAmount: round2(grossSellingAmount),
    sellingBrokerageRate: round4(rate),
    sellingBrokerageAmount: round2(sellingBrokerageAmount),
    netSellingAmount: round2(netSellingAmount),
    preSaleAverageCost: round4(avgCost),
    costBasisOfSharesSold: round2(costBasisOfSharesSold),
    realizedProfitLoss: round2(realizedProfitLoss),
    realizedProfitLossPercent: round2(realizedProfitLossPercent),
    remainingShares: remainingShares.toString(),
    remainingCostBasis: round2(remainingCostBasis),
    grossCostOfSharesSold: round2(grossCostOfSharesSold),
    grossRealizedProfitLoss: round2(grossRealizedProfitLoss),
    grossRealizedProfitLossPercent: round2(grossRealizedProfitLossPercent),
  };
}

export function calculateUnrealized(
  availableShares: DecimalInput,
  remainingCostBasis: DecimalInput,
  manualMarketPrice: DecimalInput | null,
  sellingBrokerageRate: DecimalInput = '0.005',
  priceLastUpdated: string | null = null,
  remainingGrossCost?: DecimalInput | null
): UnrealizedCalculation {
  const shares = toDecimal(availableShares);
  const costBasis = toDecimal(remainingCostBasis);
  const grossCost = remainingGrossCost !== undefined && remainingGrossCost !== null
    ? toDecimal(remainingGrossCost)
    : costBasis;

  if (manualMarketPrice === null || manualMarketPrice === undefined) {
    return {
      availableShares: shares.toString(),
      remainingCostBasis: round2(costBasis),
      remainingGrossCost: round2(grossCost),
      manualMarketPrice: null,
      currentMarketValue: null,
      estimatedSellingBrokerage: null,
      unrealizedProfitLoss: null,
      unrealizedProfitLossPercent: null,
      grossUnrealizedProfitLoss: null,
      grossUnrealizedProfitLossPercent: null,
      priceLastUpdated: priceLastUpdated ?? null,
    };
  }

  const price = toDecimal(manualMarketPrice);
  const rate = toDecimal(sellingBrokerageRate);
  const currentMarketValue = mul(shares, price);
  const estimatedSellingBrokerage = mul(currentMarketValue, rate);
  const unrealizedProfitLoss = sub(sub(currentMarketValue, estimatedSellingBrokerage), costBasis);
  const unrealizedProfitLossPercent = isZero(costBasis)
    ? ZERO
    : mul(div(unrealizedProfitLoss, costBasis), 100);

  const grossUnrealizedProfitLoss = sub(currentMarketValue, grossCost);
  const grossUnrealizedProfitLossPercent = isZero(grossCost)
    ? ZERO
    : mul(div(grossUnrealizedProfitLoss, grossCost), 100);

  return {
    availableShares: shares.toString(),
    remainingCostBasis: round2(costBasis),
    remainingGrossCost: round2(grossCost),
    manualMarketPrice: round4(price),
    currentMarketValue: round2(currentMarketValue),
    estimatedSellingBrokerage: round2(estimatedSellingBrokerage),
    unrealizedProfitLoss: round2(unrealizedProfitLoss),
    unrealizedProfitLossPercent: round2(unrealizedProfitLossPercent),
    grossUnrealizedProfitLoss: round2(grossUnrealizedProfitLoss),
    grossUnrealizedProfitLossPercent: round2(grossUnrealizedProfitLossPercent),
    priceLastUpdated: priceLastUpdated ?? null,
  };
}

export function calculatePortfolioTotals(
  holdings: Array<{
    totalPurchased: string;
    totalSold: string;
    available: string;
    cumulativeCost: string;
    remainingCostBasis: string;
    remainingGrossCost?: string;
    currentMarketValue: string | null;
    realizedPL: string;
    grossRealizedPL?: string;
    unrealizedPL: string | null;
    grossUnrealizedPL?: string | null;
    totalBrokerage: string;
  }>
): PortfolioTotals {
  let totalSharesPurchased = ZERO;
  let totalSoldShares = ZERO;
  let totalAvailableShares = ZERO;
  let cumulativePurchaseCost = ZERO;
  let remainingInvestmentCostBasis = ZERO;
  let remainingGrossCostBasis = ZERO;
  let totalRealizedProfitLoss = ZERO;
  let totalGrossRealizedProfitLoss = ZERO;
  let totalBrokeragePaid = ZERO;

  let hasAnyActiveMissingPrice = false;
  let hasAtLeastOneMarketValue = false;
  let marketValueSum = ZERO;

  let hasAnyActiveMissingUnrealized = false;
  let hasAtLeastOneUnrealized = false;
  let unrealizedPLSum = ZERO;
  let grossUnrealizedPLSum = ZERO;

  for (const h of holdings) {
    totalSharesPurchased = add(totalSharesPurchased, h.totalPurchased);
    totalSoldShares = add(totalSoldShares, h.totalSold);
    totalAvailableShares = add(totalAvailableShares, h.available);
    cumulativePurchaseCost = add(cumulativePurchaseCost, h.cumulativeCost);
    remainingInvestmentCostBasis = add(remainingInvestmentCostBasis, h.remainingCostBasis);
    remainingGrossCostBasis = add(remainingGrossCostBasis, h.remainingGrossCost || h.remainingCostBasis);
    totalRealizedProfitLoss = add(totalRealizedProfitLoss, h.realizedPL);
    totalGrossRealizedProfitLoss = add(totalGrossRealizedProfitLoss, h.grossRealizedPL || h.realizedPL);
    totalBrokeragePaid = add(totalBrokeragePaid, h.totalBrokerage);

    const isAvailable = gt(h.available, 0);

    if (h.currentMarketValue !== null) {
      hasAtLeastOneMarketValue = true;
      marketValueSum = add(marketValueSum, h.currentMarketValue);
    } else if (isAvailable) {
      hasAnyActiveMissingPrice = true;
    }

    if (h.unrealizedPL !== null) {
      hasAtLeastOneUnrealized = true;
      unrealizedPLSum = add(unrealizedPLSum, h.unrealizedPL);
      if (h.grossUnrealizedPL !== null && h.grossUnrealizedPL !== undefined) {
        grossUnrealizedPLSum = add(grossUnrealizedPLSum, h.grossUnrealizedPL);
      } else {
        grossUnrealizedPLSum = add(grossUnrealizedPLSum, h.unrealizedPL);
      }
    } else if (isAvailable) {
      hasAnyActiveMissingUnrealized = true;
    }
  }

  const currentMarketValue =
    holdings.length > 0 && hasAtLeastOneMarketValue && !hasAnyActiveMissingPrice
      ? round2(marketValueSum)
      : null;

  const totalUnrealizedProfitLoss =
    holdings.length > 0 && hasAtLeastOneUnrealized && !hasAnyActiveMissingUnrealized
      ? round2(unrealizedPLSum)
      : null;

  const totalGrossUnrealizedProfitLoss =
    holdings.length > 0 && hasAtLeastOneUnrealized && !hasAnyActiveMissingUnrealized
      ? round2(grossUnrealizedPLSum)
      : null;

  return {
    totalSharesPurchased: totalSharesPurchased.toString(),
    totalSharesSold: totalSoldShares.toString(),
    totalAvailableShares: totalAvailableShares.toString(),
    cumulativePurchaseCost: round2(cumulativePurchaseCost),
    remainingInvestmentCostBasis: round2(remainingInvestmentCostBasis),
    remainingGrossCostBasis: round2(remainingGrossCostBasis),
    currentMarketValue,
    totalRealizedProfitLoss: round2(totalRealizedProfitLoss),
    totalGrossRealizedProfitLoss: round2(totalGrossRealizedProfitLoss),
    totalUnrealizedProfitLoss,
    totalGrossUnrealizedProfitLoss,
    totalBrokeragePaid: round2(totalBrokeragePaid),
  };
}
