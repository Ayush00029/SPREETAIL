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

module.exports = router;
