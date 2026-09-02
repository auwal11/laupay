/**
 * PROOF TEST — not part of the application code.
 *
 * This exercises the exact SQL pattern used by LedgerService.debit()
 * (SELECT ... FOR UPDATE, re-validate balance under lock, insert ledger
 * entry, update cached balance, all in one transaction) directly against a
 * real PostgreSQL instance, bypassing Prisma Client (whose native engine
 * binary could not be downloaded in this sandbox — see
 * docs/decisions/00-project-status.md).
 *
 * Purpose: prove that the locking strategy documented in
 * docs/architecture/wallet-ledger-model.md §4 actually prevents double-
 * spending under real concurrent load, not just in single-threaded unit
 * tests with a mocked database.
 *
 * Scenario: a wallet starts with a balance of 1000. We fire 50 concurrent
 * debit requests of 100 each (5000 total demand against 1000 available —
 * if locking is broken, we'd see the balance go negative or more than 10
 * debits succeed). We also fire 20 concurrent requests that all share the
 * SAME idempotency key, to prove only one of them is ever actually applied.
 */
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  user: 'laupay',
  password: 'laupay',
  database: 'laupay',
});

async function debit(walletId, amount, idempotencyKey) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT id, balance, status FROM wallet_accounts WHERE id = $1 FOR UPDATE`,
      [walletId],
    );
    const wallet = rows[0];
    if (!wallet) throw new Error('wallet not found');

    const balanceAfter = Number(wallet.balance) - amount;
    if (balanceAfter < 0) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'INSUFFICIENT_BALANCE' };
    }

    try {
      await client.query(
        `INSERT INTO ledger_entries (wallet_account_id, direction, amount, balance_after, idempotency_key)
         VALUES ($1, 'DEBIT', $2, $3, $4)`,
        [walletId, amount, balanceAfter, idempotencyKey],
      );
    } catch (err) {
      if (err.code === '23505') {
        // unique_violation on idempotency_key — duplicate request
        await client.query('ROLLBACK');
        return { ok: false, reason: 'DUPLICATE_IDEMPOTENCY_KEY' };
      }
      throw err;
    }

    await client.query(
      `UPDATE wallet_accounts SET balance = $1, version = version + 1 WHERE id = $2`,
      [balanceAfter, walletId],
    );
    await client.query('COMMIT');
    return { ok: true, balanceAfter };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  console.log('=== LAUPAY Ledger Concurrency Proof Test (raw SQL, real Postgres) ===\n');

  // --- Test 1: concurrent debits must never allow the balance to go negative ---
  const { rows: walletRows } = await pool.query(
    `INSERT INTO wallet_accounts (balance) VALUES (1000) RETURNING id`,
  );
  const walletId = walletRows[0].id;
  console.log(`Test 1: wallet ${walletId} starts with balance = 1000`);
  console.log('Firing 50 concurrent debit requests of 100 each (5000 total demand)...');

  const debitPromises = Array.from({ length: 50 }, (_, i) =>
    debit(walletId, 100, `concurrent-debit-${i}`),
  );
  const results = await Promise.all(debitPromises);
  const succeeded = results.filter((r) => r.ok).length;
  const rejected = results.filter((r) => !r.ok && r.reason === 'INSUFFICIENT_BALANCE').length;

  const { rows: finalWallet } = await pool.query(
    `SELECT balance FROM wallet_accounts WHERE id = $1`,
    [walletId],
  );
  const finalBalance = Number(finalWallet[0].balance);

  console.log(`  Succeeded: ${succeeded} (expected exactly 10, since 10 x 100 = 1000)`);
  console.log(`  Rejected (insufficient balance): ${rejected} (expected 40)`);
  console.log(`  Final balance: ${finalBalance} (expected 0, must NEVER be negative)`);

  const { rows: ledgerCount } = await pool.query(
    `SELECT COUNT(*)::int AS c FROM ledger_entries WHERE wallet_account_id = $1`,
    [walletId],
  );
  console.log(`  Ledger entries written: ${ledgerCount[0].c} (must equal succeeded count)`);

  const test1Pass =
    succeeded === 10 && rejected === 40 && finalBalance === 0 && ledgerCount[0].c === 10;
  console.log(test1Pass ? '  PASS ✅\n' : '  FAIL ❌\n');

  // --- Test 2: idempotency — same key fired concurrently must only apply once ---
  const { rows: walletRows2 } = await pool.query(
    `INSERT INTO wallet_accounts (balance) VALUES (1000) RETURNING id`,
  );
  const walletId2 = walletRows2[0].id;
  console.log(`Test 2: wallet ${walletId2} starts with balance = 1000`);
  console.log('Firing 20 concurrent debit requests of 100, ALL using the SAME idempotency key...');

  const idempotentPromises = Array.from({ length: 20 }, () =>
    debit(walletId2, 100, 'same-key-every-time'),
  );
  const results2 = await Promise.all(idempotentPromises);
  const applied = results2.filter((r) => r.ok).length;
  const deduped = results2.filter((r) => !r.ok && r.reason === 'DUPLICATE_IDEMPOTENCY_KEY').length;

  const { rows: finalWallet2 } = await pool.query(
    `SELECT balance FROM wallet_accounts WHERE id = $1`,
    [walletId2],
  );
  const finalBalance2 = Number(finalWallet2[0].balance);

  console.log(`  Applied: ${applied} (expected exactly 1)`);
  console.log(`  Deduped as duplicate: ${deduped} (expected 19)`);
  console.log(`  Final balance: ${finalBalance2} (expected 900, i.e. debited exactly once)`);

  const test2Pass = applied === 1 && deduped === 19 && finalBalance2 === 900;
  console.log(test2Pass ? '  PASS ✅\n' : '  FAIL ❌\n');

  console.log('=== Overall:', test1Pass && test2Pass ? 'ALL TESTS PASSED ✅' : 'FAILED ❌', '===');

  await pool.end();
  process.exit(test1Pass && test2Pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
