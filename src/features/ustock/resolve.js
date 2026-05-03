import * as cheerio from 'cheerio';
import { findCachedUstockStock, normalizeStockCacheKey, saveCachedUstockStock } from './cache.js';
import { fetchRenderedPage } from './http.js';
import { parseStockIdentity } from './parse.js';
import { normalizeSpaces } from '../../utils/format.js';

const USTOCK_BASE_URL = 'https://ustock.naver.com';
const USTOCK_SEARCH_SOURCES = [
  `${USTOCK_BASE_URL}/`,
  `${USTOCK_BASE_URL}/stock/rank`
];

export async function resolveUstockStock(stockName) {
  const query = normalizeStockName(stockName);

  if (!query) {
    throw new Error('조회할 종목명을 입력하세요.');
  }

  if (/^https?:\/\//.test(query)) {
    const resolved = await fetchAndValidateCandidate(query);
    saveCachedUstockStock(resolved);
    return resolved;
  }

  const cached = findCachedUstockStock(query);
  if (cached) {
    try {
      return await fetchAndValidateCandidate(cached.url, query);
    } catch {
      // Stale cache entries fall through to live discovery.
    }
  }

  if (/^\d{6}$/.test(query)) {
    const resolved = await fetchAndValidateCandidate(`${USTOCK_BASE_URL}/stock/${query}`);
    saveCachedUstockStock(resolved);
    return resolved;
  }

  const candidates = [];

  for (const sourceUrl of USTOCK_SEARCH_SOURCES) {
    try {
      const source = await fetchRenderedPage(sourceUrl);
      candidates.push(...extractStockCandidates(source.html, source.url, query, true));
    } catch {
      // Source pages are best-effort. Naver search fallback below still runs.
    }
  }

  try {
    const searchUrl = `https://search.naver.com/search.naver?query=${encodeURIComponent(`${query} Npay 비상장`)}`;
    const search = await fetchRenderedPage(searchUrl);
    candidates.push(...extractStockCandidates(search.html, search.url, query, false));
  } catch {
    // Search fallback is best-effort. Candidate validation below handles empty results.
  }

  const uniqueCandidates = uniqueCandidateUrls(candidates);

  for (const candidate of uniqueCandidates) {
    try {
      const resolved = await fetchAndValidateCandidate(candidate.url, query);
      const resolvedName = normalizeStockName(resolved.stockName);

      if (resolvedName === query) {
        saveCachedUstockStock(resolved);
        return resolved;
      }

      if (resolvedName.includes(query) || query.includes(resolvedName)) {
        saveCachedUstockStock(resolved);
        return resolved;
      }
    } catch {
      // Invalid or unrelated search results are ignored.
    }
  }

  throw new Error(`Npay 비상장에서 '${stockName}' 종목을 찾지 못했습니다.`);
}

async function fetchAndValidateCandidate(url, query) {
  const normalizedUrl = normalizeStockUrl(url);
  if (!normalizedUrl) {
    throw new Error(`Npay 비상장 종목 URL이 아닙니다: ${url}`);
  }

  const page = await fetchRenderedPage(normalizedUrl, { waitForText: '체결내역' });
  const identity = parseStockIdentity(page.html);
  const resolvedName = normalizeStockName(identity.stockName);
  const normalizedQuery = normalizeStockName(query);

  if (!identity.stockName) {
    throw new Error(`종목 정보를 찾지 못했습니다: ${normalizedUrl}`);
  }

  if (
    normalizedQuery &&
    !/^\d{6}$/.test(normalizedQuery) &&
    resolvedName !== normalizedQuery &&
    !resolvedName.includes(normalizedQuery) &&
    !normalizedQuery.includes(resolvedName)
  ) {
    throw new Error(`검색어와 다른 종목입니다: ${identity.stockName}`);
  }

  return {
    ...identity,
    html: page.html,
    text: page.text,
    url: normalizeStockUrl(page.url) || normalizedUrl
  };
}

function extractStockCandidates(html, baseUrl, query, requireTextMatch) {
  const $ = cheerio.load(html);
  $('script, style, noscript, svg').remove();
  const candidates = [];

  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');
    const text = normalizeStockName($(element).text());
    const url = normalizeStockUrl(new URL(href, baseUrl).toString());

    if (!url) {
      return;
    }

    if (requireTextMatch && !text.includes(query) && !query.includes(text)) {
      return;
    }

    candidates.push({
      url,
      label: text
    });
  });

  for (const url of extractStockUrlsFromHtml(html)) {
    candidates.push({
      url,
      label: ''
    });
  }

  return candidates;
}

function extractStockUrlsFromHtml(html) {
  const decoded = safeDecodeURIComponent(html);
  const text = `${html}\n${decoded}`;
  const pattern = /https?:\/\/(?:www\.)?ustock\.naver\.com\/stock\/[A-Za-z0-9_-]+/g;
  const urls = [];
  let match;

  while ((match = pattern.exec(text)) !== null) {
    const url = normalizeStockUrl(match[0]);
    if (url) {
      urls.push(url);
    }
  }

  return urls;
}

function normalizeStockUrl(url) {
  try {
    const parsed = new URL(url, USTOCK_BASE_URL);
    const hostname = parsed.hostname.replace(/^www\./, '');

    if (hostname !== 'ustock.naver.com') {
      return '';
    }

    if (!parsed.pathname.startsWith('/stock/') || parsed.pathname === '/stock/rank') {
      return '';
    }

    parsed.protocol = 'https:';
    parsed.hostname = 'ustock.naver.com';
    parsed.search = '';
    parsed.hash = '';

    return parsed.toString();
  } catch {
    return '';
  }
}

function normalizeStockName(value) {
  return normalizeStockCacheKey(normalizeSpaces(value));
}

function uniqueCandidateUrls(candidates) {
  const seen = new Set();
  const result = [];

  for (const candidate of candidates) {
    if (!candidate.url || seen.has(candidate.url)) {
      continue;
    }
    seen.add(candidate.url);
    result.push(candidate);
  }

  return result;
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
