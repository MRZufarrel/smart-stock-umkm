const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('id-ID');

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export function formatCurrency(value) {
  const parsed = Number(value);

  return currencyFormatter.format(Number.isFinite(parsed) ? parsed : 0);
}

export function formatNumber(value) {
  const parsed = Number(value);

  return numberFormatter.format(Number.isFinite(parsed) ? parsed : 0);
}

export function formatDate(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return dateFormatter.format(date);
}
