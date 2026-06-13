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

module.exports = router;
