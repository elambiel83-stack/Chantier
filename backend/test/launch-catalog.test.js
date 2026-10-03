const test = require('node:test');
const assert = require('node:assert/strict');
const { offers, purchaseError } = require('../../web/launch-catalog');
test('block offers preserve confirmed dimensions, prices and minimum', () => {
  const a = offers.find(x => x.id === 'CH-BLC-15');
  const b = offers.find(x => x.id === 'CH-BLC-20');
  assert.equal(a.price, 1.3); assert.equal(b.price, 1.5);
  assert.match(a.name_fr, /15 × 20 × 40/); assert.match(b.name_fr, /20 × 20 × 40/);
  assert.equal(a.minimumQuantity, 100); assert.equal(b.minimumQuantity, 100);
});
test('launch purchases cannot bypass quote confirmation, even above minimum', () => {
  assert.match(purchaseError('CH-BLC-15', 99), /minimale/);
  assert.match(purchaseError('CH-BLC-20', 100), /devis/);
  assert.match(purchaseError('CH-GRAVIER', 10), /devis/);
  assert.equal(purchaseError('CIM-001', 1), null);
  assert.ok(offers.every(x => x.stock === 0 && x.quoteOnly));
});
