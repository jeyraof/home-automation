export function normalizeSpaces(value) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseInteger(value) {
  const normalized = String(value ?? '').replace(/[^\d]/g, '');
  return normalized ? Number(normalized) : 0;
}

export function parseSignedInteger(value) {
  const normalized = String(value ?? '').replace(/[^\d+-]/g, '');
  return normalized ? Number(normalized) : 0;
}

export function formatInteger(value) {
  return Number(value || 0).toLocaleString('ko-KR');
}

export function formatWon(value) {
  return `${formatInteger(value)}원`;
}

export function formatSignedWon(value) {
  const number = Number(value || 0);
  if (number > 0) {
    return `+${formatInteger(number)}원`;
  }
  if (number < 0) {
    return `-${formatInteger(Math.abs(number))}원`;
  }
  return '0원';
}

export function normalizeChangeRate(value) {
  const rate = normalizeSpaces(value);
  if (!rate || rate.startsWith('-') || rate.startsWith('+') || rate === '0%') {
    return rate || '0%';
  }
  return rate;
}

export function formatShortKrw(value) {
  const amount = Number(value || 0);

  if (amount >= 100_000_000) {
    return `약 ${trimFixed(amount / 100_000_000, 1)}억 원`;
  }

  if (amount >= 10_000) {
    return `약 ${trimFixed(amount / 10_000, 1)}만 원`;
  }

  return `${formatInteger(amount)}원`;
}

export function formatManWon(value) {
  const amount = Number(value || 0);

  if (amount >= 10_000) {
    return `${(amount / 10_000).toFixed(1)}만 원`;
  }

  return `${formatInteger(amount)}원`;
}

export function todayKstDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${lookup.year}.${lookup.month}.${lookup.day}`;
}

export function formatShortDate(fullDate) {
  const match = String(fullDate ?? '').match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
  if (!match) {
    return fullDate;
  }
  return `${match[1].slice(2)}.${match[2]}.${match[3]}`;
}

function trimFixed(value, digits) {
  return value.toFixed(digits).replace(/\.0$/, '');
}

