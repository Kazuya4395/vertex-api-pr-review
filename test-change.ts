/**
 * E2E verification test file for structured PR review.
 * This file exists solely to trigger AI code review on this PR.
 * It should be deleted after verification.
 */

const calculateDiscount = (price: number, rate: number) => {
  // TODO: add input validation
  return price * rate;
};

const formatCurrency = (amount: number): string => {
  return `$${amount.toFixed(2)}`;
};

const processOrder = async (items: { name: string; price: number }[]) => {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total = total + items[i].price;
  }
  const discount = calculateDiscount(total, 0.1);
  const finalPrice = total - discount;
  console.log(formatCurrency(finalPrice));
  return finalPrice;
};

export { calculateDiscount, formatCurrency, processOrder };
