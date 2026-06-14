# CSV Import Report Log

This report lists the CSV rows processed by the importer, highlighting detected anomalies, their type, and the action taken.

| Row | Description | Payer | Amount | Status | Detected Anomalies / Actions |
|---|---|---|---|---|---|
| 2 | February rent | Aisha | ₹48000.00 | `applied` | None (Clean Row applied immediately) |
| 3 | Groceries BigBasket | Priya | ₹2340.00 | `applied` | None (Clean Row applied immediately) |
| 4 | Wifi bill Feb | Rohan | ₹1199.00 | `applied` | None (Clean Row applied immediately) |
| 5 | Dinner at Marina Bites | Dev | ₹3200.00 | `applied` | None (Clean Row applied immediately) |
| 6 | dinner - marina bites | Dev | ₹3200.00 | `pending_review` | **[DUPLICATE_EXPENSE]** Flag duplicate expense: matches row 5. |
| 7 | Electricity Feb | Aisha | ₹1200.00 | `applied` | **[COMMA_SEPARATED_NUMBER]** Stripped commas from amount: "1,200" -> "1200" |
| 8 | Maid salary Feb | Meera | ₹3000.00 | `applied` | None (Clean Row applied immediately) |
| 9 | Movie night snacks | priya | ₹640.00 | `applied` | **[INCONSISTENT_NAME]** Normalized payer name: "priya" -> "Priya" |
| 10 | Cylinder refill | Rohan | ₹900.00 | `applied` | **[SUB_PAISA_PRECISION]** Rounded amount to 2 decimal places: 899.995 -> 900.00 |
| 11 | Groceries DMart | Priya S | ₹1875.00 | `applied` | **[INCONSISTENT_NAME]** Normalized "Priya S" to canonical "Priya" |
| 12 | Aisha birthday cake | Rohan | ₹1500.00 | `applied` | None (Custom split processed) |
| 13 | House cleaning supplies | *Missing* | ₹780.00 | `pending_review` | **[MISSING_PAID_BY]** Blocked row: Missing payer |
| 14 | Rohan paid Aisha back | Rohan | ₹5000.00 | `applied` | **[MISLABELED_SETTLEMENT]** Mapped to payment/settlement record instead of expense |
| 15 | Pizza Friday | Aisha | ₹1440.00 | `applied` | **[PERCENTAGE_SUM_MISMATCH]** Normalized percentage details to sum to exactly 100% |
| 16 | March rent | Aisha | ₹48000.00 | `applied` | None (Clean Row applied immediately) |
| 17 | Groceries BigBasket | Meera | ₹2810.00 | `applied` | None (Clean Row applied immediately) |
| 18 | Wifi bill Mar | Rohan | ₹1199.00 | `applied` | None (Clean Row applied immediately) |
| 19 | Goa flights | Aisha | ₹32400.00 | `applied` | None (Clean Row applied immediately) |
| 20 | Goa villa booking | Dev | ₹44820.00 | `applied` | **[FOREIGN_CURRENCY]** Converted 540 USD to INR at rate of 83 |
| 21 | Beach shack lunch | Rohan | ₹6972.00 | `applied` | **[FOREIGN_CURRENCY]** Converted 84 USD to INR at rate of 83 |
| 22 | Scooter rentals | Priya | ₹3600.00 | `applied` | **[SHARE_SPLIT_CALCULATION]** Auto-calculated split share values |
| 23 | Parasailing | Dev | ₹12450.00 | `pending_review` | **[NON_MEMBER_SPLIT]** Excluded non-member "Dev's friend Kabir", **[FOREIGN_CURRENCY]** Converted USD to INR |
| 24 | Dinner at Thalassa | Aisha | ₹2400.00 | `applied` | None (Clean Row applied immediately) |
| 25 | Thalassa dinner | Rohan | ₹2450.00 | `pending_review` | **[CONFLICTING_DUPLICATE]** Duplicate description, date, and payer with conflicting amount. |
| 26 | Parasailing refund | Dev | -₹2490.00 | `applied` | **[NEGATIVE_AMOUNT]** Handled negative refund, **[FOREIGN_CURRENCY]** Converted to INR |
| 27 | Airport cab | rohan | ₹1100.00 | `applied` | **[NON_STANDARD_DATE]** Normalized "Mar-14" to date, **[INCONSISTENT_NAME]** Normalized name |
| 28 | Groceries DMart | Priya | ₹2105.00 | `applied` | **[MISSING_CURRENCY]** Defaulted currency to INR |
| 29 | Electricity Mar | Aisha | ₹1450.00 | `applied` | None (Clean Row applied immediately) |
| 30 | Maid salary Mar | Meera | ₹3000.00 | `applied` | None (Clean Row applied immediately) |
| 31 | Dinner order Swiggy | Priya | ₹0.00 | `pending_review` | **[ZERO_AMOUNT_EXPENSE]** Flagged zero-amount expense for review |
| 32 | Weekend brunch | Meera | ₹2200.00 | `applied` | **[PERCENTAGE_SUM_MISMATCH]** Normalized percentages to sum to exactly 100% |
| 33 | Meera farewell dinner | Aisha | ₹4800.00 | `applied` | None (Clean Row applied immediately) |
| 34 | Deep cleaning service | Rohan | ₹2500.00 | `pending_review` | **[AMBIGUOUS_DATE]** Flagged ambiguous format (April 5 or May 4) |
| 35 | April rent | Aisha | ₹48000.00 | `applied` | **[SHARE_SPLIT_CALCULATION]** Processed split share ratios |
| 36 | Groceries BigBasket | Priya | ₹2640.00 | `pending_review` | **[POST_MEMBERSHIP_SPLIT]** Billed after move out date |
| 37 | Wifi bill Apr | Rohan | ₹1199.00 | `applied` | None (Clean Row applied immediately) |
| 38 | Sam deposit share | Sam | ₹15000.00 | `applied` | None (Clean Row applied immediately) |
| 39 | Housewarming drinks | Sam | ₹3100.00 | `applied` | None (Clean Row applied immediately) |
| 40 | Electricity Apr | Aisha | ₹1380.00 | `applied` | None (Clean Row applied immediately) |
| 41 | Groceries DMart | Sam | ₹1990.00 | `applied` | None (Clean Row applied immediately) |
| 42 | Furniture for common room | Aisha | ₹12000.00 | `applied` | **[EQUAL_CONTRADICTION_RESOLVED]** Extraneous details ignored |
| 43 | Maid salary Apr | Priya | ₹3000.00 | `applied` | None (Clean Row applied immediately) |
