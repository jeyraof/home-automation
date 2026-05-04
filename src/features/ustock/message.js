import {
  formatInteger,
  formatLargeKrw,
  formatManWon,
  formatShortDate,
  formatShortKrw,
  formatSignedWon,
  formatWon,
  normalizeChangeRate
} from '../../utils/format.js';

const DIVIDER = '━━━━━━━━━━━━━━━━━━━━';

export function formatUstockReport({ stock, news, today }) {
  const todayTrades = stock.trades.filter((trade) => trade.date === today);
  const latestDailyQuote = stock.dailyQuotes[0];

  if (todayTrades.length > 0) {
    return formatTradingDayReport({
      stock,
      latestQuote: createTodayQuote(stock, todayTrades, today),
      trades: todayTrades.slice(0, 5),
      news: news.slice(0, 3)
    });
  }

  if (latestDailyQuote?.date === today) {
    return formatTradingDayReport({
      stock,
      latestQuote: latestDailyQuote,
      trades: todayTrades.slice(0, 5),
      news: news.slice(0, 3)
    });
  }

  const latestQuote = latestDailyQuote || createQuoteFromTrades(stock);

  if (!latestQuote) {
    throw new Error(`${stock.stockName} 체결내역을 찾지 못했습니다.`);
  }

  if (latestQuote.date !== today) {
    return formatNonTradingDayReport({
      stock,
      latestQuote,
      today
    });
  }

  return formatTradingDayReport({
    stock,
    latestQuote,
    trades: stock.trades.slice(0, 5),
    news: news.slice(0, 3)
  });
}

function formatTradingDayReport({ stock, latestQuote, trades, news }) {
  const tradeAmount = latestQuote.price * latestQuote.volume;
  const lines = [
    `<b>📊 ${html(stock.stockName)} 레포트 - ${html(formatShortDate(latestQuote.date))}</b>`,
    DIVIDER,
    `• <b>현재가:</b> ${html(formatWon(latestQuote.price))} (${html(formatChangeRate(latestQuote.rate, latestQuote.change))}, ${html(formatSignedWon(latestQuote.change))})`
  ];

  if (stock.totalIssuedShares) {
    lines.push(`• <b>시가총액:</b> ${html(formatLargeKrw(latestQuote.price * stock.totalIssuedShares))}`);
  }

  lines.push(
    `• <b>거래량:</b> ${html(formatInteger(latestQuote.volume))}주`,
    `• <b>거래대금:</b> ${html(formatShortKrw(tradeAmount))}`,
    '',
    '<b>[최근 체결 내역]</b>'
  );

  if (trades.length === 0) {
    lines.push('• 체결 내역 없음');
  } else {
    for (const trade of trades) {
      const amount = trade.price * trade.quantity;
      lines.push(`• ${html(trade.time)} · ${html(formatWon(trade.price))} · ${html(formatInteger(trade.quantity))}주 · ${html(formatManWon(amount))}`);
    }
  }

  lines.push('', '<b>[최신 뉴스/공시]</b>');

  if (news.length === 0) {
    lines.push('• 없음');
  } else {
    for (const item of news) {
      lines.push(`• ${html(item.date)} ${formatNewsTitle(item)} (${html(item.source)})`);
    }
  }

  return lines.join('\n');
}

function formatNonTradingDayReport({ stock, latestQuote, today }) {
  return [
    `<b>📊 ${html(stock.stockName)} 레포트 - ${html(formatShortDate(today))}</b>`,
    DIVIDER,
    '오늘은 비 거래일입니다.',
    `• <b>최근 거래일:</b> ${html(latestQuote.date)}`,
    `• <b>최근 기준가:</b> ${html(formatWon(latestQuote.price))} (${html(formatChangeRate(latestQuote.rate, latestQuote.change))}, ${html(formatSignedWon(latestQuote.change))})`,
    `• <b>최근 거래량:</b> ${html(formatInteger(latestQuote.volume))}주`
  ].join('\n');
}

function createQuoteFromTrades(stock) {
  const latestTrade = stock.trades[0];

  if (!latestTrade) {
    return null;
  }

  const sameDayTrades = stock.trades.filter((trade) => trade.date === latestTrade.date);
  const visibleTradeVolume = sameDayTrades.reduce((sum, trade) => sum + trade.quantity, 0);

  return {
    date: latestTrade.date,
    price: stock.summary?.price || latestTrade.price,
    rate: stock.summary?.rate || '0%',
    change: stock.summary?.change || 0,
    volume: stock.summary?.volume || visibleTradeVolume
  };
}

function createTodayQuote(stock, todayTrades, today) {
  const latestTrade = todayTrades[0];
  const visibleTradeVolume = todayTrades.reduce((sum, trade) => sum + trade.quantity, 0);

  return {
    date: today,
    price: stock.summary?.price || latestTrade.price,
    rate: stock.summary?.rate || '0%',
    change: stock.summary?.change || 0,
    volume: stock.summary?.volume || visibleTradeVolume
  };
}

function formatChangeRate(rate, change) {
  const normalized = normalizeChangeRate(rate);

  if (!normalized || normalized === '0%') {
    return '0%';
  }

  if (change < 0 && !normalized.startsWith('-')) {
    return `-${normalized.replace(/^[+]/, '')}`;
  }

  if (change > 0 && !normalized.startsWith('+')) {
    return `+${normalized.replace(/^[-]/, '')}`;
  }

  return normalized;
}

function formatNewsTitle(item) {
  if (!item.url) {
    return html(item.title);
  }

  return `<a href="${htmlAttr(item.url)}">${html(item.title)}</a>`;
}

function html(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function htmlAttr(value) {
  return html(value).replace(/"/g, '&quot;');
}
