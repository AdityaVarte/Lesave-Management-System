// Calculate working days excluding weekends (mirrors server pre-save hook)
export const calcWorkingDays = (startDate, endDate, isHalfDay = false) => {
  if (!startDate || !endDate) return 0;
  let count = 0;
  const current = new Date(startDate);
  const end = new Date(endDate);
  current.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return isHalfDay ? Math.max(count * 0.5, 0.5) : count;
};
