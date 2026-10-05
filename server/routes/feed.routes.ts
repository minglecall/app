import { Router } from 'express';
import { randomUUID } from 'crypto';
import type { ServerRuntime } from '../runtimeTypes';
import { requireAuth } from '../middleware/auth';
import { getSupabaseAdmin, isSupabaseAdminConfigured, upsertProfileAdmin } from '../supabaseAdmin';
import { appendGiftEarnLedger, loadGiftSharePercents } from '../finance/walletLedgerWrite';
import { computeGiftCoinSplit } from '../../shared/finance/economyGift';

const MAX_CAPTION = 2000;
const MAX_MEDIA_URL = 2048;
const DEFAULT_TIP_COINS = 20;
const MAX_TIP_COINS = 200;

function authUserId(req: any): string {
  return String(req.profileId || req.user?.id || '');
}

function sendError(res: any, status: number, message: string, code: string) {
  return res.status(status).json({ success: false, error: { message, code } });
}

function sanitizeText(value: unknown, maxLen: number): string {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .slice(0, maxLen);
}

function isAllowedMomentMediaUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > MAX_MEDIA_URL) return false;
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) return false;

  if (trimmed.startsWith('/api/storage/media?key=')) {
    try {
      const q = new URL(trimmed, 'http://localhost').searchParams.get('key') || '';
      return q.includes('uploads/');
    } catch {
      return false;
    }
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const path = decodeURIComponent(parsed.pathname || '');
    if (
      path.includes('/uploads/moment/') ||
      path.includes('/uploads/gallery/') ||
      path.includes('/uploads/chat_media/')
    ) {
      return true;
    }
    if (parsed.searchParams.get('key')?.includes('uploads/')) return true;
    // Allow common CDN image hosts used by existing seed/demo posts
    if (/\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(path)) return true;
    return false;
  } catch {
    return false;
  }
}

function mapFeedPost(row: any, isLiked: boolean) {
  return {
    id: row.id,
    creatorId: row.creator_id,
    creatorName: row.creator_name,
    creatorAvatar: row.creator_avatar || '',
    creatorCountry: row.creator_country || undefined,
    mediaUrl: row.media_url,
    mediaType: row.media_type === 'video' ? 'video' : 'image',
    caption: row.caption || '',
    likes: Number(row.likes || 0),
    commentsCount: Number(row.comments_count || 0),
    isLiked: Boolean(isLiked),
    createdAt: row.created_at,
  };
}

async function loadLikedPostIds(client: any, userId: string, postIds: string[]) {
  if (!userId || postIds.length === 0) return new Set<string>();
  const { data, error } = await client
    .from('feed_post_likes')
    .select('post_id')
    .eq('user_id', userId)
    .in('post_id', postIds);
  if (error) {
    console.error('[feed] likes lookup:', error.message);
    return new Set<string>();
  }
  return new Set((data || []).map((r: any) => String(r.post_id)));
}

function isEligibleTipHost(profile: any): boolean {
  if (!profile) return false;
  const role = String(profile.role || '');
  return (
    role === 'female_creator' ||
    role === 'female_host' ||
    Boolean(profile.team_leader_id || profile.created_by_id)
  );
}

