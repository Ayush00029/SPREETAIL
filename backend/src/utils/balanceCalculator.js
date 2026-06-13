const prisma = require('../prisma');

// Helper to check if a user was active on a given date
function isActiveOnDate(userId, date, memberships) {
  const d = new Date(date);
  // Extract date component only to avoid time-zone mismatches for day boundary
  const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  const userMemberships = memberships.filter(m => m.userId === userId);
  for (const m of userMemberships) {
    const joined = new Date(m.joinedAt);
    const joinedDate = new Date(joined.getFullYear(), joined.getMonth(), joined.getDate()).getTime();
    
    const left = m.leftAt ? new Date(m.leftAt) : null;
    const leftDate = left ? new Date(left.getFullYear(), left.getMonth(), left.getDate()).getTime() : null;

    if (dDate >= joinedDate && (!leftDate || dDate <= leftDate)) {
      return true;
    }
  }
  return false;
}

// Greedy algorithm to simplify debts
function simplifyDebts(balances) {
  const debtors = [];
  const creditors = [];

  for (const [userIdStr, balance] of Object.entries(balances)) {
    const userId = parseInt(userIdStr);
    const roundedBalance = parseFloat(balance.toFixed(2));
    if (roundedBalance < -0.01) {
      debtors.push({ userId, amount: -roundedBalance });
    } else if (roundedBalance > 0.01) {
      creditors.push({ userId, amount: roundedBalance });
    }
  }

  // Sort: largest debtor and creditor first
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transactions = [];

  let i = 0; // debtor index
  let j = 0; // creditor index

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];

    const settleAmount = Math.min(debtor.amount, creditor.amount);

    if (settleAmount > 0.01) {
      transactions.push({
        from: debtor.userId,
        to: creditor.userId,
        amount: parseFloat(settleAmount.toFixed(2))
      });
    }

    debtor.amount -= settleAmount;
    creditor.amount -= settleAmount;

    if (debtor.amount <= 0.01) {
      i++;
    }
    if (creditor.amount <= 0.01) {
      j++;
    }
  }

  return transactions;
}

async function getGroupBalances(groupId) {
  // 1. Fetch memberships
  const memberships = await prisma.groupMembership.findMany({
    where: { groupId }
  });

  const userIds = Array.from(new Set(memberships.map(m => m.userId)));
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true }
  });

  // Initialize balances
  const balances = {};
  for (const userId of userIds) {
    balances[userId] = 0;
  }

  // 2. Fetch expenses (excluding settlements)
  const expenses = await prisma.expense.findMany({
    where: { groupId, isSettlement: false }
  });

  const expenseIds = expenses.map(e => e.id);
  const shares = await prisma.expenseShare.findMany({
    where: { expenseId: { in: expenseIds } }
  });

  // Process expenses
  for (const expense of expenses) {
    const expDate = expense.date;
    const paidById = expense.paidById;

    // Credit payer if they were active
    if (isActiveOnDate(paidById, expDate, memberships)) {
      if (balances[paidById] !== undefined) {
        balances[paidById] += expense.amountINR;
      }
    }

    // Debit shared members
    const expShares = shares.filter(s => s.expenseId === expense.id);
    for (const share of expShares) {
      const shareUserId = share.userId;
      if (isActiveOnDate(shareUserId, expDate, memberships)) {
        if (balances[shareUserId] !== undefined) {
          balances[shareUserId] -= share.shareAmount;
        }
      }
    }
  }

  // 3. Fetch Payments (direct repayments)
  const payments = await prisma.payment.findMany({
    where: { groupId }
  });

  for (const payment of payments) {
    const fromId = payment.fromUserId;
    const toId = payment.toUserId;
    const amount = payment.amount;

    if (balances[fromId] !== undefined) {
      balances[fromId] += amount;
    }
    if (balances[toId] !== undefined) {
      balances[toId] -= amount;
    }
  }

  // Build user object with balances
  const userBalances = users.map(u => ({
    userId: u.id,
    name: u.name,
    email: u.email,
    netBalance: parseFloat(parseFloat(balances[u.id] || 0).toFixed(2))
  }));

  // Simplify debts
  const simplifiedDebts = simplifyDebts(balances);

  // Map simplified debts user details
  const mappedDebts = simplifiedDebts.map(d => {
    const fromUser = users.find(u => u.id === d.from);
    const toUser = users.find(u => u.id === d.to);
    return {
      fromUserId: d.from,
      fromUserName: fromUser ? fromUser.name : 'Unknown',
      toUserId: d.to,
      toUserName: toUser ? toUser.name : 'Unknown',
      amount: d.amount
    };
  });

  return {
    balances: userBalances,
    debts: mappedDebts
  };
}

module.exports = {
  isActiveOnDate,
  simplifyDebts,
  getGroupBalances
};
