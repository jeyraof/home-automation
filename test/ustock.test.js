import assert from 'node:assert/strict';
import test from 'node:test';
import { formatUstockReport } from '../src/features/ustock/message.js';
import { parseQuotePage } from '../src/features/ustock/parse.js';

test('parseQuotePage reads split summary change and rate lines', () => {
  const parsed = parseQuotePage({
    html: '<html><body></body></html>',
    text: [
      '두나무',
      '288,000',
      '-5,000',
      '(1.71%)',
      '체결내역',
      '일별시세',
      '기준가',
      '288,000 원',
      '거래량',
      '7,539 주',
      '일별시세',
      '2026.05.07\t288,000\t-1.71%\t-5,000\t7,539'
    ].join('\n')
  });

  assert.deepEqual(parsed.summary, {
    price: 288000,
    volume: 7539,
    change: -5000,
    rate: '1.71%'
  });
});

test('parseQuotePage keeps compact summary change and rate support', () => {
  const parsed = parseQuotePage({
    html: '<html><body></body></html>',
    text: [
      '기준가',
      '293,000 원',
      '거래량',
      '3,801 주',
      '+4,000(1.38%)'
    ].join('\n')
  });

  assert.deepEqual(parsed.summary, {
    price: 293000,
    volume: 3801,
    change: 4000,
    rate: '1.38%'
  });
});

test('formatUstockReport falls back to today daily quote change when summary has zero change', () => {
  const message = formatUstockReport({
    today: '2026.05.07',
    news: [],
    stock: {
      stockName: '두나무',
      totalIssuedShares: 0,
      summary: {
        price: 288000,
        volume: 7539,
        change: 0,
        rate: '0%'
      },
      dailyQuotes: [
        {
          date: '2026.05.07',
          price: 288000,
          rate: '-1.71%',
          change: -5000,
          volume: 7539
        }
      ],
      trades: [
        {
          date: '2026.05.07',
          time: '18:29',
          orderType: '바로거래',
          price: 289000,
          quantity: 1
        }
      ]
    }
  });

  assert.ok(message.includes('• <b>현재가:</b> 288,000원 (-1.71%, -5,000원)'));
});
