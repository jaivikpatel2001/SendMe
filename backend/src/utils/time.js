/**
 * UTC Time Utilities
 * Consistent helpers to work with UTC dates/times across the backend
 */

const isDateOnlyString = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

const toDate = (value) => (value instanceof Date ? value : new Date(value));

const startOfUTCDay = (value = new Date()) => {
  const d = toDate(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
};

const endOfUTCDay = (value = new Date()) => {
  const d = toDate(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
};

const parseDateToUTCStart = (value) => {
  if (!value) return undefined;
  if (isDateOnlyString(value)) return new Date(`${value}T00:00:00.000Z`);
  return toDate(value);
};

const parseDateToUTCEnd = (value) => {
  if (!value) return undefined;
  if (isDateOnlyString(value)) return new Date(`${value}T23:59:59.999Z`);
  return toDate(value);
};

const getUTCHour = (value = new Date()) => toDate(value).getUTCHours();
const getUTCDay = (value = new Date()) => toDate(value).getUTCDay(); // 0 = Sunday

const nowUTC = () => new Date(); // Date objects are UTC internally

module.exports = {
  startOfUTCDay,
  endOfUTCDay,
  parseDateToUTCStart,
  parseDateToUTCEnd,
  getUTCHour,
  getUTCDay,
  nowUTC,
};

