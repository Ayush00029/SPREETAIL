const express = require('express');
const router = express.Router({ mergeParams: true });
const multer = require('multer');
const papa = require('papaparse');
const prisma = require('../prisma');
const authenticateToken = require('../middleware/auth');
const { checkRow, getCanonicalName, parseAndNormalizeDate } = require('../utils/importAnomalyChecks');

const upload = multer({ storage: multer.memoryStorage() });

// Helper to get or create a user by name
async function getOrCreateUser(name) {
  const canonical = getCanonicalName(name);
  if (!canonical) return null;

  let user = await prisma.user.findFirst({
    where: { name: canonical }
  });

  if (!user) {
    const bcrypt = require('bcrypt');
    const passwordHash = await bcrypt.hash('password123', 10);
    user = await prisma.user.create({
      data: {
        name: canonical,
        email: `${canonical.toLowerCase()}@example.com`,
        passwordHash
      }
    });
  }
  return user;
}

// Helper to ensure user is member of group
async function ensureGroupMembership(userId, groupId) {
  const existing = await prisma.groupMembership.findFirst({
    where: { groupId, userId }
  });
  if (!existing) {
    await prisma.groupMembership.create({
      data: {
        groupId,
        userId,
        joinedAt: new Date('2026-02-01') // Default start date for historical import
      }
    });
  }
}

