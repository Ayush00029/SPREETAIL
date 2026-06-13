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

// POST /groups/:id/expenses - Create basic expense skeleton
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
      paidById
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

    // Basic Expense creation (split logic will be added in subsequent commits)
    const expense = await prisma.expense.create({
      data: {
        groupId,
        paidById: parseInt(paidById),
        description: description.trim(),
        amount: parseFloat(amount),
        currency: currency.trim(),
        exchangeRate: parseFloat(exchangeRate),
        amountINR: parseFloat(amountINR || amount * exchangeRate),
        date: parsedDate,
        splitType: splitType.toLowerCase().trim()
      }
    });

    res.status(201).json(expense);
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
