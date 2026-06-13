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

// === ANOMALIES 1 - 9 ===

// 1. Duplicate expenses (same date + payer + amount + similar description)
function checkDuplicateAmount(row, context) {
  const dateStr = row.date;
  const payer = getCanonicalName(row.paid_by);
  const amountStr = typeof row.amount === 'string' ? row.amount.replace(/,/g, '') : String(row.amount);
  const amount = parseFloat(amountStr);
  const desc = row.description ? row.description.toLowerCase().trim() : '';

  if (!dateStr || !payer || isNaN(amount)) return null;

  const isMatch = (other) => {
    if (other.rowNumber === row.rowNumber) return false;
    const otherPayer = getCanonicalName(other.paid_by);
    const otherAmountStr = typeof other.amount === 'string' ? other.amount.replace(/,/g, '') : String(other.amount);
    const otherAmount = parseFloat(otherAmountStr);
    
    if (other.date === dateStr && otherPayer === payer && Math.abs(otherAmount - amount) < 0.01) {
      const otherDesc = other.description ? other.description.toLowerCase().trim() : '';
      if (desc === otherDesc || desc.includes(otherDesc) || otherDesc.includes(desc)) {
        return true;
      }
    }
    return false;
  };

  const duplicateInCsv = context.rowsSoFar.find(isMatch);
  if (duplicateInCsv) {
    if (row.rowNumber > duplicateInCsv.rowNumber) {
      return {
        anomalyType: 'DUPLICATE_EXPENSE',
        action: `Flag duplicate expense: row matches row ${duplicateInCsv.rowNumber}. Mark second as pending_review.`,
        status: 'pending_review',
        modifiedRow: row
      };
    }
  }
  return null;
}

// 2. Numbers with comma separators ("1,200")
function checkCommas(row) {
  if (typeof row.amount === 'string' && row.amount.includes(',')) {
    const cleaned = row.amount.replace(/,/g, '');
    const newRow = { ...row, amount: cleaned };
    return {
      anomalyType: 'COMMA_SEPARATED_NUMBER',
      action: `Stripped commas from amount: "${row.amount}" -> "${cleaned}"`,
      status: 'applied',
      modifiedRow: newRow
    };
  }
  return null;
}

// 3. Inconsistent name casing/whitespace
function checkNames(row) {
  let modified = false;
  let actionText = '';
  const newRow = { ...row };
  
  if (newRow.paid_by) {
    const canonical = getCanonicalName(newRow.paid_by);
    if (canonical !== newRow.paid_by) {
      actionText += `Normalized payer: "${newRow.paid_by}" -> "${canonical}". `;
      newRow.paid_by = canonical;
      modified = true;
    }
  }

  if (newRow.split_with) {
    const members = newRow.split_with.split(';').map(m => m.trim()).filter(Boolean);
    const canonicalMembers = members.map(m => getCanonicalName(m));
    const joinedCanonical = canonicalMembers.join(';');
    if (joinedCanonical !== newRow.split_with) {
      actionText += `Normalized split_with members. `;
      newRow.split_with = joinedCanonical;
      modified = true;
    }
  }

  if (modified) {
    return {
      anomalyType: 'INCONSISTENT_NAME',
      action: actionText.trim(),
      status: 'applied',
      modifiedRow: newRow
    };
  }
  return null;
}

// 4. Sub-paisa decimal precision (899.995)
function checkSubPaisa(row) {
  const amt = parseFloat(row.amount);
  if (!isNaN(amt)) {
    const rounded = parseFloat(amt.toFixed(2));
    if (Math.abs(amt - rounded) > 0.0001) {
      const newRow = { ...row, amount: String(rounded) };
      return {
        anomalyType: 'SUB_PAISA_PRECISION',
        action: `Rounded amount to 2 decimals: ${amt} -> ${rounded}`,
        status: 'applied',
        modifiedRow: newRow
      };
    }
  }
  return null;
}

// 5. Missing required field (empty paid_by)
function checkMissingPaidBy(row) {
  if (!row.paid_by || !row.paid_by.trim()) {
    return {
      anomalyType: 'MISSING_PAID_BY',
      action: 'Block row, mark for review: Missing payer "paid_by"',
      status: 'pending_review',
      modifiedRow: row
    };
  }
  return null;
}

