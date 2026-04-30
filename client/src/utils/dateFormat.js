import { format, parseISO, isValid } from 'date-fns';

export const formatDate = (date) => {
  if (!date) return '—';
  try {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return isValid(d) ? format(d, 'dd MMM yyyy') : '—';
  } catch {
    return '—';
  }
};

export const formatDateShort = (date) => {
  if (!date) return '—';
  try {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return isValid(d) ? format(d, 'dd MMM') : '—';
  } catch {
    return '—';
  }
};

export const formatDateTime = (date) => {
  if (!date) return '—';
  try {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return isValid(d) ? format(d, 'dd MMM yyyy, HH:mm') : '—';
  } catch {
    return '—';
  }
};

export const toInputDate = (date) => {
  if (!date) return '';
  try {
    const d = new Date(date);
    return isValid(d) ? format(d, 'yyyy-MM-dd') : '';
  } catch {
    return '';
  }
};

export const todayInputDate = () => format(new Date(), 'yyyy-MM-dd');
