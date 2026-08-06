import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { resolve, dirname, extname, join, basename } from 'path';

const SITE_DIR = resolve(import.meta.dirname, 'site');
const BASE = 'https://www.ftc.gov';
const TIMEOUT = 30000;

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), TIMEOUT);
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      clearTimeout(id);
      if (resp.status === 429) {
        const wait = parseInt(resp.headers.get('Retry-After') || '5');
        await new Promise(r => setTimeout(r, wait * 1000));
        continue;
      }
      return resp;
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  return null;
}

async function download(url, destPath) {
  const fullPath = join(SITE_DIR, destPath);
  if (existsSync(fullPath)) {
    console.log(`  EXISTS: ${destPath}`);
    return;
  }
  mkdirSync(dirname(fullPath), { recursive: true });
  try {
    const resp = await fetchWithRetry(url);
    if (!resp || !resp.ok) {
      console.log(`  FAIL (${resp?.status}): ${url}`);
      return;
    }
    const contentType = resp.headers.get('content-type') || '';
    const isImg = contentType.startsWith('image/');
    let buffer;
    if (isImg) {
      buffer = Buffer.from(await resp.arrayBuffer());
    } else {
      const text = await resp.text();
      // If this is a CSS file that references Google Fonts, save with decoded &amp;
      buffer = Buffer.from(text, 'utf-8');
    }
    writeFileSync(fullPath, buffer);
    console.log(`  OK: ${url} -> ${destPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
  } catch (e) {
    console.log(`  ERR: ${url}: ${e.message}`);
  }
}

async function downloadImages() {
  console.log('\n=== DOWNLOADING MISSING IMAGES ===');

  // These URLs had &amp; in them - decode to proper &
  const imageUrls = [
    '/system/files/styles/crop_thumbnail/private/ftc_gov/images/freedom-250-flag-graphic1.png?itok=JxacvLBI',
    '/system/files/styles/crop_thumbnail/private/ftc_gov/images/refunds-tableau.jpg?itok=uqgwQ2yN',
    '/system/files/styles/crop_thumbnail/private/ftc_gov/images/commissioner-andrew-n-ferguson-res.jpg?itok=GZrqrqZc',
    '/system/files/styles/wide_standard_sm/private/ftc_gov/images/mcm2026-featthumb-640x320_003.png?h=7a6e80fd&itok=FY7ISMLn',
    '/system/files/styles/wide_standard_sm/private/ftc_gov/images/creditreport-smaller-istock-187135395.jpg?h=f7d9296c&itok=LFGrbjCS',
    '/system/files/styles/wide_standard_sm/private/ftc_gov/images/cellphone-scamcall-smaller-istock-1391824262.jpg?h=6822bf2b&itok=fFkTehPg',
    '/sites/default/files/styles/crop_thumbnail/public/ftc_gov/images/covid-map-tableau.jpg?itok=M9ZkvgoM',
    '/system/files/styles/wide_standard_sm/private/ftc_gov/images/ftc-scam-video-ss.png?h=8216a20f&itok=9hDe5CEG',
    '/system/files/styles/wide_standard_banner/private/ftc_gov/images/usa-flag-sunlight-smaller-istock-1407859364.jpg?itok=XCVJmKHE',
    '/system/files/styles/social_standard/private/ftc_gov/images/solarenergy-socmed-1200x630.png?h=ec041e41&itok=L5vHyMMp',
    '/system/files/styles/wide_standard_banner/public/ftc_gov/images/news-events.jpg?itok=nqeAMm5C',
    '/system/files/styles/wide_standard_banner/public/ftc_gov/images/columns.jpg?itok=cYikDSoT',
    '/sites/default/files/styles/wide_standard_banner/public/ftc_gov/images/business-hero-1348x394.png?itok=I80NLiHZ',
    '/system/files/styles/scaled_lg/private/ftc_gov/images/inform-button-728x120.png?itok=JlXwkG5j',
    '/system/files/styles/crop_thumbnail/private/ftc_gov/images/smbusicon-03-waystoprotect.png?itok=jV7X9zIo',
    '/system/files/styles/crop_thumbnail/private/ftc_gov/images/smbusicon-04-spotavoidscams.png?itok=hsswMn4E',
    '/system/files/styles/crop_thumbnail/private/ftc_gov/images/smbusicon-01-howtohandle.png?itok=rEm8e_Sy',
    '/system/files/styles/crop_thumbnail/private/ftc_gov/images/smbusicon-02-wtd-busbreach.png?itok=tYA6ilzj',
    '/system/files/styles/crop_thumbnail/private/ftc_gov/images/smbusicon-05-madeinusa.png?itok=prPUzlqy',
    '/system/files/styles/wide_standard_sm/private/ftc_gov/images/scales-640x360.png?h=7a6e80fd&itok=T_N8vlAd',
    '/system/files/styles/wide_standard_sm/private/ftc_gov/images/tida-640x360.png?h=7a6e80fd&itok=tLVbzGhu',
    '/sites/default/files/styles/social_standard/public/images/press-releases/social-share/badge-explore-data-ftc-refunds-fb_0.png?h=ec041e41&itok=O8xF38KO',
    '/system/files/styles/wide_standard_sm/private/ftc_gov/images/musa-640x360_5.png?h=7a6e80fd&itok=-D9H920e',
    '/system/files/styles/scaled_sm/public/ftc_gov/images/badge-explore-data-ftc-refunds-resized.jpg?itok=Yc2wmn7d',
    '/sites/default/files/styles/wide_standard_sm/public/video_image/1305620551001_4738991847001_video-0124-business-sws09-KeepSecurityCurrent-640x360.jpg?h=7a6e80fd&itok=YX3VQZ8a',
    '/sites/default/files/styles/wide_standard_sm/public/video_image/1305620551001_3839176339001_video-0069-business-debt-collection-640x360.jpg?h=7a6e80fd&itok=PNfR_sv0',
    '/sites/default/files/styles/wide_standard_sm/public/video_image/1305620551001_4642633566001_video-0112-business-sws06-SecureRemoteAccess-640x360.jpg?h=7a6e80fd&itok=t30Mk6do',
    '/sites/default/files/styles/wide_standard_sm/public/video_embed_field_thumbnails/vimeo/352604641.jpg?h=b3d4a7b7&itok=STetkhhq',
    '/sites/default/files/styles/wide_standard_sm/public/coppa-featres-212x145_3.png?h=ce3b136b&itok=rjB90Nx-',
    '/themes/custom/ftc_uswds/uswds/dist/img/close.svg',
    '/themes/custom/ftc_uswds/uswds/dist/img/icon-dot-gov.svg',
    '/themes/custom/ftc_uswds/uswds/dist/img/icon-https.svg',
    '/themes/custom/ftc_uswds/uswds/dist/img/us_flag_small.png',
    '/sites/default/files/ftc_gov/images/ftc_social_share_default_en.jpg',
    '/system/files/ftc_gov/images/HealthPrivacy-Button-v2-728x120.png',
    '/system/files/ftc_gov/images/Safeguard-Button-728x120.png',
    '/sites/default/files/u1140/euprivacyshield_0.jpg',
  ];

  for (const imgUrl of imageUrls) {
    const url = BASE + imgUrl;
    const cleanPath = imgUrl.split('?')[0].replace(/^\//, '');
    await download(url, cleanPath);
  }
}

async function downloadExternalResources() {
  console.log('\n=== DOWNLOADING EXTERNAL RESOURCES ===');

  const externals = [
    {
      url: 'https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,500;0,600;1,500;1,600&family=Inter:wght@400;500;600&display=swap',
      dest: '_external/fonts.googleapis.com/css2/family=Cormorant:ital,wght@0,500;0,600;1,500;1,600&family=Inter:wght@400;500;600&display=swap.css'
    },
    {
      url: 'https://use.fontawesome.com/releases/v6.4.2/js/all.js',
      dest: '_external/use.fontawesome.com/releases/v6.4.2/js/all.js'
    },
    {
      url: 'https://use.fontawesome.com/releases/v6.4.2/js/v4-shims.js',
      dest: '_external/use.fontawesome.com/releases/v6.4.2/js/v4-shims.js'
    },
    {
      url: 'https://static.addtoany.com/menu/page.js',
      dest: '_external/static.addtoany.com/menu/page.js'
    },
  ];

  for (const ext of externals) {
    await download(ext.url, ext.dest);
  }

  // Also download Google Fonts files referenced from the CSS
  // First fetch the Google Fonts CSS to find font file URLs
  try {
    const resp = await fetchWithRetry(externals[0].url);
    if (resp && resp.ok) {
      const css = await resp.text();
      const fontUrls = css.match(/url\(([^)]+)\)/g);
      if (fontUrls) {
        for (const fu of fontUrls) {
          const fontUrl = fu.replace(/^url\(/, '').replace(/\)$/, '').replace(/["']/g, '');
          if (fontUrl.startsWith('https://')) {
            const fontDest = '_external/' + fontUrl.replace(/https?:\/\//, '');
            await download(fontUrl, fontDest);
          }
        }
      }
    }
  } catch (e) {
    console.log('  ERR downloading Google Fonts CSS:', e.message);
  }
}

async function downloadJsAssets() {
  console.log('\n=== DOWNLOADING REMAINING JS ASSETS ===');

  const jsUrls = [
    '/core/misc/ajax.js',
    '/core/misc/announce.js',
    '/core/misc/debounce.js',
    '/core/misc/dialog/dialog.ajax.js',
    '/core/misc/dialog/dialog.jquery-ui.js',
    '/core/misc/dialog/dialog.js',
    '/core/misc/dialog/dialog.position.js',
    '/core/misc/dialog/dialog-deprecation.js',
    '/core/misc/displace.js',
    '/core/misc/drupal.init.js',
    '/core/misc/drupal.js',
    '/core/misc/drupalSettingsLoader.js',
    '/core/misc/jquery.tabbable.shim.js',
    '/core/misc/message.js',
    '/core/misc/position.js',
    '/core/misc/progress.js',
    '/modules/contrib/addtoany/js/addtoany.js',
    '/modules/contrib/extlink/js/extlink.js',
    '/modules/contrib/extlink_extra/js/extlink_extra.js',
    '/modules/custom/miniorange_saml/js/testconfig.js',
    '/themes/custom/ftc_uswds/build/js/script.js',
    '/themes/custom/ftc_uswds/build/js/navigation.js',
    '/themes/custom/ftc_uswds/build/js/returnToTop.js',
    '/themes/custom/ftc_uswds/uswds/dist/js/uswds.js',
  ];

  for (const jsUrl of jsUrls) {
    const url = BASE + jsUrl;
    const cleanPath = jsUrl.replace(/^\//, '');
    await download(url, cleanPath);
  }
}

async function downloadAdditionalPages() {
  console.log('\n=== DOWNLOADING ADDITIONAL PAGES ===');

  const pages = [
    '/about-ftc',
    '/about-ftc/commissioners',
    '/about-ftc/bureaus-offices',
    '/about-ftc/contact',
    '/about-ftc/careers',
    '/about-ftc/faqs',
    '/about-ftc/performance-reporting',
    '/about-ftc/website-policies',
    '/about-ftc/foia',
    '/about-ftc/no-fear-act',
    '/about-ftt/bureaus-offices/bureau-consumer-protection',
    '/about-ftc/bureaus-offices/bureau-competition',
    '/about-ftc/bureaus-offices/bureau-economics',
    '/about-ftc/advisory-committees',
    '/enforcement-policy/competition-enforcement',
    '/enforcement-policy/consumer-protection-enforcement',
    '/enforcement/competition-matters/2026',
    '/enforcement/competition-matters/2025',
    '/about-ftc/commissioners/andrew-ferguson',
    '/about-ftc/commissioners/melissa-holyoak',
    '/about-ftc/commissioners/alvaro-bedoya',
    '/news-events/events/2026',
    '/news-events/news/press-releases/2026',
    '/news-events/features/2026',
    '/news-events/topics/consumer-protection',
    '/news-events/topics/competition',
    '/business-guidance/blog/2026',
    '/business-guidance/blog/2025',
    '/business-guidance/resources/competition',
    '/business-guidance/resources/consumer-protection',
    '/consumer',
    '/consumer/alert',
    '/consumer/advice',
    '/consumer/scams',
    '/consumer/identity-theft',
    '/consumer/job-scams',
    '/consumer/credit-loans-debt',
    '/consumer/shopping',
    '/consumer/small-business',
    '/consumer/privacy-security',
    '/data-and-analysis',
    '/data-and-analysis/sentinel-annual-reports',
    '/data-and-analysis/do-not-call-data',
    '/data-and-analysis/consumer-sentinel-network-data',
    '/about-ftc/contact/consumer-response-center',
    '/about-ftc/contact/file-report',
  ];

  for (const page of pages) {
    const url = BASE + page;
    const localPath = (page.replace(/^\//, '') || 'index') + '/index.html';
    if (existsSync(join(SITE_DIR, localPath))) {
      console.log(`  EXISTS: ${localPath}`);
      continue;
    }
    const fullPath = join(SITE_DIR, localPath);
    mkdirSync(dirname(fullPath), { recursive: true });
    try {
      const resp = await fetchWithRetry(url);
      if (resp && resp.ok) {
        const html = await resp.text();
        writeFileSync(fullPath, html, 'utf-8');
        console.log(`  OK: ${url} -> ${localPath} (${(html.length / 1024).toFixed(1)} KB)`);

        // Extract and download assets from this page too
        const assetUrls = html.matchAll(/(?:src|href)="([^"]+)"/g);
        for (const m of assetUrls) {
          let u = m[1];
          if (u.startsWith('//')) u = 'https:' + u;
          if (u.startsWith('/') && !u.startsWith('//')) {
            u = BASE + u;
          }
          if (u.startsWith(BASE)) {
            const path = u.replace(BASE, '');
            const clean = path.split('?')[0].split('#')[0].replace(/^\//, '');
            if (clean && !existsSync(join(SITE_DIR, clean))) {
              await download(u, clean);
            }
          }
        }
      } else {
        console.log(`  SKIP (${resp?.status}): ${url}`);
      }
    } catch (e) {
      console.log(`  ERR: ${url}: ${e.message}`);
    }
  }
}

async function main() {
  await downloadImages();
  await downloadExternalResources();
  await downloadJsAssets();
  await downloadAdditionalPages();
  console.log('\n=== ALL DOWNLOADS COMPLETE ===');
}

main().catch(console.error);