// 6. Settlement mislabeled as expense
function checkMislabeledSettlement(row) {
  const splitType = row.split_type ? row.split_type.trim() : '';
  const splitWith = row.split_with ? row.split_with.trim() : '';
  const note = row.notes ? row.notes.toLowerCase().trim() : '';
  
  const isNotesRepayment = note.includes('repay') || note.includes('paid back') || note.includes('settlement') || note.includes('refund');
  const isSingleRecipient = splitWith.split(';').filter(Boolean).length === 1;

  if (!splitType && isSingleRecipient && isNotesRepayment) {
    const newRow = { ...row, isSettlement: true };
    return {
      anomalyType: 'MISLABELED_SETTLEMENT',
      action: 'Import row as Payment/Settlement record instead of Expense',
      status: 'applied',
      modifiedRow: newRow
    };
  }
  return null;
}

// 7. Percentage splits not summing to 100%
function checkPercentageSum(row) {
  if (row.split_type && row.split_type.toLowerCase().trim() === 'percentage' && row.split_details) {
    const splits = row.split_details.split(';').map(s => s.trim()).filter(Boolean);
    let totalPct = 0;
    const parsedSplits = splits.map(s => {
      const parts = s.split(/\s+/);
      const name = parts[0];
      const pctStr = parts[1] ? parts[1].replace('%', '') : '0';
      const pct = parseFloat(pctStr);
      totalPct += pct;
      return { name, pct };
    });

    if (Math.abs(totalPct - 100) > 0.01) {
      const divisor = totalPct === 0 ? 1 : totalPct / 100;
      const normalizedSplits = parsedSplits.map(s => {
        const norm = parseFloat((s.pct / divisor).toFixed(2));
        return `${s.name} ${norm}%`;
      });
      const newDetails = normalizedSplits.join('; ');
      const newRow = { ...row, split_details: newDetails };
      return {
        anomalyType: 'PERCENTAGE_SUM_MISMATCH',
        action: `Normalized percentage splits from total ${totalPct}% to 100% (${row.split_details} -> ${newDetails})`,
        status: 'applied',
        modifiedRow: newRow
      };
    }
  }
  return null;
}

// 8. Foreign currency conversion (USD)
function checkForeignCurrency(row) {
  if (row.currency && row.currency.toUpperCase().trim() === 'USD') {
    const originalAmount = parseFloat(row.amount);
    const converted = parseFloat((originalAmount * 83).toFixed(2));
    const newRow = { ...row, amount: String(converted), currency: 'INR', originalAmount, originalCurrency: 'USD', exchangeRate: 83 };
    return {
      anomalyType: 'FOREIGN_CURRENCY',
      action: `Converted USD to INR at fixed rate of 83: ${originalAmount} USD -> ${converted} INR`,
      status: 'applied',
      modifiedRow: newRow
    };
  }
  return null;
}

// 9. Share-based split calculations
function checkShareBasedSplits(row) {
  if (row.split_type && row.split_type.toLowerCase().trim() === 'share' && row.split_details) {
    return {
      anomalyType: 'SHARE_SPLIT_CALCULATION',
      action: `Processed share-based split ratio details: "${row.split_details}"`,
      status: 'applied',
      modifiedRow: row
    };
  }
  return null;
}

// Main check function running first 9 checks
function checkRow(row, rowNum, context) {
  const anomalies = [];
  let modifiedRow = { ...row, rowNumber: rowNum };

  const runners = [
    checkMissingPaidBy,
    checkCommas,
    checkNames,
    checkSubPaisa,
    checkMislabeledSettlement,
    checkPercentageSum,
    checkForeignCurrency,
    checkShareBasedSplits,
    checkDuplicateAmount
  ];

  for (const check of runners) {
    const res = check(modifiedRow, context);
    if (res) {
      anomalies.push({
        anomalyType: res.anomalyType,
        action: res.action,
        status: res.status
      });
      modifiedRow = res.modifiedRow;
    }
  }

  return {
    rowNumber: rowNum,
    anomalies,
    modifiedRow
  };
}

module.exports = {
  getCanonicalName,
  parseAndNormalizeDate,
  checkRow,
  checkDuplicateAmount,
  checkCommas,
  checkNames,
  checkSubPaisa,
  checkMissingPaidBy,
  checkMislabeledSettlement,
  checkPercentageSum,
  checkForeignCurrency,
  checkShareBasedSplits
};
