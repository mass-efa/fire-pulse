import Anthropic from '@anthropic-ai/sdk';
import supabase from '../db/client.js';
import { fetchPrices, calculateMetrics, getTopHoldings } from './marketData.js';
import { getSentimentBatch } from './sentiment.js';
import { buildBriefingPrompt } from './briefingPrompt.js';
import { sendSMS } from './sms.js';

const anthropic = new Anthropic();

// ─── PUBLIC: RUN FOR ONE USER ─────────────────────────────────────────────────
export async function runBriefingForUser(userId, briefingType) {
  const briefingId = await createPendingBriefing(userId, briefingType);

  try {
    // 1. Load holdings
    const holdings = await getHoldings(userId);
    if (!holdings.length) {
      return updateBriefing(briefingId, 'failed', { error_log: 'No holdings' });
    }

    // 2. Fetch prices — cache-first, yahoo primary, Alpha Vantage fallback
    const prices = await fetchPrices(holdings.map(h => h.ticker));

    // 3. Fetch StockTwits sentiment for top 5 holdings by value
    const topHoldings = getTopHoldings(holdings, prices, 5);
    const sentiment = await getSentimentBatch(topHoldings.map(h => h.ticker));

    // 4. Calculate portfolio metrics
    const metrics = calculateMetrics(holdings, prices);

    // 5. Daily snapshot — AM only, once per day
    if (briefingType === 'am') await maybeTakeSnapshot(userId, holdings, prices, metrics);

    // 6. Build prompt and call Claude
    const prompt = buildBriefingPrompt(holdings, prices, sentiment, metrics, briefingType);
    const briefingContent = await callClaudeAgent(prompt);

    // 7. Save completed briefing
    await updateBriefing(briefingId, 'completed', {
      content_full: briefingContent.full,
      content_sms: briefingContent.sms,
      market_snapshot: prices,
    });

    // 8. Send SMS
    const user = await getUser(userId);
    if (user?.phone) await sendSMS(user.phone, briefingContent.sms);

  } catch (err) {
    console.error(`runBriefingForUser [${userId}]:`, err.message);
    const briefing = await getBriefing(briefingId);

    if (briefing?.retry_count === 0) {
      await updateBriefing(briefingId, 'pending', { retry_count: 1 });
      setTimeout(() => runBriefingForUser(userId, briefingType), 5 * 60 * 1000);
    } else {
      await updateBriefing(briefingId, 'failed', { error_log: err.message });
    }
  }
}

// ─── PUBLIC: RUN FOR ALL USERS ────────────────────────────────────────────────
// Called by the scheduler. Fires per-user jobs concurrently (non-blocking).
export async function runBriefingForAllUsers(briefingType) {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, am_briefing_enabled, pm_briefing_enabled');

  if (error) { console.error('runBriefingForAllUsers: fetch failed', error.message); return; }

  for (const user of users ?? []) {
    const enabled = briefingType === 'am' ? user.am_briefing_enabled : user.pm_briefing_enabled;
    if (!enabled) continue;
    runBriefingForUser(user.id, briefingType).catch(err =>
      console.error(`runBriefingForAllUsers [${user.id}]:`, err.message)
    );
  }
}

// ─── CLAUDE API ───────────────────────────────────────────────────────────────
// Runs the agentic loop — Claude may call web_search multiple times before
// producing the final FULL_BRIEFING / SHORT_SMS response.
async function callClaudeAgent({ system, user }) {
  const messages = [{ role: 'user', content: user }];
  let response;

  for (let i = 0; i < 10; i++) {
    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages,
    });

    if (response.stop_reason === 'end_turn') break;
    if (response.stop_reason !== 'tool_use') break;

    // Claude used web_search — add its message and continue the loop.
    // Anthropic executes the search server-side; the next API call receives results.
    messages.push({ role: 'assistant', content: response.content });

    const toolResults = response.content
      .filter(b => b.type === 'tool_use')
      .map(b => ({ type: 'tool_result', tool_use_id: b.id, content: '' }));

    if (toolResults.length) messages.push({ role: 'user', content: toolResults });
  }

  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n');

  return parseBriefingResponse(text);
}

function parseBriefingResponse(text) {
  const fullMatch = text.match(/FULL_BRIEFING:\s*([\s\S]*?)(?=SHORT_SMS:|$)/);
  const smsMatch  = text.match(/SHORT_SMS:\s*([\s\S]*)$/);
  return {
    full: fullMatch?.[1]?.trim() ?? text,
    sms:  smsMatch?.[1]?.trim()  ?? '',
  };
}

// ─── DB HELPERS ───────────────────────────────────────────────────────────────
async function createPendingBriefing(userId, briefingType) {
  const { data, error } = await supabase
    .from('briefings')
    .insert({ user_id: userId, briefing_type: briefingType, status: 'pending' })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function updateBriefing(briefingId, status, fields = {}) {
  const { error } = await supabase
    .from('briefings')
    .update({ status, ...fields })
    .eq('id', briefingId);
  if (error) console.error('updateBriefing:', error.message);
}

async function getBriefing(briefingId) {
  const { data } = await supabase
    .from('briefings').select('*').eq('id', briefingId).maybeSingle();
  return data;
}

async function getHoldings(userId) {
  const { data, error } = await supabase
    .from('holdings').select('*').eq('user_id', userId);
  if (error) throw error;
  return data ?? [];
}

async function getUser(userId) {
  const { data } = await supabase
    .from('users').select('*').eq('id', userId).maybeSingle();
  return data;
}

async function maybeTakeSnapshot(userId, holdings, prices, metrics) {
  const today = new Date().toISOString().split('T')[0];

  const { data: existing } = await supabase
    .from('portfolio_snapshots')
    .select('id')
    .eq('user_id', userId)
    .eq('snapshot_date', today)
    .maybeSingle();

  if (existing) return; // Already snapshotted today

  const holdingsWithPrices = holdings.map(h => ({
    ...h,
    currentPrice: prices[h.ticker]?.price ?? null,
    currentValue: prices[h.ticker] ? prices[h.ticker].price * h.shares : null,
  }));

  const { error } = await supabase.from('portfolio_snapshots').insert({
    user_id:       userId,
    snapshot_date: today,
    holdings_json: holdingsWithPrices,
    total_value:   metrics.totalValue,
  });
  if (error) console.error('maybeTakeSnapshot:', error.message);
}
