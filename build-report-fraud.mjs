const http = require('http');
const fs = require('fs');
const path = require('path');

function fetch(url) {
  return new Promise((res, rej) => {
    http.get(url, (r) => {
      let d = '';
      r.on('data', (c) => d += c);
      r.on('end', () => res({ status: r.statusCode, body: d }));
    }).on('error', rej);
  });
}

const CONTENT = `
<main id="content" class="usa-main-content">
  <div class="usa-section">
    <div class="grid-container">
      <div class="grid-row grid-gap">
        <div class="tablet:grid-col-8">
          <h1 class="usa-display" style="color:#055cb2;">Report Fraud</h1>
          <p class="usa-intro">If you think you've been scammed, defrauded, or experienced identity theft, tell the FTC at ReportFraud.ftc.gov.</p>
          <p>Your report helps the FTC investigate fraud, share information with law enforcement partners around the world, and build cases against scammers.</p>

          <h2 class="usa-heading" style="color:#1d3557;">What to report</h2>
          <ul class="usa-list">
            <li>Fraud, scams, and bad business practices</li>
            <li>Identity theft</li>
            <li>Unwanted calls or texts</li>
            <li>Fake charities, sweepstakes, or lottery scams</li>
            <li>Imposter scams</li>
          </ul>

          <h2 class="usa-heading" style="color:#1d3557;">Before you report</h2>
          <p>Gather any information you have about the scammer, including phone numbers, emails, websites, dates, and amounts of money you may have lost. You don't need proof to file a report.</p>

          <div class="usa-alert usa-alert--info">
            <div class="usa-alert__body">
              <p class="usa-alert__text">The FTC will never ask you to pay money, provide your Social Security number to "verify" an account, or threaten you with arrest.</p>
            </div>
          </div>

          <h2 class="usa-heading" style="color:#1d3557;">How to report</h2>
          <p>For this demonstration mirror, reporting is available by phone or by visiting the real ReportFraud.ftc.gov website.</p>
          <p><a class="usa-button" href="https://reportfraud.ftc.gov/" target="_blank" rel="noopener">Go to ReportFraud.ftc.gov</a></p>
          <p>Or call the FTC Consumer Response Center:</p>
          <ul class="usa-list">
            <li>Phone: <a href="tel:18773824357">1-877-FTC-HELP (1-877-382-4357)</a></li>
            <li>TTY: 1-866-653-4261</li>
          </ul>

          <h2 class="usa-heading" style="color:#1d3557;">What happens after you report</h2>
          <p>Reports are added to the Consumer Sentinel Network, a secure database used by more than 2,000 law enforcement agencies worldwide to investigate fraud and identity theft.</p>

          <p><a href="/">Back to the FTC homepage</a></p>
        </div>
      </div>
    </div>
  </div>
</main>
`;

(async () => {
  const { body } = await fetch('http://127.0.0.1:3001/');
  const mainStart = body.indexOf('<main');
  const mainEnd = body.indexOf('</main>');
  if (mainStart < 0 || mainEnd < 0) { console.error('main markers not found'); process.exit(1); }
  const head = body.slice(0, mainStart);
  const tail = body.slice(mainEnd);
  const page = head + CONTENT + '\n' + tail;
  const outDir = path.join(__dirname, 'site', 'report-fraud');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), page);
  console.log('written:', path.join(outDir, 'index.html'), page.length, 'bytes');
  console.log('header kept:', head.length, 'footer kept:', tail.length);
})().catch((e) => { console.error(e); process.exit(1); });