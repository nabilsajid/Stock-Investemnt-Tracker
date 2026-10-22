import { add, sub, mul, div, gt, isZero, round2, round4, toDecimal, ZERO } from './decimal';
import { calculatePurchase, calculateSale, calculateWeightedAverage } from './calculator';

export type TransactionType = 'BUY' | 'SELL';

export interface RawTransaction {
  id: string;
  type: TransactionType;
  date: string; // ISO date
  quantity: number;
  pricePerShare: number;
  brokerageRate: number;
  sequence?: number; // for ordering same-day transactions
}

export interface ReplayState {
  availableShares: string;
  totalSharesPurchased: string;
  totalSharesSold: string;
  costBasis: string; // remaining cost basis
  cumulativePurchaseCost: string;
  averagePurchasePrice: string;
  totalRealizedPL: string;
  totalBrokeragePaid: string;
  grossCostBasis?: string;
  averagePurchasePriceGross?: string;
  totalGrossRealizedPL?: string;
  lastRealizedPL?: string;
  lastGrossRealizedPL?: string;
}

export interface ReplayResult {
  valid: boolean;
  error?: string; // describes which transaction causes an invalid state
  finalState: ReplayState;
  transactionStates: Map<string, ReplayState>; // state after each txn by id
}

function compareTransactions(a: RawTransaction, b: RawTransaction): number {
  const timeA = new Date(a.date).getTime();
  const timeB = new Date(b.date).getTime();

  if (!isNaN(timeA) && !isNaN(timeB)) {
    if (timeA !== timeB) {
      return timeA - timeB;
    }
  } else {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) {
      return dateCmp;
    }
  }

  const hasSeqA = a.sequence !== undefined && a.sequence !== null;
  const hasSeqB = b.sequence !== undefined && b.sequence !== null;

  if (hasSeqA && hasSeqB && a.sequence !== b.sequence) {
    return (a.sequence as number) - (b.sequence as number);
  }

  if (a.type !== b.type) {
    return a.type === 'BUY' ? -1 : 1;
  }

  if (hasSeqA && !hasSeqB) return -1;
  if (!hasSeqA && hasSeqB) return 1;

  return 0;
}

