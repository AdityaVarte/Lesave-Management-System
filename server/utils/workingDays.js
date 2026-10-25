/**
 * Calculate working days between two dates, excluding weekends (Saturday and Sunday).
 * Handles half-day requests.
 * Mirrors the LeaveRequest Mongoose pre-save hook and frontend calcWorkingDays.
 * 
 * @param {Date|string} start 
 * @param {Date|string} end 
 * @param {boolean} isHalfDay 
 * @returns {number} Number of working days (e.g. 1, 2.5, 0.5)
 */
const calcWorkingDays = (start, end, isHalfDay = false) => {
  if (!start || !end) return 0;
  let count = 0;
  const current = new Date(start);
  const endDate = new Date(end);

  while (current <= endDate) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }

  return isHalfDay ? Math.max(count * 0.5, 0.5) : count;
};

module.exports = { calcWorkingDays };
