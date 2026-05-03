import {
  formatInteger,
  formatManWon,
  formatShortDate,
  formatShortKrw,
  formatSignedWon,
  formatWon,
  normalizeChangeRate
} from '../../utils/format.js';

const DIVIDER = '━━━━━━━━━━━━━━━━━━━━';

export function formatUstockReport({ stock, news, today }) {
  const latestQuote = stock.dailyQuotes[0] || createQuoteFromTrades(stock);

  if (!latestQuote) {
    throw new Error(`${stock.stockName} 체결내역을 찾지 못했습니다.`);
  }

  const isTradingDay = latestQuote.date === today;

  if (!isTradingDay) {
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
    `📊 ${stock.stockName} 레포트 - ${formatShortDate(latestQuote.date)}`,
    DIVIDER,
    `• 현재가: ${formatWon(latestQuote.price)} (${formatChangeRate(latestQuote.rate, latestQuote.change)}, ${formatSignedWon(latestQuote.change)})`,
    `• 거래량: ${formatInteger(latestQuote.volume)}주`,
    `• 거래대금: ${formatShortKrw(tradeAmount)}`,
    '',
    '[최근 체결 내역]'
  ];

  if (trades.length === 0) {
    lines.push('• 체결 내역 없음');
  } else {
    for (const trade of trades) {
      const amount = trade.price * trade.quantity;
      lines.push(`• ${trade.time} · ${formatWon(trade.price)} · ${formatInteger(trade.quantity)}주 · ${formatManWon(amount)}`);
    }
  }

  lines.push('', '[최신 뉴스/공시]');

  if (news.length === 0) {
    lines.push('• 없음');
  } else {
    for (const item of news) {
      lines.push(`• ${item.date} ${item.title} (${item.source})`);
    }
  }

  return lines.join('\n');
}

function formatNonTradingDayReport({ stock, latestQuote, today }) {
  return [
    `📊 ${stock.stockName} 레포트 - ${formatShortDate(today)}`,
    DIVIDER,
    '오늘은 비 거래일입니다.',
    `• 최근 거래일: ${latestQuote.date}`,
    `• 최근 기준가: ${formatWon(latestQuote.price)} (${formatChangeRate(latestQuote.rate, latestQuote.change)}, ${formatSignedWon(latestQuote.change)})`,
    `• 최근 거래량: ${formatInteger(latestQuote.volume)}주`
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
