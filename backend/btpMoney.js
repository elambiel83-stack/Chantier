'use strict';
const precision = (value, digits) => Number.isFinite(value) && Math.abs(value * (10 ** digits) - Math.round(value * (10 ** digits))) < 0.00001;
function calculateQuote(lines, commissionPercent, transportUsd) {
  if (!precision(commissionPercent, 2) || commissionPercent < 0 || commissionPercent > 100 || !precision(transportUsd, 2) || transportUsd < 0 || transportUsd > 1000000) throw new Error('Montants invalides');
  if (!Array.isArray(lines) || !lines.length || lines.length > 100) throw new Error('Lignes invalides');
  const subtotal = lines.reduce((total, line) => {
    if (!precision(line.quantity, 3) || line.quantity <= 0 || line.quantity > 100000 || !precision(line.basePriceUsd, 2) || line.basePriceUsd < 0 || line.basePriceUsd > 1000000) throw new Error('Prix ou quantité invalide');
    const cents = BigInt(Math.round(line.basePriceUsd * 100));
    const milliQuantity = BigInt(Math.round(line.quantity * 1000));
    return total + (cents * milliQuantity + 500n) / 1000n;
  }, 0n);
  const commission = (subtotal * BigInt(Math.round(commissionPercent * 100)) + 5000n) / 10000n;
  const transport = BigInt(Math.round(transportUsd * 100));
  if (subtotal + commission + transport > 99999999999n) throw new Error('Devis trop élevé');
  return { subtotalUsd: Number(subtotal) / 100, commissionUsd: Number(commission) / 100, transportUsd, totalUsd: Number(subtotal + commission + transport) / 100 };
}
module.exports = { calculateQuote, precision };
