const { chromium } = require('playwright');
(async () => {
  const [,, inp, out] = process.argv;
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + inp, { waitUntil: 'load' });
  await p.pdf({ path: out, format: 'A4', printBackground: true });
  await b.close();
})();
