const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const authenticateToken = require('../middleware/auth');

// GET /groups - List all groups the authenticated user belongs to
router.get('/', authenticateToken, async (req, res) => {
  try {
    const memberships = await prisma.groupMembership.findMany({
      where: { userId: req.user.id }
    });

    const groupIds = memberships.map(m => m.groupId);

    const groups = await prisma.group.findMany({
      where: { id: { in: groupIds } }
    });

    res.json(groups);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /groups - Create a new group and automatically add creator as a member
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    const group = await prisma.group.create({
      data: { name: name.trim() }
    });

    // Automatically add creator to group membership
    await prisma.groupMembership.create({
      data: {
        groupId: group.id,
        userId: req.user.id,
        joinedAt: new Date()
      }
    });

    res.status(201).json(group);
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /groups/:id/members - List all members of a group with their membership periods
router.get('/:id/members', authenticateToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    
    // Check if current user is a member
    const isMember = await prisma.groupMembership.findFirst({
      where: { groupId, userId: req.user.id }
    });
    if (!isMember) {
      return res.status(403).json({ error: 'Forbidden: You are not a member of this group' });
    }

    const memberships = await prisma.groupMembership.findMany({
      where: { groupId }
    });

    const userIds = memberships.map(m => m.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } }
    });

    const result = memberships.map(m => {
      const u = users.find(user => user.id === m.userId);
      return {
        id: m.id,
        userId: m.userId,
        name: u ? u.name : 'Unknown',
        email: u ? u.email : 'Unknown',
        joinedAt: m.joinedAt,
        leftAt: m.leftAt
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching group members:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /groups/:id/members - Add a user to a group by email, specifying joinedAt
router.post('/:id/members', authenticateToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const { email, joinedAt } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'User email is required' });
    }

    // Verify creator/caller is member of group
    const isCallerMember = await prisma.groupMembership.findFirst({
      where: { groupId, userId: req.user.id }
    });
    if (!isCallerMember) {
      return res.status(403).json({ error: 'Forbidden: You are not a member of this group' });
    }

    // Find the user to add
    const userToAdd = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });
    if (!userToAdd) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already an active member (leftAt is null)
    const existingActiveMember = await prisma.groupMembership.findFirst({
      where: { groupId, userId: userToAdd.id, leftAt: null }
    });
    if (existingActiveMember) {
      return res.status(400).json({ error: 'User is already an active member of this group' });
    }

    const parsedJoinedAt = joinedAt ? new Date(joinedAt) : new Date();
    if (isNaN(parsedJoinedAt.getTime())) {
      return res.status(400).json({ error: 'Invalid joinedAt date format' });
    }

    const newMembership = await prisma.groupMembership.create({
      data: {
        groupId,
        userId: userToAdd.id,
        joinedAt: parsedJoinedAt
      }
    });

    res.status(201).json(newMembership);
  } catch (error) {
    console.error('Error adding group member:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /groups/:id/members/:userId - Mark a user as left the group by setting leftAt
router.patch('/:id/members/:userId', authenticateToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const userId = parseInt(req.params.userId);
    const { leftAt } = req.body;

    // Verify caller is member of group
    const isCallerMember = await prisma.groupMembership.findFirst({
      where: { groupId, userId: req.user.id }
    });
    if (!isCallerMember) {
      return res.status(403).json({ error: 'Forbidden: You are not a member of this group' });
    }

    // Find active membership
    const activeMembership = await prisma.groupMembership.findFirst({
      where: { groupId, userId, leftAt: null }
    });
    if (!activeMembership) {
      return res.status(404).json({ error: 'Active group membership not found for this user' });
    }

    const parsedLeftAt = leftAt ? new Date(leftAt) : new Date();
    if (isNaN(parsedLeftAt.getTime())) {
      return res.status(400).json({ error: 'Invalid leftAt date format' });
    }

    if (parsedLeftAt < activeMembership.joinedAt) {
      return res.status(400).json({ error: 'leftAt date cannot be before joinedAt date' });
    }

    const updatedMembership = await prisma.groupMembership.update({
      where: { id: activeMembership.id },
      data: { leftAt: parsedLeftAt }
    });

    res.json(updatedMembership);
  } catch (error) {
    console.error('Error updating group membership leftAt:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /groups/:id/balances - Retrieve net balances and simplified debts
router.get('/:id/balances', authenticateToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);

    // Verify caller belongs to the group
    const isMember = await prisma.groupMembership.findFirst({
      where: { groupId, userId: req.user.id }
    });
    if (!isMember) {
      return res.status(403).json({ error: 'Forbidden: You are not a member of this group' });
    }

    const { getGroupBalances } = require('../utils/balanceCalculator');
    const result = await getGroupBalances(groupId);
    res.json(result);
  } catch (error) {
    console.error('Error calculating balances:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /groups/:id/balances/:userId - Itemized drill-down for a specific member
router.get('/:id/balances/:userId', authenticateToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const userId = parseInt(req.params.userId);

    // Verify caller belongs to the group
    const isCallerMember = await prisma.groupMembership.findFirst({
      where: { groupId, userId: req.user.id }
    });
    if (!isCallerMember) {
      return res.status(403).json({ error: 'Forbidden: You are not a member of this group' });
    }

    const { isActiveOnDate } = require('../utils/balanceCalculator');

    // Fetch memberships for active verification
    const memberships = await prisma.groupMembership.findMany({
      where: { groupId }
    });

    const items = [];

    // 1. Expenses paid by this user
    const paidExpenses = await prisma.expense.findMany({
      where: { groupId, paidById: userId, isSettlement: false },
      orderBy: { date: 'asc' }
    });

    for (const exp of paidExpenses) {
      if (isActiveOnDate(userId, exp.date, memberships)) {
        items.push({
          type: 'expense_paid',
          id: exp.id,
          description: exp.description,
          amount: exp.amountINR,
          date: exp.date,
          direction: 'credit' // payer gets credited
        });
      }
    }

    // 2. Shares of expenses this user owes
    const userShares = await prisma.expenseShare.findMany({
      where: {
        userId,
        expense: {
          groupId,
          isSettlement: false
        }
      },
      include: {
        expense: true
      }
    });

    for (const share of userShares) {
      if (isActiveOnDate(userId, share.expense.date, memberships)) {
        items.push({
          type: 'expense_share',
          id: share.expenseId,
          description: share.expense.description,
          amount: share.shareAmount,
          date: share.expense.date,
          direction: 'debit' // owes money
        });
      }
    }

    // 3. Sent payments
    const sentPayments = await prisma.payment.findMany({
      where: { groupId, fromUserId: userId }
    });

    for (const pay of sentPayments) {
      items.push({
        type: 'payment_sent',
        id: pay.id,
        description: pay.note || `Repayment to member`,
        amount: pay.amount,
        date: pay.date,
        direction: 'credit' // increases their net balance
      });
    }

    // 4. Received payments
    const receivedPayments = await prisma.payment.findMany({
      where: { groupId, toUserId: userId }
    });

    for (const pay of receivedPayments) {
      items.push({
        type: 'payment_received',
        id: pay.id,
        description: pay.note || `Repayment from member`,
        amount: pay.amount,
        date: pay.date,
        direction: 'debit' // reduces their net credit
      });
    }

    // Sort chronologically
    items.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate total net balance by adding credits and subtracting debits
    let netBalance = 0;
    for (const item of items) {
      if (item.direction === 'credit') {
        netBalance += item.amount;
      } else {
        netBalance -= item.amount;
      }
    }

    res.json({
      userId,
      netBalance: parseFloat(netBalance.toFixed(2)),
      items
    });
  } catch (error) {
    console.error('Error fetching balance drill-down:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