export function replayLedger(transactions: RawTransaction[]): ReplayResult {
  const sortedTransactions = [...transactions].sort(compareTransactions);

  let currentState: ReplayState = {
    availableShares: '0',
    totalSharesPurchased: '0',
    totalSharesSold: '0',
    costBasis: round2(ZERO),
    cumulativePurchaseCost: round2(ZERO),
    averagePurchasePrice: round4(ZERO),
    totalRealizedPL: round2(ZERO),
    totalBrokeragePaid: round2(ZERO),
    grossCostBasis: round2(ZERO),
    averagePurchasePriceGross: round4(ZERO),
    totalGrossRealizedPL: round2(ZERO),
  };

  const transactionStates = new Map<string, ReplayState>();

  for (const txn of sortedTransactions) {
    if (txn.type === 'BUY') {
      const purchase = calculatePurchase(txn.quantity, txn.pricePerShare, txn.brokerageRate);
      const weighted = calculateWeightedAverage(
        currentState.availableShares,
        currentState.costBasis,
        purchase
      );

      const rawGrossAmount = mul(txn.quantity, txn.pricePerShare);
      const prevGross = currentState.grossCostBasis ? toDecimal(currentState.grossCostBasis) : ZERO;
      const updatedGrossCost = add(prevGross, rawGrossAmount);
      const updatedSharesDec = toDecimal(weighted.updatedTotalShares);
      const avgGrossPrice = isZero(updatedSharesDec) ? ZERO : div(updatedGrossCost, updatedSharesDec);

      currentState = {
        availableShares: weighted.updatedTotalShares,
        totalSharesPurchased: add(currentState.totalSharesPurchased, txn.quantity).toString(),
        totalSharesSold: currentState.totalSharesSold,
        costBasis: weighted.updatedTotalCostBasis,
        cumulativePurchaseCost: round2(add(currentState.cumulativePurchaseCost, purchase.totalCost)),
        averagePurchasePrice: weighted.updatedAveragePrice,
        totalRealizedPL: currentState.totalRealizedPL,
        totalBrokeragePaid: round2(add(currentState.totalBrokeragePaid, purchase.brokerageAmount)),
        grossCostBasis: round2(updatedGrossCost),
        averagePurchasePriceGross: round4(avgGrossPrice),
        totalGrossRealizedPL: currentState.totalGrossRealizedPL,
        lastRealizedPL: undefined,
        lastGrossRealizedPL: undefined,
      };
    } else if (txn.type === 'SELL') {
      const sellQty = toDecimal(txn.quantity);
      const avail = toDecimal(currentState.availableShares);

      if (gt(sellQty, avail)) {
        return {
          valid: false,
          error: `Cannot sell ${txn.quantity} shares at ${txn.date}: only ${currentState.availableShares} available (transaction ${txn.id})`,
          finalState: currentState,
          transactionStates,
        };
      }

      const sale = calculateSale(
        txn.quantity,
        txn.pricePerShare,
        currentState.averagePurchasePrice,
        currentState.availableShares,
        currentState.costBasis,
        txn.brokerageRate
      );

      const remShares = sale.remainingShares;
      const isZeroShares = isZero(remShares);

      const avgGross = currentState.averagePurchasePriceGross
        ? toDecimal(currentState.averagePurchasePriceGross)
        : toDecimal(currentState.averagePurchasePrice);
      const grossCostOfSold = isZeroShares
        ? (currentState.grossCostBasis ? toDecimal(currentState.grossCostBasis) : mul(sellQty, avgGross))
        : mul(sellQty, avgGross);
      const grossSellingAmount = mul(sellQty, txn.pricePerShare);
      const grossRealizedPL = sub(grossSellingAmount, grossCostOfSold);
      const prevGrossRealized = currentState.totalGrossRealizedPL
        ? toDecimal(currentState.totalGrossRealizedPL)
        : ZERO;
      const updatedTotalGrossRealized = add(prevGrossRealized, grossRealizedPL);
      const prevGross = currentState.grossCostBasis ? toDecimal(currentState.grossCostBasis) : ZERO;
      const remGrossCost = isZeroShares ? ZERO : sub(prevGross, grossCostOfSold);

      currentState = {
        availableShares: remShares,
        totalSharesPurchased: currentState.totalSharesPurchased,
        totalSharesSold: add(currentState.totalSharesSold, txn.quantity).toString(),
        costBasis: isZeroShares ? round2(ZERO) : sale.remainingCostBasis,
        cumulativePurchaseCost: currentState.cumulativePurchaseCost,
        averagePurchasePrice: isZeroShares ? round4(ZERO) : currentState.averagePurchasePrice,
        totalRealizedPL: round2(add(currentState.totalRealizedPL, sale.realizedProfitLoss)),
        totalBrokeragePaid: round2(add(currentState.totalBrokeragePaid, sale.sellingBrokerageAmount)),
        grossCostBasis: isZeroShares ? round2(ZERO) : round2(remGrossCost),
        averagePurchasePriceGross: isZeroShares ? round4(ZERO) : currentState.averagePurchasePriceGross,
        totalGrossRealizedPL: round2(updatedTotalGrossRealized),
        lastRealizedPL: round2(sale.realizedProfitLoss),
        lastGrossRealizedPL: round2(grossRealizedPL),
      };
    }

    transactionStates.set(txn.id, { ...currentState });
  }

  return {
    valid: true,
    finalState: currentState,
    transactionStates,
  };
}

export function validateTransactionEdit(
  allTransactions: RawTransaction[],
  editedTransaction: RawTransaction
): ReplayResult {
  const updated = allTransactions.map((txn) =>
    txn.id === editedTransaction.id ? editedTransaction : txn
  );
  return replayLedger(updated);
}

export function validateTransactionDelete(
  allTransactions: RawTransaction[],
  deleteId: string
): ReplayResult {
  const updated = allTransactions.filter((txn) => txn.id !== deleteId);
  return replayLedger(updated);
}
