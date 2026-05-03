import { Command } from 'commander';
import { buildUstockQuoteReport } from '../features/ustock/index.js';
import { sendTelegramMessage } from '../services/telegram.js';

export function registerUstockCommand(program) {
  const ustock = new Command('ustock')
    .description('Npay 비상장 조회 명령');

  ustock
    .command('quote')
    .description('비상장 종목 시세와 투자정보를 조회합니다.')
    .argument('[stockName]', '조회할 비상장 종목명', '두나무')
    .option('--send', '생성한 메시지를 텔레그램으로 전송합니다.')
    .action(async (stockName, options) => {
      try {
        const { message } = await buildUstockQuoteReport(stockName);

        if (options.send) {
          await sendTelegramMessage(message);
          console.log('Telegram message sent.');
        }

        console.log(message);
      } catch (error) {
        console.error(`[ustock] ${error.message}`);
        process.exitCode = 1;
      }
    });

  program.addCommand(ustock);
}

