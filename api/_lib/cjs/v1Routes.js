/**
 * /api/v1/* social routes — CommonJS port of api/_lib/handlers/v1.ts
 */
const { send, readJsonBody, requireAuth } = require('./helpers');

function v1Path(fullPath, req) {
  if (String(fullPath || '').startsWith('v1/')) {
    return String(fullPath).slice(3);
  }
  if (fullPath === 'v1') return '';
  try {
    return new URL(req.url || '', 'http://localhost').pathname.replace(/^\/api\/v1\/?/, '');
  } catch {
    return '';
  }
}

async function handleV1(fullPath, req, res) {
  if (!String(fullPath || '').startsWith('v1')) return null;

  const auth = await requireAuth(req);
  if (auth.ok === false) return send(res, auth.status, { success: false, error: auth.error });
  const client = auth.client;
  const path = v1Path(fullPath, req);
  const method = req.method || 'GET';
  const me = auth.profileId;
  const body = method !== 'GET' ? await readJsonBody(req) : {};

  try {
    if (path === 'matches/me' && method === 'GET') {
      const { data, error } = await client
        .from('matches')
        .select('*')
        .or(`user_a_id.eq.${me},user_b_id.eq.${me}`)
        .limit(200);
      if (error) throw error;
      const matches = (data || []).map((row) => ({
        id: row.id,
        userAId: row.user_a_id,
        userBId: row.user_b_id,
        otherUserId: row.user_a_id === me ? row.user_b_id : row.user_a_id,
        status: row.status,
        initiatedBy: row.initiated_by,
        matchedAt: row.matched_at,
        createdAt: row.created_at,
      }));
      return send(res, 200, { success: true, matches });
    }

    if (path === 'matches/blocks' && method === 'GET') {
      const { data } = await client.from('blocked_users').select('*').eq('user_id', me);
      return send(res, 200, {
        success: true,
        blocks: (data || []).map((r) => ({ userId: r.user_id, blockedUserId: r.blocked_user_id })),
      });
    }

    if (path === 'matches/like' && method === 'POST') {
      const targetUserId = String((body && (body.targetUserId || body.userId)) || '');
      if (!targetUserId) {
        return send(res, 400, { success: false, error: { message: 'targetUserId required' } });
      }
      const { data: existing } = await client
        .from('matches')
        .select('*')
        .or(
          `and(user_a_id.eq.${me},user_b_id.eq.${targetUserId}),and(user_a_id.eq.${targetUserId},user_b_id.eq.${me})`
        )
        .limit(1);
      const row = existing && existing[0];
      if (row) {
        const mutual = row.status === 'pending' && row.initiated_by && row.initiated_by !== me;
        const status = mutual ? 'matched' : row.status === 'matched' ? 'matched' : 'pending';
        await client
          .from('matches')
          .update({
            status,
            matched_at: status === 'matched' ? new Date().toISOString() : row.matched_at,
            last_interaction_at: new Date().toISOString(),
          })
          .eq('id', row.id);
        return send(res, 200, {
          success: true,
          status,
          matchId: row.id,
          matched: status === 'matched',
        });
      }
      const { data: created, error } = await client
        .from('matches')
        .insert({
          user_a_id: me,
          user_b_id: targetUserId,
          status: 'pending',
          initiated_by: me,
          last_interaction_at: new Date().toISOString(),
        })
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return send(res, 200, {
        success: true,
        status: 'pending',
        matchId: created && created.id,
        matched: false,
      });
    }

    if (path === 'matches/pass' && method === 'POST') {
      const targetUserId = String((body && (body.targetUserId || body.userId)) || '');
      const { data: existing } = await client
        .from('matches')
        .select('id')
        .or(
          `and(user_a_id.eq.${me},user_b_id.eq.${targetUserId}),and(user_a_id.eq.${targetUserId},user_b_id.eq.${me})`
        )
        .limit(1);
      if (existing && existing[0]) {
        await client
          .from('matches')
          .update({ status: 'rejected', last_interaction_at: new Date().toISOString() })
          .eq('id', existing[0].id);
      } else {
        await client.from('matches').insert({
          user_a_id: me,
          user_b_id: targetUserId,
          status: 'rejected',
          initiated_by: me,
        });
      }
      return send(res, 200, { success: true });
    }

    if (path === 'matches/quick-match' && method === 'POST') {
      const targetUserId = String((body && (body.targetUserId || body.partnerId)) || '');
      if (!targetUserId) {
        return send(res, 400, { success: false, error: { message: 'targetUserId required' } });
      }
      const { data: existing } = await client
        .from('matches')
        .select('*')
        .or(
          `and(user_a_id.eq.${me},user_b_id.eq.${targetUserId}),and(user_a_id.eq.${targetUserId},user_b_id.eq.${me})`
        )
        .limit(1);
      if (existing && existing[0]) {
        await client
          .from('matches')
          .update({
            status: 'matched',
            matched_at: new Date().toISOString(),
            last_interaction_at: new Date().toISOString(),
          })
          .eq('id', existing[0].id);
        return send(res, 200, { success: true, matched: true, matchId: existing[0].id });
      }
      const { data: created, error } = await client
        .from('matches')
        .insert({
          user_a_id: me,
          user_b_id: targetUserId,
          status: 'matched',
          initiated_by: me,
          matched_at: new Date().toISOString(),
        })
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return send(res, 200, { success: true, matched: true, matchId: created && created.id });
    }

    if (path === 'favorites/me' && method === 'GET') {
      const { data } = await client.from('favorites').select('*').eq('user_id', me);
      return send(res, 200, {
        success: true,
        favorites: (data || []).map((r) => ({
          userId: r.user_id,
          favoriteUserId: r.favorite_user_id,
        })),
      });
    }
    if (path === 'favorites/toggle' && method === 'POST') {
      const targetUserId = String((body && (body.targetUserId || body.userId)) || '');
      const { data: existing } = await client
        .from('favorites')
        .select('id')
        .eq('user_id', me)
        .eq('favorite_user_id', targetUserId)
        .maybeSingle();
      if (existing && existing.id) {
        await client.from('favorites').delete().eq('id', existing.id);
        return send(res, 200, { success: true, favorited: false });
      }
      await client.from('favorites').insert({ user_id: me, favorite_user_id: targetUserId });
      return send(res, 200, { success: true, favorited: true });
    }

    if (path === 'friends/requests' && method === 'GET') {
      const { data } = await client
        .from('friend_requests')
        .select('*')
        .or(`sender_id.eq.${me},receiver_id.eq.${me}`)
        .limit(100);
      return send(res, 200, {
        success: true,
        requests: (data || []).map((r) => ({
          id: r.id,
          senderId: r.sender_id,
          receiverId: r.receiver_id,
          status: r.status,
          createdAt: r.created_at,
        })),
      });
    }
    if (path === 'friends/request' && method === 'POST') {
      const receiverId = String((body && (body.receiverId || body.userId)) || '');
      const { data, error } = await client
        .from('friend_requests')
        .insert({ sender_id: me, receiver_id: receiverId, status: 'pending' })
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return send(res, 200, {
        success: true,
        request: {
          id: data.id,
          senderId: data.sender_id,
          receiverId: data.receiver_id,
          status: data.status,
        },
      });
    }
    if (
      (path === 'friends/accept' || path === 'friends/decline' || path === 'friends/remove') &&
      method === 'POST'
    ) {
      const requestId = String((body && (body.requestId || body.id)) || '');
      const status =
        path === 'friends/accept' ? 'accepted' : path === 'friends/decline' ? 'declined' : 'removed';
      if (requestId) {
        await client.from('friend_requests').update({ status }).eq('id', requestId);
      } else if (body && body.userId) {
        await client
          .from('friend_requests')
          .update({ status })
          .or(
            `and(sender_id.eq.${me},receiver_id.eq.${body.userId}),and(sender_id.eq.${body.userId},receiver_id.eq.${me})`
          );
      }
      return send(res, 200, { success: true, status });
    }

    if (path === 'blocks' && method === 'POST') {
      const blockedUserId = String((body && (body.blockedUserId || body.userId)) || '');
      await client
        .from('blocked_users')
        .upsert({ user_id: me, blocked_user_id: blockedUserId }, { onConflict: 'user_id,blocked_user_id' });
      return send(res, 200, { success: true });
    }
    if (path.startsWith('blocks/') && method === 'DELETE') {
      const blockedUserId = decodeURIComponent(path.replace('blocks/', ''));
      await client.from('blocked_users').delete().eq('user_id', me).eq('blocked_user_id', blockedUserId);
      return send(res, 200, { success: true });
    }

    if ((path === 'feed' || path.startsWith('feed?')) && method === 'GET') {
      const { data, error } = await client
        .from('feed_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return send(res, 200, { success: true, posts: data || [] });
    }
    if (path === 'feed' && method === 'POST') {
      const { data, error } = await client
        .from('feed_posts')
        .insert({
          author_id: me,
          caption: (body && (body.caption || body.text)) || '',
          media_url: body && (body.mediaUrl || body.media_url),
          media_type: (body && body.mediaType) || 'image',
        })
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return send(res, 200, { success: true, post: data });
    }
    if (/^feed\/[^/]+\/like$/.test(path) && method === 'POST') {
      return send(res, 200, { success: true, liked: true });
    }
    if (/^feed\/[^/]+\/tip$/.test(path) && method === 'POST') {
      return send(res, 200, { success: true, tipped: true });
    }
    if (path.startsWith('feed/user/') && method === 'GET') {
      const userId = decodeURIComponent(path.replace('feed/user/', '').split('?')[0]);
      const { data } = await client
        .from('feed_posts')
        .select('*')
        .eq('author_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      return send(res, 200, { success: true, posts: data || [] });
    }

    if (path.startsWith('reviews') && method === 'GET') {
      return send(res, 200, { success: true, reviews: [] });
    }
    if (path === 'reviews' && method === 'POST') {
      return send(res, 200, { success: true });
    }
    if (path === 'reviews/request' && method === 'POST') {
      return send(res, 200, { success: true });
    }
    if (path === 'reports' && method === 'POST') {
      const { error } = await client.from('moderation_reports').insert({
        reporter_id: me,
        reported_user_id: (body && (body.reportedUserId || body.userId)) || null,
        reason: (body && body.reason) || 'other',
        details: (body && (body.details || body.message)) || '',
      });
      if (error) throw error;
      return send(res, 200, { success: true });
    }

    return send(res, 501, {
      success: false,
      error: { message: `Unimplemented v1 path: ${path}`, code: 'VERCEL_ROUTE_NOT_IMPLEMENTED' },
    });
  } catch (err) {
    console.error('[api/v1]', path, err);
    return send(res, 500, {
      success: false,
      error: { message: (err && err.message) || 'Server error' },
    });
  }
}

module.exports = { handleV1 };
