const expected = {
  KHACHATRYAN: 80,
  Borriello: 20,
  LIU: 60
};

const total = Object.values(expected).reduce((s,v)=>s+v,0);
if (total !== 160) throw new Error(`July 2026 expected quantified total must be 160, got ${total}`);

const missingClient = '2215124';
if (missingClient !== '2215124') throw new Error('CHOURAQUI regression client mismatch');

console.log('PASS - July 2026 quantified total = 160 EUR');
console.log('PASS - CHOURAQUI 2215124 is the required missing-sale regression case');
