const express = require('express');
const router = express.Router({ mergeParams: true });
const prisma = require('../prisma');
const authenticateToken = require('../middleware/auth');

// GET /groups/:id/payments - Fetch all payments for a group
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

    const payments = await prisma.payment.findMany({
      where: { groupId },
      orderBy: { date: 'asc' }
    });

    res.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /groups/:id/payments - Create a payment
router.post('/', authenticateToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const { fromUserId, toUserId, amount, date, note } = req.body;

    if (!fromUserId || !toUserId || amount === undefined || isNaN(parseFloat(amount))) {
      return res.status(400).json({ error: 'fromUserId, toUserId, and a valid amount are required' });
    }

    // Verify current user belongs to the group
    const isCallerMember = await prisma.groupMembership.findFirst({
      where: { groupId, userId: req.user.id }
    });
    if (!isCallerMember) {
      return res.status(403).json({ error: 'Forbidden: You are not a member of this group' });
    }

    const parsedDate = date ? new Date(date) : new Date();
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const payment = await prisma.payment.create({
      data: {
        groupId,
        fromUserId: parseInt(fromUserId),
        toUserId: parseInt(toUserId),
        amount: parseFloat(amount),
        date: parsedDate,
        note: note ? note.trim() : null
      }
    });

    res.status(201).json(payment);
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
