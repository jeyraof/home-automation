import { fetchRenderedPage } from './http.js';
import { formatUstockReport } from './message.js';
import { parseInvestmentPage, parseQuotePage } from './parse.js';
import { resolveUstockStock } from './resolve.js';
import { todayKstDate } from '../../utils/format.js';

export async function buildUstockQuoteReport(stockName) {
  const resolved = await resolveUstockStock(stockName);
  const quote = parseQuotePage(resolved);
  const canonicalUrl = resolved.url;
  const investmentUrl = createInvestmentUrl(canonicalUrl);

  let news = [];
  try {
    const investment = await fetchRenderedPage(investmentUrl, { waitForText: '뉴스/공시' });
    news = parseInvestmentPage(investment);
  } catch {
    news = [];
  }

  const stock = {
    ...quote,
    stockName: quote.stockName || resolved.stockName || stockName,
    code: quote.code || resolved.code,
    url: canonicalUrl
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

function createInvestmentUrl(url) {
  const parsed = new URL(url);
  parsed.searchParams.set('selectedTab', 'invest_info');
  return parsed.toString();
}