export function createFeedRouter(runtime: ServerRuntime) {
  const router = Router();
  const { serverUsers, broadcastUsers, recordCreatorEarnCoins } = runtime;

  /** GET /api/v1/feed?limit=&cursor= */
  router.get('/', requireAuth, async (req, res) => {
    try {
      if (!isSupabaseAdminConfigured()) {
        return sendError(res, 503, 'Feed backend unavailable', 'NO_ADMIN');
      }
      const viewerId = authUserId(req);
      const limit = Math.min(Math.max(Number(req.query?.limit) || 50, 1), 100);
      const cursor = sanitizeText(req.query?.cursor, 64) || null;

      const client = getSupabaseAdmin()!;
      let query = client
        .from('feed_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (cursor) {
        query = query.lt('created_at', cursor);
      }

      const { data, error } = await query;
      if (error) {
        console.error('[feed/list]', error.message);
        return sendError(res, 500, 'Failed to load feed', 'LOAD_FAILED');
      }

      const rows = data || [];
      const liked = await loadLikedPostIds(
        client,
        viewerId,
        rows.map((r: any) => String(r.id))
      );
      const posts = rows.map((r: any) => mapFeedPost(r, liked.has(String(r.id))));
      const nextCursor =
        rows.length === limit ? rows[rows.length - 1]?.created_at || null : null;

      return res.json({
        success: true,
        data: { posts, nextCursor },
      });
    } catch (err: any) {
      console.error('[feed/list] exception:', err);
      return sendError(res, 500, err?.message || 'Failed to load feed', 'LOAD_FAILED');
    }
  });

  /** GET /api/v1/feed/user/:userId */
  router.get('/user/:userId', requireAuth, async (req, res) => {
    try {
      if (!isSupabaseAdminConfigured()) {
        return sendError(res, 503, 'Feed backend unavailable', 'NO_ADMIN');
      }
      const viewerId = authUserId(req);
      const userId = sanitizeText(req.params.userId, 128);
      if (!userId) return sendError(res, 400, 'userId required', 'INVALID_USER');

      const limit = Math.min(Math.max(Number(req.query?.limit) || 50, 1), 100);
      const client = getSupabaseAdmin()!;
      const { data, error } = await client
        .from('feed_posts')
        .select('*')
        .eq('creator_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[feed/user]', error.message);
        return sendError(res, 500, 'Failed to load user moments', 'LOAD_FAILED');
      }

      const rows = data || [];
      const liked = await loadLikedPostIds(
        client,
        viewerId,
        rows.map((r: any) => String(r.id))
      );

      return res.json({
        success: true,
        data: {
          posts: rows.map((r: any) => mapFeedPost(r, liked.has(String(r.id)))),
        },
      });
    } catch (err: any) {
      console.error('[feed/user] exception:', err);
      return sendError(res, 500, err?.message || 'Failed to load user moments', 'LOAD_FAILED');
    }
  });

  /** POST /api/v1/feed  { mediaUrl, mediaType?, caption? } */
  router.post('/', requireAuth, async (req, res) => {
    try {
      if (!isSupabaseAdminConfigured()) {
        return sendError(res, 503, 'Feed backend unavailable', 'NO_ADMIN');
      }
      const creatorId = authUserId(req);
      if (!creatorId) return sendError(res, 401, 'Unauthorized', 'UNAUTHORIZED');

      const mediaUrl = sanitizeText(req.body?.mediaUrl, MAX_MEDIA_URL);
      const caption = sanitizeText(req.body?.caption, MAX_CAPTION);
      const mediaType = String(req.body?.mediaType || 'image').trim() === 'video' ? 'video' : 'image';

      if (!mediaUrl || !isAllowedMomentMediaUrl(mediaUrl)) {
        return sendError(res, 400, 'Valid moment mediaUrl is required', 'INVALID_MEDIA');
      }

      const client = getSupabaseAdmin()!;
      const { data: creator, error: creatorErr } = await client
        .from('profiles')
        .select('id, name, avatar_url, country_code, nationality')
        .eq('id', creatorId)
        .maybeSingle();
      if (creatorErr) throw creatorErr;
      if (!creator) return sendError(res, 404, 'Creator profile not found', 'CREATOR_NOT_FOUND');

      const postId = `post_${randomUUID()}`;
      const creatorCountry = [creator.country_code, creator.nationality].filter(Boolean).join(' ').trim();

      const { data, error } = await client
        .from('feed_posts')
        .insert({
          id: postId,
          creator_id: creatorId,
          creator_name: creator.name || 'Creator',
          creator_avatar: creator.avatar_url || null,
          media_url: mediaUrl,
          media_type: mediaType,
          caption,
          likes: 0,
          comments_count: 0,
        })
        .select('*')
        .single();

      if (error || !data) {
        console.error('[feed/create]', error?.message);
        return sendError(res, 500, 'Failed to create moment', 'CREATE_FAILED');
      }

      const post = mapFeedPost(
        { ...data, creator_country: creatorCountry || undefined },
        false
      );

      return res.status(201).json({ success: true, data: { post } });
    } catch (err: any) {
      console.error('[feed/create] exception:', err);
      return sendError(res, 500, err?.message || 'Failed to create moment', 'CREATE_FAILED');
    }
  });

  /** POST /api/v1/feed/:postId/like — toggle like */
  router.post('/:postId/like', requireAuth, async (req, res) => {
    try {
      if (!isSupabaseAdminConfigured()) {
        return sendError(res, 503, 'Feed backend unavailable', 'NO_ADMIN');
      }
      const userId = authUserId(req);
      const postId = sanitizeText(req.params.postId, 128);
      if (!userId) return sendError(res, 401, 'Unauthorized', 'UNAUTHORIZED');
      if (!postId) return sendError(res, 400, 'postId required', 'INVALID_POST');

      const client = getSupabaseAdmin()!;
      const { data: post, error: postErr } = await client
        .from('feed_posts')
        .select('id, likes')
        .eq('id', postId)
        .maybeSingle();
      if (postErr) throw postErr;
      if (!post) return sendError(res, 404, 'Post not found', 'NOT_FOUND');

      const { data: existing } = await client
        .from('feed_post_likes')
        .select('post_id')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .maybeSingle();

      let liked = false;
      let likes = Number(post.likes || 0);

      if (existing) {
        const { error: delErr } = await client
          .from('feed_post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', userId);
        if (delErr) {
          console.error('[feed/unlike]', delErr.message);
          return sendError(res, 500, 'Failed to unlike', 'UNLIKE_FAILED');
        }
        likes = Math.max(0, likes - 1);
        liked = false;
      } else {
        const { error: insErr } = await client.from('feed_post_likes').insert({
          post_id: postId,
          user_id: userId,
        });
        if (insErr) {
          // Race: already liked
          if (String(insErr.code) === '23505') {
            liked = true;
          } else {
            console.error('[feed/like]', insErr.message);
            return sendError(res, 500, 'Failed to like', 'LIKE_FAILED');
          }
        } else {
          likes = likes + 1;
          liked = true;
        }
      }

      const { error: updErr } = await client
        .from('feed_posts')
        .update({ likes })
        .eq('id', postId);
      if (updErr) {
        console.error('[feed/like count]', updErr.message);
      }

      return res.json({
        success: true,
        data: { postId, liked, likes },
      });
    } catch (err: any) {
      console.error('[feed/like] exception:', err);
      return sendError(res, 500, err?.message || 'Failed to toggle like', 'LIKE_FAILED');
    }
  });

  /** DELETE /api/v1/feed/:postId */
  router.delete('/:postId', requireAuth, async (req, res) => {
    try {
      if (!isSupabaseAdminConfigured()) {
        return sendError(res, 503, 'Feed backend unavailable', 'NO_ADMIN');
      }
      const userId = authUserId(req);
      const postId = sanitizeText(req.params.postId, 128);
      if (!userId) return sendError(res, 401, 'Unauthorized', 'UNAUTHORIZED');
      if (!postId) return sendError(res, 400, 'postId required', 'INVALID_POST');

      const client = getSupabaseAdmin()!;
      const { data: post, error: postErr } = await client
        .from('feed_posts')
        .select('id, creator_id')
        .eq('id', postId)
        .maybeSingle();
      if (postErr) throw postErr;
      if (!post) return sendError(res, 404, 'Post not found', 'NOT_FOUND');

      const profile = (req as any).profile as { role?: string } | undefined;
      const isAdmin = profile?.role === 'admin';
      if (String(post.creator_id) !== userId && !isAdmin) {
        return sendError(res, 403, 'You can only delete your own moments', 'FORBIDDEN');
      }

      const { error } = await client.from('feed_posts').delete().eq('id', postId);
      if (error) {
        console.error('[feed/delete]', error.message);
        return sendError(res, 500, 'Failed to delete moment', 'DELETE_FAILED');
      }

      return res.json({ success: true, data: { deleted: true, postId } });
    } catch (err: any) {
      console.error('[feed/delete] exception:', err);
      return sendError(res, 500, err?.message || 'Failed to delete moment', 'DELETE_FAILED');
    }
  });

  /**
   * POST /api/v1/feed/:postId/tip
   * Body: { coins? } — default 20. Server derives host/tl earnings; ignores client earn fields.
   */
  router.post('/:postId/tip', requireAuth, async (req, res) => {
    try {
      if (!isSupabaseAdminConfigured()) {
        return sendError(res, 503, 'Feed backend unavailable', 'NO_ADMIN');
      }
      const senderId = authUserId(req);
      const postId = sanitizeText(req.params.postId, 128);
      if (!senderId) return sendError(res, 401, 'Unauthorized', 'UNAUTHORIZED');
      if (!postId) return sendError(res, 400, 'postId required', 'INVALID_POST');

      // Reject client-supplied earn fields (non-negotiable)
      if (
        req.body?.hostCoinsEarned != null ||
        req.body?.tlCoinsEarned != null ||
        req.body?.hostEarnings != null
      ) {
        return sendError(
          res,
          400,
          'Client must not supply hostCoinsEarned or tlCoinsEarned',
          'CLIENT_EARN_FORBIDDEN'
        );
      }

      let tipCoins = Number(req.body?.coins);
      if (!Number.isFinite(tipCoins) || tipCoins <= 0) tipCoins = DEFAULT_TIP_COINS;
      tipCoins = Math.min(MAX_TIP_COINS, Math.max(1, Math.round(tipCoins)));

      const client = getSupabaseAdmin()!;
      const { data: post, error: postErr } = await client
        .from('feed_posts')
        .select('id, creator_id')
        .eq('id', postId)
        .maybeSingle();
      if (postErr) throw postErr;
      if (!post) return sendError(res, 404, 'Post not found', 'NOT_FOUND');

      const creatorId = String(post.creator_id);
      if (creatorId === senderId) {
        return sendError(res, 400, 'You cannot tip your own moment', 'SELF_TIP');
      }

      const { data: sender, error: senderErr } = await client
        .from('profiles')
        .select('id, coin_balance, name')
        .eq('id', senderId)
        .maybeSingle();
      if (senderErr) throw senderErr;
      if (!sender) return sendError(res, 404, 'Sender not found', 'SENDER_NOT_FOUND');

      const balance = Number(sender.coin_balance || 0);
      if (balance < tipCoins) {
        return sendError(res, 400, 'Insufficient coins', 'INSUFFICIENT_COINS');
      }

      const { data: creator, error: creatorErr } = await client
        .from('profiles')
        .select(
          'id, name, role, earnings_coins, total_gifts_received_count, team_leader_id, created_by_id'
        )
        .eq('id', creatorId)
        .maybeSingle();
      if (creatorErr) throw creatorErr;
      if (!creator) return sendError(res, 404, 'Creator not found', 'CREATOR_NOT_FOUND');

      const shares = await loadGiftSharePercents(client);
      const eligible = isEligibleTipHost(creator);
      const tlId = creator.team_leader_id || creator.created_by_id || null;
      const split = computeGiftCoinSplit({
        giftCost: tipCoins,
        hostSharePercent: shares.host,
        tlSharePercent: shares.tl,
        hasTeamLeader: Boolean(tlId),
        hostEligible: eligible,
      });
      const hostCoinsEarned = split.hostCoins;
      const tlCoinsEarned = split.tlCoins;

      const newSenderBalance = Math.max(0, balance - tipCoins);
      const { error: debitErr } = await client
        .from('profiles')
        .update({ coin_balance: newSenderBalance })
        .eq('id', senderId)
        .gte('coin_balance', tipCoins);
      if (debitErr) {
        console.error('[feed/tip] debit:', debitErr.message);
        return sendError(res, 500, 'Failed to debit coins', 'DEBIT_FAILED');
      }

      // Verify debit applied (optimistic concurrency)
      const { data: senderAfter } = await client
        .from('profiles')
        .select('coin_balance')
        .eq('id', senderId)
        .maybeSingle();
      if (Number(senderAfter?.coin_balance) > newSenderBalance) {
        // Race lost — abort
        return sendError(res, 409, 'Balance changed; tip not applied', 'BALANCE_RACE');
      }

      let newHostEarnings = Number(creator.earnings_coins || 0);
      if (hostCoinsEarned > 0) {
        newHostEarnings = newHostEarnings + hostCoinsEarned;
        const { error: creditErr } = await client
          .from('profiles')
          .update({
            earnings_coins: newHostEarnings,
            total_gifts_received_count: Number(creator.total_gifts_received_count || 0) + 1,
          })
          .eq('id', creatorId);
        if (creditErr) {
          console.error('[feed/tip] credit host:', creditErr.message);
          // Best-effort refund sender
          await client.from('profiles').update({ coin_balance: balance }).eq('id', senderId);
          return sendError(res, 500, 'Failed to credit host', 'CREDIT_FAILED');
        }
      }

      let newTlEarnings: number | null = null;
      if (tlId && tlCoinsEarned > 0) {
        const { data: tl } = await client
          .from('profiles')
          .select('id, earnings_coins')
          .eq('id', tlId)
          .maybeSingle();
        if (tl) {
          newTlEarnings = Number(tl.earnings_coins || 0) + tlCoinsEarned;
          await client
            .from('profiles')
            .update({ earnings_coins: newTlEarnings })
            .eq('id', tlId);
        }
      }

      // Sync in-memory runtime if present
      const memSender = serverUsers.get(senderId);
      if (memSender) {
        memSender.coinBalance = newSenderBalance;
        serverUsers.set(senderId, memSender);
        upsertProfileAdmin(memSender).catch(() => {});
      }
      const memHost = serverUsers.get(creatorId);
      if (memHost && hostCoinsEarned > 0) {
        memHost.earningsCoins = newHostEarnings;
        memHost.totalGiftsReceivedCount = (memHost.totalGiftsReceivedCount || 0) + 1;
        serverUsers.set(creatorId, memHost);
        upsertProfileAdmin(memHost).catch(() => {});
      }
      if (tlId && newTlEarnings != null) {
        const memTl = serverUsers.get(String(tlId));
        if (memTl) {
          memTl.earningsCoins = newTlEarnings;
          serverUsers.set(String(tlId), memTl);
          upsertProfileAdmin(memTl).catch(() => {});
        }
      }

      // Always write GIFT_DEBIT for tip debit; HOST/TL when eligible
      {
        const sourceKey = `tip:${postId}:${senderId}:${Date.now()}`;
        const ledgerResult = await appendGiftEarnLedger({
          client,
          sourceKey,
          senderUserId: senderId,
          giftCost: tipCoins,
          senderBalanceAfter: newSenderBalance,
          hostUserId: eligible && hostCoinsEarned > 0 ? creatorId : null,
          hostCoins: hostCoinsEarned,
          hostBalanceAfter: newHostEarnings,
          tlUserId: tlId && tlCoinsEarned > 0 ? String(tlId) : null,
          tlCoins: tlCoinsEarned,
          tlBalanceAfter: newTlEarnings ?? 0,
          kind: 'moment_tip',
          metadata: {
            postId,
            tipCoins,
            senderId,
            hostSharePercent: split.hostSharePercent,
            tlSharePercent: split.tlSharePercent,
            platformCoins: split.platformCoins,
          },
        });
        if (!ledgerResult.success) {
          console.warn('[feed/tip] wallet_ledger:', ledgerResult.error);
        }
        if (eligible && hostCoinsEarned > 0) {
          recordCreatorEarnCoins?.(creatorId, { giftCoins: hostCoinsEarned });
        }
      }

      try {
        broadcastUsers?.();
      } catch {
        /* optional */
      }

      return res.json({
        success: true,
        data: {
          postId,
          creatorId,
          tipCoins,
          senderBalance: Number(senderAfter?.coin_balance ?? newSenderBalance),
          hostEarnings: hostCoinsEarned > 0 ? newHostEarnings : Number(creator.earnings_coins || 0),
          hostCoinsEarned,
          tlCoinsEarned,
          tlId: tlId || undefined,
          tlEarnings: newTlEarnings ?? undefined,
        },
      });
    } catch (err: any) {
      console.error('[feed/tip] exception:', err);
      return sendError(res, 500, err?.message || 'Failed to tip', 'TIP_FAILED');
    }
  });

  return router;
}
