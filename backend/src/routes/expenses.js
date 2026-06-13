const express = require('express');
const router = express.Router({ mergeParams: true });
const prisma = require('../prisma');
const authenticateToken = require('../middleware/auth');

// GET /groups/:id/expenses - Fetch all expenses for a group
router.get('/', authenticateToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);

    // Verify user belongs to the group
    const isMember = await prisma.groupMembership.findFirst({
      where: { groupId, userId: req.user.id }
    });
    if (!isMember) {
      return res.status(403).json({ error: 'Forbidden: You are not a member of this group' });
    }

    const expenses = await prisma.expense.findMany({
      where: { groupId },
      orderBy: { date: 'asc' }
    });

    // Fetch shares for these expenses so they can be returned together
    const expenseIds = expenses.map(e => e.id);
    const shares = await prisma.expenseShare.findMany({
      where: { expenseId: { in: expenseIds } }
    });

    const result = expenses.map(e => ({
      ...e,
      shares: shares.filter(s => s.expenseId === e.id)
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /groups/:id/expenses - Create expense with equal or unequal split
router.post('/', authenticateToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const {
      description,
      amount,
      currency,
      exchangeRate = 1,
      amountINR,
      date,
      splitType,
      paidById,
      splitWithUserIds,
      splitDetails
    } = req.body;

    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Description is required' });
    }
    if (amount === undefined || isNaN(parseFloat(amount))) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }
    if (!currency) {
      return res.status(400).json({ error: 'Currency is required' });
    }
    if (!splitType) {
      return res.status(400).json({ error: 'Split type is required' });
    }
    if (!paidById) {
      return res.status(400).json({ error: 'Payer is required' });
    }
    if (!splitWithUserIds || !Array.isArray(splitWithUserIds) || splitWithUserIds.length === 0) {
      return res.status(400).json({ error: 'splitWithUserIds must be a non-empty array' });
    }

    // Check if caller belongs to the group
    const isMember = await prisma.groupMembership.findFirst({
      where: { groupId, userId: req.user.id }
    });
    if (!isMember) {
      return res.status(403).json({ error: 'Forbidden: You are not a member of this group' });
    }

    const parsedDate = date ? new Date(date) : new Date();
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const computedExchangeRate = parseFloat(exchangeRate);
    const computedAmount = parseFloat(amount);
    const computedAmountINR = parseFloat(amountINR || (computedAmount * computedExchangeRate).toFixed(2));
    const normalizedSplitType = splitType.toLowerCase().trim();

    // Calculate shares
    let shares = [];

    if (normalizedSplitType === 'equal') {
      const count = splitWithUserIds.length;
      const shareAmount = parseFloat((computedAmountINR / count).toFixed(2));
      shares = splitWithUserIds.map(uId => ({
        userId: parseInt(uId),
        shareAmount
      }));
    } else if (normalizedSplitType === 'unequal') {
      if (!splitDetails) {
        return res.status(400).json({ error: 'splitDetails is required for unequal split' });
      }
      let totalSplit = 0;
      shares = splitWithUserIds.map(uId => {
        let val = 0;
        if (Array.isArray(splitDetails)) {
          const detail = splitDetails.find(d => d.userId === parseInt(uId));
          val = detail ? detail.value : 0;
        } else {
          val = splitDetails[uId] !== undefined ? splitDetails[uId] : 0;
        }
        const shareAmount = parseFloat(parseFloat(val).toFixed(2));
        totalSplit += shareAmount;
        return {
          userId: parseInt(uId),
          shareAmount
        };
      });

      // Allow minor rounding difference up to 0.1 INR
      if (Math.abs(totalSplit - computedAmountINR) > 0.1) {
        return res.status(400).json({
          error: `Sum of unequal splits (${totalSplit}) must equal the total amount (${computedAmountINR})`
        });
      }
    } else if (normalizedSplitType === 'percentage' || normalizedSplitType === 'share') {
      // Placeholder for next commit
      return res.status(400).json({ error: 'Percentage and Share splits are not implemented yet' });
    } else {
      return res.status(400).json({ error: 'Invalid split type. Must be equal, unequal, percentage, or share' });
    }

    // Write transaction to ensure consistency
    const result = await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          groupId,
          paidById: parseInt(paidById),
          description: description.trim(),
          amount: computedAmount,
          currency: currency.trim(),
          exchangeRate: computedExchangeRate,
          amountINR: computedAmountINR,
          date: parsedDate,
          splitType: normalizedSplitType
        }
      });

      const createdShares = await Promise.all(
        shares.map(share =>
          tx.expenseShare.create({
            data: {
              expenseId: expense.id,
              userId: share.userId,
              shareAmount: share.shareAmount
            }
          })
        )
      );

      return { ...expense, shares: createdShares };
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
