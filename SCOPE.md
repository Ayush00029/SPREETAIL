# Scope Log: CSV Anomalies & Database Schema

This document details the database schema and all logical anomalies identified within `Expenses Export.csv` along with their resolution strategies.

---

## 1. Database Schema (SQLite via Prisma)

The database schema is designed to represent users, groups, memberships with specific time windows, expenses, detailed split shares, settlements (payments), and raw import logs.

```prisma
model User {
  id          Int               @id @default(autoincrement())
  email       String            @unique
  name        String
  password    String
  memberships GroupMembership[]
  paidExpenses Expense[]        @relation("PaidExpenses")
  shares      ExpenseShare[]
  sentPayments Payment[]        @relation("SentPayments")
  receivedPayments Payment[]    @relation("ReceivedPayments")
  createdAt   DateTime          @default(now())
}

model Group {
  id          Int               @id @default(autoincrement())
  name        String
  memberships GroupMembership[]
  expenses    Expense[]
  payments    Payment[]
  createdAt   DateTime          @default(now())
}

model GroupMembership {
  id        Int       @id @default(autoincrement())
  groupId   Int
  userId    Int
  joinedAt  DateTime  @default(now())
  leftAt    DateTime?
  group     Group     @relation(fields: [groupId], references: [id])
  user      User      @relation(fields: [userId], references: [id])
}

model Expense {
  id           Int            @id @default(autoincrement())
  groupId      Int
  description  String
  amount       Float
  currency     String
  exchangeRate Float          @default(1.0)
  amountINR    Float
  date         DateTime       @default(now())
  splitType    String         // "equal", "unequal", "percentage", "share"
  paidById     Int
  group        Group          @relation(fields: [groupId], references: [id])
  paidBy       User           @relation("PaidExpenses", fields: [paidById], references: [id])
  shares       ExpenseShare[]
  createdAt    DateTime       @default(now())
}

model ExpenseShare {
  id          Int      @id @default(autoincrement())
  expenseId   Int
  userId      Int
  shareValue  Float    // Raw percentage, shares, or unequal amount
  shareAmount Float    // Calculated share cost in INR
  expense     Expense  @relation(fields: [expenseId], references: [id], onDelete: Cascade)
  user        User     @relation(fields: [userId], references: [id])
}

model Payment {
  id         Int      @id @default(autoincrement())
  groupId    Int
  fromUserId Int
  toUserId   Int
  amount     Float
  date       DateTime @default(now())
  note       String?
  group      Group    @relation(fields: [groupId], references: [id])
  fromUser   User     @relation("SentPayments", fields: [fromUserId], references: [id])
  toUser     User     @relation("ReceivedPayments", fields: [toUserId], references: [id])
}

model ImportLog {
  id         Int      @id @default(autoincrement())
  groupId    Int
  rowNumber  Int
  rawRow     String   // JSON string of CSV row
  anomalies  String   // JSON array of detected anomaly objects
  status     String   // "applied", "pending_review", "ignored"
  resolvedAt DateTime?
}
```

---

## 2. Anomaly Log (Logical Data Problems & Handler Strategies)

We detected and implemented individual resolution paths for **19 logical anomalies**:

1. **Duplicate Amount/Description (Rows 5 & 6)**: Double-logged dinners on same date.
   - *Handling*: Second row is flagged with `DUPLICATE_EXPENSE` and held in `pending_review`.
2. **Comma Separator Numbers (Row 7)**: `"1,200"` in amount column.
   - *Handling*: `COMMA_SEPARATED_NUMBER` is resolved by stripping commas and auto-applying.
3. **Inconsistent Name Casing/Whitespace (Rows 9, 27)**: `priya`, `rohan ` (lowercase / trailing spaces).
   - *Handling*: Payer/members are mapped to canonical names (e.g. `Priya`, `Rohan`) under `INCONSISTENT_NAME`.
4. **Sub-paisa Decimal Precision (Row 10)**: `899.995` amount.
   - *Handling*: Rounded to 2 decimal places (`900.00`) under `SUB_PAISA_PRECISION`.
5. **Missing Payer (Row 13)**: Blank `paid_by` column.
   - *Handling*: Flagged `MISSING_PAID_BY` and held in `pending_review`.
6. **Mislabeled Settlement (Row 14)**: Payer repaying another back directly with no split type.
   - *Handling*: Flagged `MISLABELED_SETTLEMENT` and imported as a Payment record.
7. **Percentage Sum Mismatch (Row 15, 32)**: Split percentages sum to 110% instead of 100%.
   - *Handling*: Normalized split percentages to sum to exactly 100% under `PERCENTAGE_SUM_MISMATCH`.
8. **Foreign Currency Conversion (Rows 20, 21, 23, 26)**: Amounts in `USD`.
   - *Handling*: Converted to `INR` at standard exchange rate under `FOREIGN_CURRENCY`.
9. **Share-based Split Ratio details (Row 22)**: Shares mapping ratios.
   - *Handling*: Auto-calculated split share values under `SHARE_SPLIT_CALCULATION`.
10. **Non-member in Group Split (Row 23)**: `Dev's friend Kabir` is not a registered group member.
    - *Handling*: Flagged `NON_MEMBER_SPLIT`, excluded non-members, and split among active members.
11. **Conflicting Duplicates (Rows 24 & 25)**: Duplicate descriptions on same date with conflicting amounts.
    - *Handling*: Flagged `CONFLICTING_DUPLICATE` and held in `pending_review`.
12. **Negative Amounts/Refunds (Row 26)**: `-30 USD` parasailing refund.
    - *Handling*: Processed as refund and subtracted from balances under `NEGATIVE_AMOUNT`.
13. **Non-standard Date Format (Row 27)**: Date formatted as `Mar-14` instead of `14-03-2026`.
    - *Handling*: Normalized to standard format under `NON_STANDARD_DATE`.
14. **Missing Currency Field (Row 28)**: Blank currency column.
    - *Handling*: Defaulted to `INR` under `MISSING_CURRENCY`.
15. **Zero Amount (Row 31)**: Expense of `0`.
    - *Handling*: Flagged `ZERO_AMOUNT_EXPENSE` and held in `pending_review` (skipped by default).
16. **Ambiguous Date Format (Row 34)**: `04-05-2026` (April 5th or May 4th?).
    - *Handling*: Flagged `AMBIGUOUS_DATE`, default parsed to DD-MM-YYYY (4th May), held for review.
17. **Post-Membership Split (Row 36)**: `Meera` moving out Sunday but billed for April 2nd.
    - *Handling*: Excluded Meera (active window check), flagged `POST_MEMBERSHIP_SPLIT`, and redivided.
18. **Equal Split Details Contradiction (Row 42)**: Split type says `equal` but share ratios are specified.
    - *Handling*: If details match equal splits, ignored detail (`EQUAL_CONTRADICTION_RESOLVED`). If conflict, flagged (`EQUAL_CONTRADICTION_CONFLICT`).
19. **Future-dated Expense**: Date ahead of the current calendar system date.
    - *Handling*: Flagged `FUTURE_DATED_EXPENSE` and held in `pending_review`.
