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

    // Route directed events to recipient user channel
    const targetId =
      payload.receiverId ||
      payload.toUserId ||
      payload.targetUserId ||
      payload.userId ||
      payload.calleeId;

    try {
      if (
        targetId &&
        (type.startsWith('call:') ||
          type.startsWith('friend_request:') ||
          type === 'chat:incall_preview' ||
          type.startsWith('quick_match:') ||
          type === 'match:created')
      ) {
        const targetChannel = supabase.channel(`user:${targetId}`);
        await targetChannel.subscribe();
        await targetChannel.send({
          type: 'broadcast',
          event: 'signal',
          payload,
        });
        await supabase.removeChannel(targetChannel);
        return true;
      }

      if (type === 'presence:update' || type === 'heartbeat' || type === 'user:update') {
        await this.presenceChannel?.track({
          userId: this.profileId,
          online_at: new Date().toISOString(),
          status: payload.status || 'online',
          ...(payload.user ? { user: payload.user } : {}),
        });
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
    if (this.userChannel) {
      supabase.removeChannel(this.userChannel);
      this.userChannel = null;
    }
    if (this.presenceChannel) {
      supabase.removeChannel(this.presenceChannel);
      this.presenceChannel = null;
    }
    this.connected = false;
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
