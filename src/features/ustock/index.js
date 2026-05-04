import { fetchRenderedPage } from './http.js';
import { formatUstockReport } from './message.js';
import { parseInvestmentPage, parseQuotePage } from './parse.js';
import { resolveUstockStock } from './resolve.js';
import { todayKstDate } from '../../utils/format.js';

export async function buildUstockQuoteReport(stockName) {
  const resolved = await resolveUstockStock(stockName);
  const quote = parseQuotePage(resolved);
  const canonicalUrl = resolved.url;

  let news = [];
  let stockStatus = {};
  try {
    const investment = await fetchRenderedPage(canonicalUrl, {
      clickText: '투자정보',
      waitForText: '뉴스/공시',
      settleMs: 1_000
    });
    const investmentData = parseInvestmentPage(investment);
    news = investmentData.news;
    stockStatus = investmentData.stockStatus;
  } catch {
    news = [];
    stockStatus = {};
  }

  const stock = {
    ...quote,
    stockName: quote.stockName || resolved.stockName || stockName,
    code: quote.code || resolved.code,
    url: canonicalUrl,
    totalIssuedShares: stockStatus.totalIssuedShares || 0
  };

  return {
    message: formatUstockReport({
      stock,
      news,
      today: todayKstDate()
    }),
    stock,
    news
  };
}
