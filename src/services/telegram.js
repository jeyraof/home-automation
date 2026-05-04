import https from 'node:https';

export async function sendTelegramMessage(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (!token || !chatId) {
    throw new Error('TELEGRAM_BOT_TOKEN과 TELEGRAM_CHAT_ID를 .env에 설정하세요.');
  }

  const response = await requestTelegramApi({
    token,
    methodName: 'sendMessage',
    body: {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
      link_preview_options: {
        is_disabled: true
      }
    }
  });

  if (!response.ok) {
    throw new Error(`텔레그램 전송 실패: ${response.errorCode || 'unknown'} ${response.description || response.rawBody}`);
  }
}

async function requestTelegramApi({ token, methodName, body }) {
  const apiBase = normalizeApiBase(process.env.TELEGRAM_API_BASE || 'https://api.telegram.org');
  const url = new URL(`/bot${token}/${methodName}`, apiBase);
  const payload = JSON.stringify(body);
  const timeoutMs = parseTimeoutMs(process.env.TELEGRAM_REQUEST_TIMEOUT_MS);
  const family = parseNetworkFamily(process.env.TELEGRAM_NETWORK_FAMILY);

  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: 'POST',
        family,
        timeout: timeoutMs,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'content-length': Buffer.byteLength(payload)
        }
      },
      (response) => {
        const chunks = [];

        response.on('data', (chunk) => {
          chunks.push(chunk);
        });

        response.on('end', () => {
          const rawBody = Buffer.concat(chunks).toString('utf8');
          const parsed = parseJson(rawBody);

          resolve({
            httpStatus: response.statusCode,
            ok: Boolean(response.statusCode >= 200 && response.statusCode < 300 && parsed?.ok),
            errorCode: parsed?.error_code || response.statusCode,
            description: parsed?.description || response.statusMessage,
            rawBody
          });
        });
      }
    );

    request.on('timeout', () => {
      request.destroy(createTelegramNetworkError(`요청 시간이 초과되었습니다 (${timeoutMs}ms).`, 'ETIMEDOUT'));
    });

    request.on('error', (error) => {
      if (error.message.startsWith('텔레그램 API 연결 실패')) {
        reject(error);
        return;
      }

      reject(createTelegramNetworkError(error.message, error.code));
    });

    request.write(payload);
    request.end();
  });
}

function normalizeApiBase(value) {
  const trimmed = value.trim();
  const base = trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
  const parsed = new URL(base);

  if (parsed.protocol !== 'https:') {
    throw new Error('TELEGRAM_API_BASE는 HTTPS URL이어야 합니다.');
  }

  return parsed;
}

function parseTimeoutMs(value) {
  const timeoutMs = Number(value || 15_000);
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15_000;
}

function parseNetworkFamily(value) {
  const normalized = String(value || '4').trim();

  if (normalized === '4') {
    return 4;
  }

  if (normalized === '6') {
    return 6;
  }

  if (normalized === 'auto') {
    return undefined;
  }

  throw new Error('TELEGRAM_NETWORK_FAMILY는 4, 6, auto 중 하나여야 합니다.');
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function createTelegramNetworkError(message, code) {
  const suffix = code ? ` (${code})` : '';
  const error = new Error(`텔레그램 API 연결 실패${suffix}: ${message}`);
  error.code = code;
  return error;
}
