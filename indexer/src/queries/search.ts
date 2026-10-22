import { getPool } from '../db/client';
import { ANALYTICS, FULL_TEXT_SEARCH_CONFIG, QUERY_LIMITS } from '../constants';

// --- Full-text search ---

export async function searchParticipants(query: string, limit = QUERY_LIMITS.DEFAULT) {
  const { rows } = await getPool().query(
    `SELECT address, role, name, latitude, longitude, registered_at,
            ts_rank(search_vector, plainto_tsquery('${FULL_TEXT_SEARCH_CONFIG}', $1)) AS rank
     FROM participants
     WHERE search_vector @@ plainto_tsquery('${FULL_TEXT_SEARCH_CONFIG}', $1)
     ORDER BY rank DESC
     LIMIT $2`,
    [query, limit]
  );
  return rows;
}

export async function searchWastes(query: string, limit = QUERY_LIMITS.DEFAULT) {
  const { rows } = await getPool().query(
    `SELECT w.id, w.recycler_address, w.waste_type, w.weight, w.is_confirmed, w.is_active,
            w.registered_at,
            ts_rank(w.search_vector, plainto_tsquery('${FULL_TEXT_SEARCH_CONFIG}', $1)) AS rank
     FROM wastes w
     WHERE w.search_vector @@ plainto_tsquery('${FULL_TEXT_SEARCH_CONFIG}', $1)
     ORDER BY rank DESC
     LIMIT $2`,
    [query, limit]
  );
  return rows;
}

// --- Aggregations ---

export async function getWasteStatsByType() {
  const { rows } = await getPool().query(
    `SELECT waste_type,
            COUNT(*) AS total_count,
            SUM(weight) AS total_weight,
            COUNT(*) FILTER (WHERE is_confirmed) AS confirmed_count,
            COUNT(*) FILTER (WHERE is_active) AS active_count
     FROM wastes
     GROUP BY waste_type
     ORDER BY total_weight DESC`
  );
  return rows;
}

export async function getTopRecyclers(limit = ANALYTICS.DEFAULT_TOP_RESULTS_LIMIT) {
  const { rows } = await getPool().query(
    `SELECT p.address, p.name, p.role,
            COUNT(w.id) AS waste_count,
            COALESCE(SUM(w.weight), 0) AS total_weight,
            COALESCE(SUM(r.amount), 0) AS total_rewards
     FROM participants p
     LEFT JOIN wastes w ON w.recycler_address = p.address
     LEFT JOIN token_rewards r ON r.recipient_address = p.address
     GROUP BY p.address, p.name, p.role
     ORDER BY total_weight DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function getRewardSummary() {
  const { rows } = await getPool().query(
    `SELECT recipient_address,
            COUNT(*) AS reward_count,
            SUM(amount) AS total_amount
     FROM token_rewards
     GROUP BY recipient_address
     ORDER BY total_amount DESC`
  );
  return rows;
}

export async function getTransferActivity(days = ANALYTICS.DEFAULT_TRANSFER_ACTIVITY_DAYS) {
  const { rows } = await getPool().query(
    `SELECT DATE_TRUNC('day', transferred_at) AS day,
            COUNT(*) AS transfer_count
     FROM waste_transfers
     WHERE transferred_at >= NOW() - ($1 || ' days')::INTERVAL
     GROUP BY day
     ORDER BY day`,
    [days]
  );
  return rows;
}

export async function getCarbonCreditsByParticipant(limit = ANALYTICS.DEFAULT_TOP_RESULTS_LIMIT) {
  const { rows } = await getPool().query(
    `SELECT participant_address,
            SUM(credits) AS total_credits,
            SUM(weight) AS total_weight
     FROM carbon_credits
     GROUP BY participant_address
     ORDER BY total_credits DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function getGlobalMetrics() {
  const pool = getPool();
  const [wastes, participants, rewards, transfers] = await Promise.all([
    pool.query(`SELECT COUNT(*) AS total, SUM(weight) AS total_weight FROM wastes WHERE is_active`),
    pool.query(`SELECT COUNT(*) AS total FROM participants WHERE is_active`),
    pool.query(`SELECT COALESCE(SUM(amount), 0) AS total FROM token_rewards`),
    pool.query(`SELECT COUNT(*) AS total FROM waste_transfers`),
  ]);

  return {
    totalWastes: Number(wastes.rows[0].total),
    totalWeight: wastes.rows[0].total_weight ?? '0',
    totalParticipants: Number(participants.rows[0].total),
    totalRewardsDistributed: rewards.rows[0].total,
    totalTransfers: Number(transfers.rows[0].total),
  };
}
