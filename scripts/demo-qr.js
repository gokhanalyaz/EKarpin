/**
 * En son iOS build'inin kurulum linkini bulur ve Terminal'de QR kod olarak
 * gösterir. Kullanım (proje klasöründe):  node scripts/demo-qr.js
 */
const { execSync } = require('child_process');

console.log('Son build aranıyor, birkaç saniye sürebilir...\n');
const raw = execSync('npx --yes eas-cli build:list --platform ios --limit 1 --json --non-interactive', {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit'],
});
const start = raw.indexOf('[');
const builds = JSON.parse(raw.slice(start));
if (!builds.length) {
  console.log('Hiç iOS build bulunamadı.');
  process.exit(1);
}
const build = builds[0];
const url = `https://expo.dev/accounts/gokhanalyaz/projects/DijitalKarpin/builds/${build.id}`;
console.log(`Build: ${build.buildProfile ?? ''} · ${build.status ?? ''}`);
console.log(`Link: ${url}\n`);
execSync(`npx --yes qrcode-terminal "${url}"`, { stdio: 'inherit' });
console.log('\nBu QR kodu iPhone kamerasıyla okutun, açılan sayfada Install deyin.');