// POST /groups/:id/import - Upload and process CSV file
router.post('/', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const csvData = req.file.buffer.toString('utf8');

    // Parse CSV
    const parsed = papa.parse(csvData, {
      header: true,
      skipEmptyLines: true
    });

    if (parsed.errors && parsed.errors.length > 0) {
      console.error('CSV Parsing errors:', parsed.errors);
    }

    const rows = parsed.data;

    // Fetch current group memberships & users to populate checking context
    const memberships = await prisma.groupMembership.findMany({
      where: { groupId }
    });
    const userIds = memberships.map(m => m.userId);
    const dbMembers = await prisma.user.findMany({
      where: { id: { in: userIds } }
    });

    // Format groupMembers list for the checking context
    const groupMembers = memberships.map(m => {
      const u = dbMembers.find(user => user.id === m.userId);
      return {
        id: m.userId,
        name: u ? u.name : 'Unknown',
        joinedAt: m.joinedAt,
        leftAt: m.leftAt
      };
    });

    const context = {
      rowsSoFar: [],
      groupMembers
    };

    const importResults = [];

    // Process rows sequentially
    for (let i = 0; i < rows.length; i++) {
      const rawRow = rows[i];
      const rowNum = i + 2; // Row number 1 is header

      // Run sequential anomaly checks
      const checkResult = checkRow(rawRow, rowNum, context);
      
      // Update context rowsSoFar with the modified row
      context.rowsSoFar.push(checkResult.modifiedRow);

      // Save anomalies to ImportLog
      const loggedAnomalies = [];
      if (checkResult.anomalies.length > 0) {
        for (const anomaly of checkResult.anomalies) {
          const log = await prisma.importLog.create({
            data: {
              rowNumber: rowNum,
              rawRow: JSON.stringify({ ...rawRow, groupId, modifiedRow: checkResult.modifiedRow }),
              anomalyType: anomaly.anomalyType,
              action: anomaly.action,
              status: anomaly.status
            }
          });
          loggedAnomalies.push(log);
        }
      }

      // Check if there are any blocking anomalies (status === 'pending_review')
      const hasBlocking = checkResult.anomalies.some(a => a.status === 'pending_review');

      if (!hasBlocking) {
        const mod = checkResult.modifiedRow;
        
        // Resolve Payer
        const payerUser = await getOrCreateUser(mod.paid_by);
        if (payerUser) {
          await ensureGroupMembership(payerUser.id, groupId);

          if (mod.isSettlement) {
            // Repayment/Settlement row -> Insert as Payment
            const recipientName = mod.split_with ? mod.split_with.split(';')[0] : '';
            const recipientUser = await getOrCreateUser(recipientName);
            if (recipientUser) {
              await ensureGroupMembership(recipientUser.id, groupId);
              const parsedDateRes = parseAndNormalizeDate(mod.date);

              await prisma.payment.create({
                data: {
                  groupId,
                  fromUserId: payerUser.id,
                  toUserId: recipientUser.id,
                  amount: parseFloat(mod.amount),
                  date: parsedDateRes.date || new Date(),
                  note: mod.notes || mod.description
                }
              });
            }
          } else {
            // Standard Expense row -> Insert Expense + shares
            const parsedDateRes = parseAndNormalizeDate(mod.date);
            const amount = parseFloat(mod.amount);
            const exchangeRate = parseFloat(mod.exchangeRate || 1);
            const amountINR = parseFloat(mod.amountINR || (amount * exchangeRate).toFixed(2));

            const expense = await prisma.expense.create({
              data: {
                groupId,
                paidById: payerUser.id,
                description: mod.description || 'CSV Expense',
                amount,
                currency: mod.currency || 'INR',
                exchangeRate,
                amountINR,
                date: parsedDateRes.date || new Date(),
                splitType: mod.split_type || 'equal'
              }
            });

            // Parse split_with members and compute shares
            const splitMembers = mod.split_with ? mod.split_with.split(';').map(m => m.trim()).filter(Boolean) : [];
            const splitUsers = [];
            for (const name of splitMembers) {
              const u = await getOrCreateUser(name);
              if (u) {
                await ensureGroupMembership(u.id, groupId);
                splitUsers.push(u);
              }
            }

            // Calculate shares based on split type
            let shares = [];
            const count = splitUsers.length;

            if (mod.split_type === 'equal') {
              const shareAmount = parseFloat((amountINR / count).toFixed(2));
              shares = splitUsers.map(su => ({ userId: su.id, shareAmount }));
            } else if (mod.split_type === 'unequal') {
              const details = mod.split_details ? mod.split_details.split(';').map(d => d.trim()).filter(Boolean) : [];
              shares = splitUsers.map(su => {
                const detail = details.find(d => d.toLowerCase().startsWith(su.name.toLowerCase()));
                const val = detail ? parseFloat(detail.replace(/[^0-9.]/g, '')) : 0;
                return { userId: su.id, shareAmount: val };
              });
            } else if (mod.split_type === 'percentage') {
              const details = mod.split_details ? mod.split_details.split(';').map(d => d.trim()).filter(Boolean) : [];
              shares = splitUsers.map(su => {
                const detail = details.find(d => d.toLowerCase().startsWith(su.name.toLowerCase()));
                const val = detail ? parseFloat(detail.replace(/[^0-9.]/g, '')) : 0;
                const shareAmount = parseFloat(((val / 100) * amountINR).toFixed(2));
                return { userId: su.id, shareAmount };
              });
            } else if (mod.split_type === 'share') {
              const details = mod.split_details ? mod.split_details.split(';').map(d => d.trim()).filter(Boolean) : [];
              let totalRatios = 0;
              const userRatios = splitUsers.map(su => {
                const detail = details.find(d => d.toLowerCase().startsWith(su.name.toLowerCase()));
                const val = detail ? parseFloat(detail.replace(/[^0-9.]/g, '')) : 1;
                totalRatios += val;
                return { userId: su.id, ratio: val };
              });
              shares = userRatios.map(ur => ({
                userId: ur.userId,
                shareAmount: parseFloat(((ur.ratio / totalRatios) * amountINR).toFixed(2))
              }));
            }

            // Save shares to database
            for (const share of shares) {
              await prisma.expenseShare.create({
                data: {
                  expenseId: expense.id,
                  userId: share.userId,
                  shareAmount: share.shareAmount
                }
              });
            }
          }
        }
      }

      importResults.push({
        rowNumber: rowNum,
        description: rawRow.description,
        anomalies: checkResult.anomalies,
        imported: !hasBlocking
      });
    }

    res.json({
      message: 'CSV file processed successfully',
      results: importResults
    });
  } catch (error) {
    console.error('CSV Import error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
