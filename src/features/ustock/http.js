import { chromium } from 'playwright';

const DEFAULT_HEADERS = {
  'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  'cache-control': 'no-cache',
  'pragma': 'no-cache',
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
};

export async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: DEFAULT_HEADERS,
    redirect: 'follow'
  });

  if (!response.ok) {
    throw new Error(`페이지 조회 실패: ${response.status} ${response.statusText} (${url})`);
  }

  return {
    html: await response.text(),
    url: response.url || url
  };
}

export async function fetchRenderedPage(url, options = {}) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    locale: 'ko-KR',
    userAgent: DEFAULT_HEADERS['user-agent'],
    extraHTTPHeaders: {
      'accept-language': DEFAULT_HEADERS['accept-language']
    }
  });

  try {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: options.timeout || 30_000
    });

    if (options.waitForText) {
      await page
        .waitForFunction(
          (text) => document.body?.innerText?.includes(text),
          options.waitForText,
          { timeout: options.waitForTimeout || 10_000 }
        )
        .catch(() => {});
    }

    await page.waitForTimeout(options.settleMs || 500);

    return {
      html: await page.content(),
      text: await page.locator('body').innerText({ timeout: 5_000 }),
      url: page.url()
    };
  } finally {
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}
