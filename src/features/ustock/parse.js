import * as cheerio from 'cheerio';
import { parseInteger, parseSignedInteger, normalizeSpaces } from '../../utils/format.js';

export function parseQuotePage(html) {
  const $ = loadBody(getHtml(html));
  const text = getText(html, $);
  const lines = getLines(html, $);

  return {
    ...parseStockIdentity(getHtml(html)),
    summary: parseQuoteSummary(lines),
    dailyQuotes: parseDailyQuotes(lines),
    trades: parseTrades(lines)
  };
}

export function parseInvestmentPage(html) {
  const $ = loadBody(getHtml(html));
  const lines = getLines(html, $);
  const newsLinks = extractNewsLinks($, getUrl(html));

  return {
    news: parseInvestmentNews(lines, newsLinks),
    stockStatus: parseStockStatus(lines)
  };
}

function parseInvestmentNews(lines, newsLinks) {
  const start = lines.findIndex((line) => line === '뉴스/공시' || line.includes('뉴스/공시'));

  if (start < 0) {
    return [];
  }

  const end = lines.findIndex((line, index) => index > start && ['실적', '재무상태', '주요지표', '기업소개'].includes(line));
  const segment = lines
    .slice(start + 1, end > start ? end : undefined)
    .filter((line) => line !== '전체보기')
    .filter((line) => !line.startsWith('Image:'));

  const news = [];

  for (let index = 0; index < segment.length; index += 1) {
    const title = segment[index];
    const source = segment[index + 1];
    const date = segment[index + 2];
    const sourceDate = segment[index + 1];
    const separatedSource = segment[index + 1];
    const separator = segment[index + 2];
    const separatedDate = segment[index + 3];

    if (title && source && /^\d{4}\.\d{2}\.\d{2}$/.test(date)) {
      news.push({
        title,
        source,
        date,
        url: findNewsUrl(newsLinks, title)
      });
      index += 2;
      continue;
    }

    const compactMatch = sourceDate?.match(/^(.+?)\s+(\d{4}\.\d{2}\.\d{2})$/);
    if (title && compactMatch) {
      news.push({
        title,
        source: compactMatch[1],
        date: compactMatch[2],
        url: findNewsUrl(newsLinks, title)
      });
      index += 1;
      continue;
    }

    if (title && separatedSource && separator === '|' && /^\d{4}\.\d{2}\.\d{2}$/.test(separatedDate)) {
      news.push({
        title,
        source: separatedSource,
        date: separatedDate,
        url: findNewsUrl(newsLinks, title)
      });
      index += 3;
    }
  }

  return news;
}

function parseStockStatus(lines) {
  const totalIssuedShares = parseShares(readValueAfterLabel(lines, '총발행주식'));

  return {
    totalIssuedShares
  };
}

function parseShares(value) {
  const match = normalizeSpaces(value).match(/^([\d,]+)\s*주/);
  return match ? parseInteger(match[1]) : 0;
}

function extractNewsLinks($, baseUrl) {
  const links = [];

  $('a[href]').each((_, element) => {
    const title = normalizeSpaces($(element).text());
    const href = $(element).attr('href');
    const url = normalizeLinkUrl(href, baseUrl);

    if (!title || !url) {
      return;
    }

    links.push({
      title,
      url
    });
  });

  return links;
}

function findNewsUrl(links, title) {
  const normalizedTitle = normalizeSpaces(title);
  const exact = links.find((link) => link.title === normalizedTitle);

  if (exact) {
    return exact.url;
  }

  const partial = links.find((link) => link.title.includes(normalizedTitle) || normalizedTitle.includes(link.title));
  return partial?.url || '';
}

function normalizeLinkUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl || 'https://ustock.naver.com').toString();
  } catch {
    return '';
  }
}

export function parseStockIdentity(html) {
  const $ = loadBody(getHtml(html));
  const text = getText(html, $);
  const title = normalizeSpaces($('title').first().text());
  const heading = normalizeSpaces($('h1').first().text());
  const titleName = title.match(/^(.+?)\s+비상장/)?.[1];
  const code = text.match(/(?:일반종목|전문종목)\s*(\d{6})/)?.[1];

  return {
    stockName: heading || titleName || '',
    code: code || ''
  };
}

function parseDailyQuotes(lines) {
  const quotes = [];
  const pattern = /^(\d{4}\.\d{2}\.\d{2})\s+(\d{1,3}(?:,\d{3})+|\d+)\s*([+-]?\d+(?:\.\d+)?%)\s*([+-]?(?:\d{1,3}(?:,\d{3})+|\d+))\s+(\d{1,3}(?:,\d{3})+|\d+)$/;

  for (const line of lines) {
    const match = line.match(pattern);
    if (!match) {
      continue;
    }

    quotes.push({
      date: match[1],
      price: parseInteger(match[2]),
      rate: match[3],
      change: parseSignedInteger(match[4]),
      volume: parseInteger(match[5])
    });
  }

  return uniqueBy(quotes, (quote) => `${quote.date}:${quote.price}:${quote.volume}`);
}

function parseQuoteSummary(lines) {
  const price = readValueAfterLabel(lines, '기준가');
  const volume = readValueAfterLabel(lines, '거래량');
  const changeLine = lines.find((line) => /^[+-]?[\d,]+\(<?\d+(?:\.\d+)?%\)?/.test(line));
  const changeMatch = changeLine?.match(/^([+-]?[\d,]+)\((\d+(?:\.\d+)?%)\)$/);

  return {
    price: price && price !== '-' ? parseInteger(price) : 0,
    volume: volume && volume !== '-' ? parseInteger(volume) : 0,
    change: changeMatch ? parseSignedInteger(changeMatch[1]) : 0,
    rate: changeMatch ? changeMatch[2] : '0%'
  };
}

function parseTrades(lines) {
  const trades = [];
  const pattern = /^(\d{2}\.\d{2}\.\d{2})\s+(\d{2}:\d{2})\s+(.+?)\s+(\d{1,3}(?:,\d{3})+|\d+)\s+(\d{1,3}(?:,\d{3})+|\d+)$/;

  for (const line of lines) {
    const match = line.match(pattern);
    if (!match) {
      continue;
    }

    trades.push({
      date: `20${match[1]}`,
      time: match[2],
      orderType: match[3],
      price: parseInteger(match[4]),
      quantity: parseInteger(match[5])
    });
  }

  return uniqueBy(trades, (trade) => `${trade.date}:${trade.time}:${trade.orderType}:${trade.price}:${trade.quantity}`);
}

function readValueAfterLabel(lines, label) {
  const index = lines.findIndex((line) => line === label);
  if (index < 0) {
    return '';
  }

  return lines[index + 1] || '';
}

function loadBody(html) {
  const $ = cheerio.load(html);
  $('script, style, noscript, svg').remove();
  return $;
}

function getHtml(input) {
  return typeof input === 'string' ? input : input.html;
}

function getUrl(input) {
  return typeof input === 'object' ? input.url : '';
}

function getText(input, $) {
  if (typeof input === 'object' && input.text) {
    return normalizeSpaces(input.text);
  }

  return bodyText($);
}

function getLines(input, $) {
  if (typeof input === 'object' && input.text) {
    return input.text
      .split(/\n+/)
      .map((line) => normalizeSpaces(line))
      .filter(Boolean);
  }

  return bodyLines($);
}

function bodyText($) {
  return normalizeSpaces($('body').text());
}

function bodyLines($) {
  return $('body')
    .text()
    .split(/\n+/)
    .map((line) => normalizeSpaces(line))
    .filter(Boolean);
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }

  return result;
}
