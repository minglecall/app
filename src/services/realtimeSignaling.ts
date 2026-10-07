/**
 * Supabase Realtime signaling — replaces Express WebSocket /ws on Vercel.
 * Channel naming:
 *  - presence: global "app-presence"
 *  - per-user inbox: "user:{profileId}"
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type SignalHandler = (payload: any) => void;

function waitForSubscribe(
  channel: RealtimeChannel,
  timeoutMs = 8000
): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ok);
    };
    const timer = setTimeout(() => done(false), timeoutMs);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') done(true);
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        done(false);
      }
    });
  });
}

export class RealtimeSignaling {
  private userChannel: RealtimeChannel | null = null;
  private presenceChannel: RealtimeChannel | null = null;
  private profileId: string | null = null;
  private handler: SignalHandler | null = null;
  private connected = false;

  isConnected() {
    return this.connected;
  }

  async connect(profileId: string, accessToken: string, onMessage: SignalHandler): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;
    this.handler = onMessage;
    this.profileId = profileId;

    try {
      await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: (await supabase.auth.getSession()).data.session?.refresh_token || accessToken,
      }).catch(() => {});
    } catch {
      // token may already be on client session
    }

    this.disconnect();

    this.userChannel = supabase.channel(`user:${profileId}`, {
      config: { broadcast: { self: false } },
    });
    this.userChannel.on('broadcast', { event: 'signal' }, ({ payload }) => {
      if (payload && this.handler) this.handler(payload);
    });

    this.presenceChannel = supabase.channel('app-presence', {
      config: { presence: { key: profileId } },
    });
    this.presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = this.presenceChannel?.presenceState() || {};
        if (this.handler) {
          this.handler({ type: 'presence:sync', state });
        }
      })
      .on('broadcast', { event: 'signal' }, ({ payload }) => {
        if (payload && this.handler) this.handler(payload);
      });

    const [userOk, presenceOk] = await Promise.all([
      waitForSubscribe(this.userChannel),
      waitForSubscribe(this.presenceChannel),
    ]);

    if (presenceOk && this.presenceChannel) {
      try {
        await this.presenceChannel.track({
          userId: profileId,
          online_at: new Date().toISOString(),
          status: 'online',
        });
      } catch (e) {
        console.warn('[RealtimeSignaling] presence track failed', e);
      }
    }

    this.connected = Boolean(userOk && presenceOk);

    // Confirm auth only after channels are actually subscribed
    if (this.connected && this.handler) {
      this.handler({ type: 'auth:ok', userId: profileId });
    }
    return this.connected;
  }

  async send(payload: Record<string, any>): Promise<boolean> {
    if (!this.connected || !this.userChannel) return false;
    const type = String(payload.type || '');

    // Route directed events to recipient user channel (prefer explicit toUserId)
    const targetId =
      payload.toUserId ||
      payload.targetUserId ||
      payload.calleeId ||
      (type === 'call:accept' ||
      type === 'call:accepted' ||
      type === 'call:reject' ||
      type === 'call:cancel' ||
      type === 'call:end' ||
      type === 'call:ended'
        ? payload.callerId
        : null) ||
      (type === 'call:initiate' || type === 'call:incoming' || type === 'call:ringing'
        ? payload.receiverId
        : null) ||
      payload.receiverId ||
      payload.userId;

    try {
      if (
        targetId &&
        (type.startsWith('call:') ||
          type.startsWith('friend_request:') ||
          type === 'chat:message' ||
          type === 'chat:incall_preview' ||
          type.startsWith('quick_match:') ||
          type === 'match:created')
      ) {
        // Must use the same topic the peer subscribed to in connect(): user:{profileId}
        const targetChannel = supabase.channel(`user:${targetId}`, {
          config: { broadcast: { self: false } },
        });
        // CRITICAL: wait until SUBSCRIBED before broadcast — otherwise initiate/accept are dropped
        const ok = await waitForSubscribe(targetChannel, 5000);
        if (!ok) {
          console.warn('[RealtimeSignaling] target channel subscribe failed', targetId, type);
          try {
            await supabase.removeChannel(targetChannel);
          } catch {
            /* ignore */
          }
          return false;
        }
        await targetChannel.send({
          type: 'broadcast',
          event: 'signal',
          payload,
        });
        await supabase.removeChannel(targetChannel);
        // Presence fanout backup — peer filters by callId / callerId / receiverId
        try {
          await this.presenceChannel?.send({
            type: 'broadcast',
            event: 'signal',
            payload,
          });
        } catch {
          /* best-effort */
        }
        return true;
      }

      if (type === 'presence:update' || type === 'heartbeat' || type === 'user:update') {
        const nextStatus = String(payload.status || 'online').toLowerCase();
        if (nextStatus === 'offline') {
          try {
            await this.presenceChannel?.untrack();
          } catch {
            /* ignore */
          }
        } else {
          await this.presenceChannel?.track({
            userId: this.profileId,
            online_at: new Date().toISOString(),
            status: nextStatus === 'busy' || nextStatus === 'in_call' ? 'busy' : 'online',
            ...(payload.user ? { user: payload.user } : {}),
          });
        }
        await this.presenceChannel?.send({
          type: 'broadcast',
          event: 'signal',
          payload,
        });
        return true;
      }

      await this.userChannel.send({
        type: 'broadcast',
        event: 'signal',
        payload,
      });
      return true;
    } catch (e) {
      console.warn('[RealtimeSignaling] send failed', e);
      return false;
    }
  }

  disconnect() {
    const presence = this.presenceChannel;
    const user = this.userChannel;
    this.presenceChannel = null;
    this.userChannel = null;
    this.connected = false;
    void (async () => {
      try {
        if (presence) await presence.untrack();
      } catch {
        /* ignore */
      }
      try {
        if (presence) await supabase.removeChannel(presence);
      } catch {
        /* ignore */
      }
      try {
        if (user) await supabase.removeChannel(user);
      } catch {
        /* ignore */
      }
    })();
  }
}

export function shouldUseRealtimeSignaling(): boolean {
  if (!isSupabaseConfigured()) return false;
  const flag = String(import.meta.env.VITE_USE_REALTIME || '')
    .trim()
    .toLowerCase();
  if (flag === 'true' || flag === '1') return true;
  if (flag === 'false' || flag === '0') return false;
  // Explicit Express WS host → keep native WebSocket
  if (String(import.meta.env.VITE_WS_URL || '').trim()) return false;
  // Production same-origin (Vercel) — no persistent /ws
  if (import.meta.env.PROD) return true;
  // Local Vite + Express keeps /ws
  return false;
}
