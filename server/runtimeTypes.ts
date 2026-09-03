import type { WebSocket } from 'ws';
import type { UserProfile } from '../src/types';

export interface ConnectedSocket {
  id: string;
  userId: string;
  ws: WebSocket;
}

export interface CallState {
  id: string;
  callerId: string;
  receiverId: string;
  status: 'ringing' | 'active' | 'ended';
  startTime?: number;
  ringingAt?: number;
  coinsSpent?: number;
  coinsEarned?: number;
  durationSeconds?: number;
  billedMinutes?: number;
}

export interface LiveKitRuntimeConfig {
  apiKey: string;
  apiSecret: string;
  wsUrl: string;
}

export interface InfraRuntimeConfig {
  [key: string]: any;
}

/**
 * Shared in-memory runtime passed into modular route factories.
 * Keeps WebSocket/presence/user state in one place without duplicating Maps.
 */
export interface ServerRuntime {
  presenceMap: Map<string, 'online' | 'busy' | 'offline'>;
  userLastSeen: Map<string, number>;
  connectedSockets: ConnectedSocket[];
  activeCalls: Map<string, CallState>;
  serverUsers: Map<string, UserProfile>;
  creatorMetricsMap: Map<string, any>;
  livekitConfig: LiveKitRuntimeConfig;
  infraConfig: InfraRuntimeConfig;

  normalizeUserProfile: (p: any) => UserProfile;
  getAuthoritativeStatus: (userId: string) => 'online' | 'busy' | 'offline';
  getFormattedPresence: () => Record<string, 'online' | 'busy' | 'offline'>;
  getFormattedUsers: () => UserProfile[];
  getFormattedActiveCalls: () => any[];
  getFormattedCreatorMetrics: () => any;

  broadcastAll: (payload: any) => void;
  broadcastPresence: () => void;
  broadcastUsers: () => void;
  broadcastActiveCalls: () => void;
  broadcastCreatorMetrics: () => void;
  sendToUser?: (userId: string, payload: any) => void;
}
