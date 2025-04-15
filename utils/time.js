// ✅ Updated: server/utils/time.js

const { DateTime } = require('luxon');

// ✅ Returns current UTC time (recommended for consistent DB storage)
function getUTCTime() {
  return DateTime.now().toUTC().toJSDate();
}

// ✅ Returns current UK time (use for display)
function getUKTime() {
  return DateTime.now().setZone('Europe/London').toJSDate();
}

// ✅ Formats a JS Date to UK timezone string
function formatToUK(date) {
  return DateTime.fromJSDate(new Date(date))
    .setZone('Europe/London')
    .toFormat('dd-MM-yyyy HH:mm');
}

// ✅ Calculates break duration in minutes between shifts
function calculateBreakTime(previousClockOut, nextClockIn) {
  const prev = DateTime.fromJSDate(new Date(previousClockOut)).setZone('Europe/London');
  const next = DateTime.fromJSDate(new Date(nextClockIn)).setZone('Europe/London');
  const diff = next.diff(prev, 'minutes').minutes;
  return diff > 0 && diff <= 60 ? Math.round(diff) : 0;
}

// ✅ Calculates total work hours between clock-in and clock-out, subtracting break
function calculateTotalWorkHours(clockIn, clockOut, breakTime = 0) {
  const inTime = DateTime.fromJSDate(new Date(clockIn)).setZone('Europe/London');
  let outTime = DateTime.fromJSDate(new Date(clockOut)).setZone('Europe/London');
  if (outTime < inTime) outTime = outTime.plus({ days: 1 });
  const diff = outTime.diff(inTime, 'minutes').minutes;
  const workHours = (diff - breakTime * 60) / 60;
  return workHours.toFixed(2);
}

module.exports = {
  getUTCTime,
  getUKTime,
  formatToUK,
  calculateBreakTime,
  calculateTotalWorkHours
};
