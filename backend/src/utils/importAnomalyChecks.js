// importAnomalyChecks.js - Anomaly detection logic for CSV Import

const canonicalNames = ['Aisha', 'Rohan', 'Priya', 'Meera', 'Dev', 'Sam'];

// Normalizes name-casing and whitespace to a canonical user name
function getCanonicalName(rawName) {
  if (!rawName) return null;
  const name = rawName.trim().toLowerCase();
  if (name === 'priya' || name === 'priya s' || name === 'priyas') return 'Priya';
  if (name === 'rohan') return 'Rohan';
  if (name === 'aisha') return 'Aisha';
  if (name === 'meera') return 'Meera';
  if (name === 'dev') return 'Dev';
  if (name === 'sam') return 'Sam';
  // Capitalize first letter as fallback
  return rawName.trim().charAt(0).toUpperCase() + rawName.trim().slice(1);
}

// Parses dates and infers context years
function parseAndNormalizeDate(dateStr, contextYear = 2026) {
  if (!dateStr) return { date: null, formatError: true };
  const s = dateStr.trim();

  // Handle formats like "Mar-14"
  const monthDayRegex = /^([a-zA-Z]{3})-(\d{1,2})$/;
  if (monthDayRegex.test(s)) {
    const match = s.match(monthDayRegex);
    const monthStr = match[1].toLowerCase().substring(0, 3);
    const day = parseInt(match[2], 10);
    
    const months = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    
    const month = months[monthStr];
    if (month !== undefined) {
      const date = new Date(contextYear, month, day);
      return { date, normalizedStr: formatDate(date), inferred: true };
    }
  }

  // Handle standard "DD-MM-YYYY"
  const standardRegex = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;
  if (standardRegex.test(s)) {
    const match = s.match(standardRegex);
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);
    const date = new Date(year, month, day);
    return { date, normalizedStr: s, inferred: false };
  }

  return { date: null, formatError: true };
}

function formatDate(date) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}-${m}-${y}`;
}

// Main anomaly checker running in sequence
function checkRow(row, rowNum, context) {
  // Skeleton to be populated with individual checks in next commits
  const anomalies = [];
  let modifiedRow = { ...row };
  
  return {
    rowNumber: rowNum,
    anomalies,
    modifiedRow
  };
}

module.exports = {
  getCanonicalName,
  parseAndNormalizeDate,
  checkRow
};
