# Architecture rules
- General Ledger computes cumulative summaries from all paginated posted lines through the selected end date, independently of displayed-period totals, so date filters cannot truncate account summaries.
- Bank/mobile money accounts in the 521 family use debit-normal balance calculations regardless of legacy account-type metadata, so credit balances retain their correct sign.