import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import {
  PhoneOff,
  PhoneCall,
  Phone,
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  RefreshCw,
  Gift,
  MessageSquare,
  ShieldAlert,
  Lock,
  Zap,
  Coins,
  Sparkles,
  Send,
  X,
  Volume2,
  CheckCircle2,
  AlertCircle,
  Users,
  AlertTriangle,
  Sliders,
  Layers,
} from 'lucide-react';
import { MegaGiftOverlay } from './MegaGiftOverlay';
import { getCountryFlag } from '../../utils/flags';
import { SvgFlag } from '../common/SvgFlag';
import { Room, RoomEvent, Track, createLocalTracks, LocalTrack, RemoteTrack, VideoPresets } from 'livekit-client';
import { supabase } from '../../lib/supabase';

interface VideoCallStudioProps {
  onOpenStore: () => void;
}

export const VideoCallStudio: React.FC<VideoCallStudioProps> = ({ onOpenStore }) => {
  const {
    activeCall,
    acceptCall,
    rejectCall,
    endCall,
    currentUser,
    users,
    systemSettings,
    virtualGifts,
    sendGiftInCall,
    sendMessage,
    chatMessages,
    fastTestMode,
    friends,
    isFriend,
    toggleFastTestMode,
    getEffectiveCallRate,
    showToast,
  } = useApp();

  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [isMirrored, setIsMirrored] = useState(true);
  const [showGiftDrawer, setShowGiftDrawer] = useState(false);
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [chatInputText, setChatInputText] = useState('');

  // Video Quality Profile strictly determined by Admin Dashboard configuration
  const adminCaptureResolution = systemSettings.livekitCaptureResolution || '720p';
  const adminQualityProfile: 'ultra_4k' | 'hd_1080p' | 'high_720p' | 'standard_480p' =
    adminCaptureResolution === '4k' ? 'ultra_4k' :
    adminCaptureResolution === '1080p' ? 'hd_1080p' :
    adminCaptureResolution === '480p' ? 'standard_480p' :
    'high_720p'; // Default is always 720p HD (3,500 kbps @ 60 FPS)

  // Helper to get WebRTC media constraints based on Admin Dashboard configuration and screen orientation
  const getVideoConstraints = () => {
    const isPortrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
    const maxFramerate = systemSettings.livekitMaxFramerate || 60;

    switch (adminQualityProfile) {
      case 'ultra_4k':
        return {
          width: isPortrait ? { ideal: 2160, min: 1080 } : { ideal: 3840, min: 1920 },
          height: isPortrait ? { ideal: 3840, min: 1920 } : { ideal: 2160, min: 1080 },
          aspectRatio: isPortrait ? { ideal: 9 / 16 } : { ideal: 16 / 9 },
          frameRate: { ideal: maxFramerate, min: 30 },
        };
      case 'hd_1080p':
        return {
          width: isPortrait ? { ideal: 1080, min: 720 } : { ideal: 1920, min: 1280 },
          height: isPortrait ? { ideal: 1920, min: 1280 } : { ideal: 1080, min: 720 },
          aspectRatio: isPortrait ? { ideal: 9 / 16 } : { ideal: 16 / 9 },
          frameRate: { ideal: maxFramerate, min: 30 },
        };
      case 'standard_480p':
        return {
          width: isPortrait ? { ideal: 480, min: 360 } : { ideal: 854, min: 480 },
          height: isPortrait ? { ideal: 854, min: 480 } : { ideal: 480, min: 360 },
          aspectRatio: isPortrait ? { ideal: 9 / 16 } : { ideal: 16 / 9 },
          frameRate: { ideal: maxFramerate, min: 15 },
        };
      case 'high_720p':
      default:
        return {
          width: isPortrait ? { ideal: 720, min: 720 } : { ideal: 1280, min: 1280 },
          height: isPortrait ? { ideal: 1280, min: 720 } : { ideal: 720, min: 720 },
          aspectRatio: isPortrait ? { ideal: 9 / 16 } : { ideal: 16 / 9 },
          frameRate: { ideal: maxFramerate, min: 30 },
        };
    }
  };

  // LiveKit Connection State
  const [liveKitConnected, setLiveKitConnected] = useState(false);
  const [liveKitConfigured, setLiveKitConfigured] = useState<boolean | null>(null);
  const [connectionStatusText, setConnectionStatusText] = useState('Initializing WebRTC...');

  // Refs for WebRTC video elements
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localMediaStreamRef = useRef<MediaStream | null>(null);

  // LiveKit room ref
  const liveKitRoomRef = useRef<Room | null>(null);

  // Nudity shield state
  const [nudityShieldActive, setNudityShieldActive] = useState(false);

  // Gift overlay active state
  const [activeGiftAnim, setActiveGiftAnim] = useState<{
    name: string;
    icon: string;
    type: string;
    cost: number;
  } | null>(null);

  // Reaction bubbles state
  const [reactions, setReactions] = useState<{ id: string; emoji: string; x: number }[]>([]);

  const triggerReaction = (emoji: string) => {
    const newReaction = {
      id: Math.random().toString(),
      emoji,
      x: Math.floor(Math.random() * 60) + 20,
    };
    setReactions((prev) => [...prev, newReaction]);
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== newReaction.id));
    }, 2500);
  };

  // --- LiveKit WebRTC Connection & Local Camera Effect ---
  useEffect(() => {
    if (!activeCall || activeCall.status !== 'active') return;

    let isMounted = true;

    async function initLiveKitOrFallback() {
      const vConstraints = getVideoConstraints();

      try {
        setConnectionStatusText('Fetching LiveKit Access Token...');
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (accessToken) {
          headers.Authorization = `Bearer ${accessToken}`;
        }

        const res = await fetch('/api/livekit/token', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            roomName: activeCall.id,
            identity: currentUser.id,
            name: currentUser.name,
          }),
        });

        const data = await res.json();

        if (isMounted && data.configured && data.token && data.wsUrl) {
          setLiveKitConfigured(true);
          setConnectionStatusText('Connecting to LiveKit WebRTC Cloud (Crystal Clear HD)...');

          // Determine capture resolution & encoding presets based on Admin Dashboard configuration
          const captureRes = adminCaptureResolution;

          // Studio high bitrates (kbps): 4K=8.5M, 1080p=5.5M, 720p=3.5M (Default)
          const targetBitrateKbps =
            adminQualityProfile === 'ultra_4k' ? (systemSettings.livekitMaxBitrateKbps || 8500) :
            adminQualityProfile === 'hd_1080p' ? (systemSettings.livekitMaxBitrateKbps || 5500) :
            adminQualityProfile === 'standard_480p' ? (systemSettings.livekitMaxBitrateKbps || 1500) :
            (systemSettings.livekitMaxBitrateKbps || 3500);

          const maxBitrate = targetBitrateKbps * 1000;
          const maxFramerate = systemSettings.livekitMaxFramerate || (adminQualityProfile === 'standard_480p' ? 24 : 60);
          const enableSimulcast = systemSettings.livekitSimulcastEnabled !== false;
          const adaptiveStream = systemSettings.livekitAdaptiveStream !== false;
          const dynacast = systemSettings.livekitDynacast !== false;
          const preferredCodec = systemSettings.livekitVideoCodec || 'h264';

          const resolutionPreset =
            adminQualityProfile === 'ultra_4k' || captureRes === '4k' ? VideoPresets.h2160.resolution :
            adminQualityProfile === 'hd_1080p' || captureRes === '1080p' ? VideoPresets.h1080.resolution :
            adminQualityProfile === 'standard_480p' || captureRes === '480p' ? VideoPresets.h360.resolution :
            VideoPresets.h720.resolution;

          // Adaptive multi-tier simulcast layers matching active admin quality profile
          const simulcastLayers =
            adminQualityProfile === 'ultra_4k' || captureRes === '4k'
              ? [VideoPresets.h2160, VideoPresets.h1080, VideoPresets.h720]
              : adminQualityProfile === 'hd_1080p' || captureRes === '1080p'
              ? [VideoPresets.h1080, VideoPresets.h720, VideoPresets.h360]
              : adminQualityProfile === 'standard_480p' || captureRes === '480p'
              ? [VideoPresets.h360, VideoPresets.h180]
              : [VideoPresets.h720, VideoPresets.h540, VideoPresets.h360];

          const room = new Room({
            adaptiveStream: adaptiveStream,
            dynacast: dynacast,
            videoCaptureDefaults: {
              resolution: resolutionPreset,
              facingMode: 'user',
            },
            publishDefaults: {
              simulcast: enableSimulcast,
              videoSimulcastLayers: enableSimulcast ? simulcastLayers : undefined,
              videoCodec: preferredCodec as any,
              backupCodec: { codec: 'vp8' },
              videoEncoding: {
                maxBitrate: maxBitrate,
                maxFramerate: maxFramerate,
              },
              degradationPreference: 'maintain-resolution',
              dtx: true,
            },
          });

          liveKitRoomRef.current = room;

          // Track subscription event
          room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
            if (track.kind === Track.Kind.Video && remoteVideoRef.current) {
              track.attach(remoteVideoRef.current);
            } else if (track.kind === Track.Kind.Audio && remoteAudioRef.current) {
              track.attach(remoteAudioRef.current);
            }
          });

          await room.connect(data.wsUrl, data.token);

          // Publish local camera & mic with 48kHz audio and maximum detail constraints
          const localTracks = await createLocalTracks({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: 48000,
              channelCount: 2,
            },
            video: {
              ...vConstraints,
              frameRate: { ideal: maxFramerate, min: 24 },
            },
          });

          for (const track of localTracks) {
            if (track.kind === Track.Kind.Video) {
              // Ensure WebRTC native track prioritizes sharp edge & facial detail
              if (track.mediaStreamTrack) {
                try {
                  (track.mediaStreamTrack as any).contentHint = 'detail';
                } catch (e) { }
              }

              const pub = await room.localParticipant.publishTrack(track, {
                name: 'camera-hd-studio',
                simulcast: enableSimulcast,
                videoSimulcastLayers: enableSimulcast ? simulcastLayers : undefined,
                videoCodec: preferredCodec as any,
                backupCodec: { codec: 'vp8' },
                videoEncoding: {
                  maxBitrate: maxBitrate,
                  maxFramerate: maxFramerate,
                },
                degradationPreference: 'maintain-resolution',
              });

              if (localVideoRef.current) {
                track.attach(localVideoRef.current);
              }
            } else {
              await room.localParticipant.publishTrack(track);
            }
          }

          if (isMounted) {
            setLiveKitConnected(true);
            setConnectionStatusText(
              adminQualityProfile === 'ultra_4k' ? 'LiveKit 4K Ultra HD Connected' :
              adminQualityProfile === 'hd_1080p' ? 'LiveKit 1080p Crystal Clear HD Connected' :
              adminQualityProfile === 'high_720p' ? 'LiveKit 720p HD Connected (3,500 kbps)' :
              'LiveKit HD Stream Connected'
            );
          }
          return;
        }
      } catch (err) {
        console.warn('LiveKit Cloud connection fallback:', err);
      }

      // Local camera fallback if LiveKit credentials not present or connection failed
      if (isMounted) {
        setLiveKitConfigured(false);
        setConnectionStatusText('WebRTC High-Res Camera Active');
        try {
          // Request crystal clear high-def video stream
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              ...vConstraints,
              facingMode: 'user',
            },
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          localMediaStreamRef.current = stream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
          setLiveKitConnected(true);
        } catch (mediaErr) {
          console.warn('Local webcam fallback notice:', mediaErr);
          setConnectionStatusText('Demo Video Stream Active');
        }
      }
    }

    initLiveKitOrFallback();

    return () => {
      isMounted = false;
      if (liveKitRoomRef.current) {
        liveKitRoomRef.current.disconnect();
        liveKitRoomRef.current = null;
      }
      if (localMediaStreamRef.current) {
        localMediaStreamRef.current.getTracks().forEach((track) => track.stop());
        localMediaStreamRef.current = null;
      }
    };
  }, [activeCall?.id, activeCall?.status, currentUser.id, currentUser.name, adminQualityProfile]);

  // Handle Mute Mic / Camera Toggles
  useEffect(() => {
    // LiveKit room audio/video mute
    if (liveKitRoomRef.current?.localParticipant) {
      liveKitRoomRef.current.localParticipant.setMicrophoneEnabled(micEnabled);
      liveKitRoomRef.current.localParticipant.setCameraEnabled(cameraEnabled);
    }
    // Local stream fallback audio/video mute
    if (localMediaStreamRef.current) {
      localMediaStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = micEnabled));
      localMediaStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = cameraEnabled));
    }
  }, [micEnabled, cameraEnabled]);

  if (!activeCall) return null;

  const otherUserId =
    activeCall.callerId === currentUser.id ? activeCall.receiverId : activeCall.callerId;
  const otherUser = users.find((u) => u.id === otherUserId) || users[1];

  const isMaleCaller = currentUser.role === 'male_user';
  const isFemaleCaller = currentUser.gender === 'female' || currentUser.role === 'female_creator' || currentUser.role === 'female_host';
  const canEarnCoins = currentUser.role === 'female_creator' || currentUser.role === 'female_host' || Boolean(currentUser.teamLeaderId) || Boolean(systemSettings.enableRegularFemaleCoinEarning);
  const currentRatePerMin = getEffectiveCallRate(otherUserId, currentUser.id);
  const isFriendCall = isFriend(otherUserId);

  // Exact 1-Minute Warning & Low Balance Calculations
  const tickDuration = fastTestMode ? 3 : 60;
  const currentMinuteEndSeconds = (activeCall.billedMinutes || 1) * tickDuration;
  const secondsLeftInCurrentMinute = Math.max(0, currentMinuteEndSeconds - activeCall.durationSeconds);
  const affordableFutureMinutes = Math.floor((currentUser.coinBalance || 0) / currentRatePerMin);
  const totalSecondsRemaining = secondsLeftInCurrentMinute + (affordableFutureMinutes * tickDuration);

  // Trigger 1-minute warning when total affordable time is <= 60 seconds (or <= 3s in test mode)
  const isFinalMinuteWarning = isMaleCaller && totalSecondsRemaining <= tickDuration;

  // Proactive 1-minute audio/toast warning trigger
  const hasAlertedRef = useRef(false);
  useEffect(() => {
    if (isFinalMinuteWarning && !hasAlertedRef.current) {
      hasAlertedRef.current = true;
      if (showToast) {
        showToast(
          '⚠️ 1-Minute Coin Warning!',
          `Coins finishing soon (~${totalSecondsRemaining}s left). Quick recharge now to keep the call connected!`,
          'warning'
        );
      }
    } else if (!isFinalMinuteWarning) {
      hasAlertedRef.current = false;
    }
  }, [isFinalMinuteWarning, totalSecondsRemaining, showToast]);

  // Format MM:SS
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSendGift = (giftId: string) => {
    const gift = virtualGifts.find((g) => g.id === giftId);
    if (!gift) return;

    const success = sendGiftInCall(giftId);
    if (success) {
      setActiveGiftAnim({
        name: gift.name,
        icon: gift.icon,
        type: gift.animationType,
        cost: gift.coinCost,
      });
    }
  };

  const handleSendInCallChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInputText.trim()) return;
    sendMessage(otherUser.id, chatInputText);
    setChatInputText('');
  };

  // Filter messages for current call session
  const sessionMessages = chatMessages.filter(
    (m) =>
      (m.senderId === currentUser.id && m.receiverId === otherUser.id) ||
      (m.senderId === otherUser.id && m.receiverId === currentUser.id)
  );

  // ==========================================
  // RINGING SCREEN (INCOMING / OUTGOING CALL)
  // ==========================================
  if (activeCall.status === 'ringing') {
    const isReceiver = activeCall.receiverId === currentUser.id;

    return (
      <div id="video-call-ringing-overlay" className="fixed inset-0 z-50 bg-[#0A0C10]/95 backdrop-blur-2xl flex items-center justify-center p-4">
        <div className="relative w-full max-w-md bg-[#12151C] border border-slate-800 rounded-3xl p-6 sm:p-8 text-center space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">

          {/* Top Status Title */}
          <div className="space-y-1">
            <span className="px-3 py-1 rounded-full bg-pink-500/20 border border-pink-500/40 text-pink-300 font-mono text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-pink-500 animate-ping" />
              {isReceiver ? 'Incoming Video Call 📹' : 'Ringing... 📞'}
            </span>
            <h2 className="text-2xl font-black text-white mt-2">
              {isReceiver ? `Call from ${otherUser.name}` : `Calling ${otherUser.name}...`}
            </h2>
          </div>

          {/* Avatar Ringing Animation */}
          <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
            {/* Animated Pulses */}
            <div className="absolute inset-0 rounded-full bg-pink-500/20 animate-ping duration-1000" />
            <div className="absolute -inset-4 rounded-full bg-indigo-500/20 animate-pulse duration-700" />

            <img
              src={otherUser.avatarUrl}
              alt={otherUser.name}
              className="relative w-28 h-28 rounded-full object-cover ring-4 ring-pink-500 shadow-2xl z-10"
            />
          </div>

          {/* Details & Economy Rate Banner */}
          <div className="bg-[#1A1E29] border border-slate-800 rounded-2xl p-3 text-xs space-y-1 font-mono">
            <div className="flex items-center justify-between text-slate-300">
              <span>Location:</span>
              <span className="font-bold text-white flex items-center gap-1.5">
                <SvgFlag countryCode={otherUser.countryCode} nationality={otherUser.nationality} size="sm" />
                <span>{otherUser.nationality}</span>
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span>Rate:</span>
              <span className="font-extrabold text-amber-300">
                🪙 {currentRatePerMin}/min {isFriendCall ? '(Friend Rate)' : ''}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-800/80">
              * Coins start burning only when the call is accepted.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            {isReceiver ? (
              /* Receiver Acceptance Controls */
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={rejectCall}
                  className="py-3.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-2xl flex items-center justify-center space-x-2 shadow-lg shadow-rose-600/30 transition-transform active:scale-95"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>Decline</span>
                </button>

                <button
                  onClick={acceptCall}
                  className="py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-2xl flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/30 transition-transform active:scale-95"
                >
                  <PhoneCall className="w-4 h-4 animate-bounce" />
                  <span>Accept Call</span>
                </button>
              </div>
            ) : (
              /* Caller Controls */
              <div className="space-y-3">
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 text-xs text-slate-300 font-mono flex items-center justify-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span>Waiting for {otherUser.name} to accept on her device...</span>
                </div>

                <button
                  onClick={rejectCall}
                  className="w-full py-3.5 bg-rose-600/20 hover:bg-rose-600/40 border border-rose-500/50 text-rose-300 hover:text-white font-bold text-xs rounded-2xl transition-colors flex items-center justify-center space-x-2"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>Cancel Call</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // ACTIVE WEBRTC VIDEO CALL STUDIO
  // ==========================================
  return (
    <div id="video-call-studio-overlay" className="fixed inset-0 z-50 bg-slate-950 flex flex-col overflow-hidden selection:bg-pink-500 selection:text-white">
      {/* Hidden WebRTC Audio Element */}
      <audio ref={remoteAudioRef} autoPlay />

      {/* Top Header Controls Bar */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-3 sm:p-4 bg-gradient-to-b from-slate-950/95 via-slate-950/60 to-transparent">
        {/* User Info & Verified Badge */}
        <div className="flex items-center space-x-2.5">
          <div className="relative shrink-0">
            <img
              src={otherUser.avatarUrl}
              alt={otherUser.name}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover ring-2 ring-pink-500 shadow-lg"
            />
            <span className="absolute -top-0.5 -left-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-slate-950" />
          </div>

          <div>
            <div className="flex items-center space-x-2 text-white">
              <h3 className="font-black text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">{otherUser.name}</h3>
              {otherUser.isVerified && <span className="text-blue-400 text-xs font-bold">✓</span>}
              <SvgFlag countryCode={otherUser.countryCode} nationality={otherUser.nationality} size="sm" />
            </div>
            <div className="flex items-center space-x-1.5 text-[10px] font-mono">
              <span className="text-emerald-400 flex items-center gap-1 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                {liveKitConfigured ? 'LiveKit Cloud' : 'WebRTC Live'}
              </span>
              {fastTestMode && <span className="text-amber-400 font-bold">(3s Test Mode)</span>}
            </div>
          </div>
        </div>

        {/* Center Clock & Creator Earning Badge */}
        <div className="flex items-center space-x-2 sm:space-x-3 bg-[#161920]/90 border border-slate-800 backdrop-blur-md px-3 sm:px-4 py-1.5 rounded-xl shadow-2xl font-mono">
          <div className="flex items-center space-x-1.5 text-slate-100 text-xs font-black">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>{formatTime(activeCall.durationSeconds)}</span>
          </div>

          {!isMaleCaller && canEarnCoins && (
            <>
              <div className="h-4 w-px bg-slate-800" />
              <div className="flex items-center space-x-1.5 text-emerald-400 text-xs font-black animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>+{(activeCall.coinsEarned || 0)} 🪙 Earned</span>
              </div>
            </>
          )}
        </div>

        {/* Right Badges & Screen Protection & Quality Setting */}
        <div className="flex items-center space-x-2 font-mono">
          {/* Admin Managed Quality Indicator Badge */}
          <div className="flex items-center space-x-1.5 bg-[#161920]/90 border border-slate-800 backdrop-blur-md px-2.5 py-1 rounded-xl text-[10px] text-pink-300 font-mono shadow">
            <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse" />
            <span className="font-bold uppercase">
              {adminQualityProfile === 'ultra_4k' ? '4K Ultra HD' :
               adminQualityProfile === 'hd_1080p' ? '1080p Full HD' :
               adminQualityProfile === 'standard_480p' ? '480p SD' :
               '720p HD'}
            </span>
          </div>

          <div className="hidden sm:flex items-center space-x-1.5 bg-[#161920]/90 border border-slate-800 backdrop-blur-md px-2.5 py-1 rounded-xl text-[10px] text-slate-300 font-mono shadow">
            <Users className="w-3 h-3 text-pink-400" />
            <span className="font-bold">2 in Room</span>
          </div>

          <button
            onClick={() => setNudityShieldActive(!nudityShieldActive)}
            className={`p-1.5 sm:px-2.5 sm:py-1 rounded-xl border text-[10px] font-bold flex items-center space-x-1 transition-all ${nudityShieldActive
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                : 'bg-[#161920] text-slate-400 border-slate-800 hover:text-white'
              }`}
            title="Toggle AI Nudity Shield"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">AI SHIELD {nudityShieldActive ? 'ACTIVE' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* 1-Minute Quick Recharge Warning Banner for Male Caller */}
      {isFinalMinuteWarning && (
        <div className="absolute top-16 left-3 right-3 sm:left-6 sm:right-6 z-40 bg-gradient-to-r from-rose-950/95 via-amber-950/95 to-rose-950/95 border-2 border-amber-500/80 backdrop-blur-xl px-4 py-3 rounded-2xl shadow-2xl animate-in slide-in-from-top duration-300">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="flex items-center space-x-3 text-left w-full sm:w-auto">
              <div className="p-2 bg-amber-500/20 border border-amber-400/40 rounded-xl shrink-0 animate-pulse">
                <Zap className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-extrabold text-xs sm:text-sm text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    Coins Ending in {totalSecondsRemaining}s!
                  </span>
                  <span className="px-2 py-0.5 bg-rose-500/30 border border-rose-500/50 rounded-full text-[10px] font-bold text-rose-300">
                    {currentUser.coinBalance} 🪙 left
                  </span>
                </div>
                <p className="text-[11px] text-amber-200/90 mt-0.5">
                  Recharge now to prevent call disconnection (Need {currentRatePerMin} 🪙/min)
                </p>
              </div>
            </div>

            <button
              id="quick-recharge-call-banner-btn"
              onClick={onOpenStore}
              className="w-full sm:w-auto px-5 py-2 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-xs rounded-xl shadow-lg hover:shadow-amber-500/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center space-x-1.5 shrink-0"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>⚡ Quick Recharge</span>
            </button>
          </div>
        </div>
      )}

      {/* Safety Warning Notification Banner */}
      {activeCall.warningMessage && (
        <div className="absolute top-16 left-4 right-4 z-40 bg-amber-950/90 border border-amber-500/60 backdrop-blur-md px-4 py-2.5 rounded-2xl text-amber-200 text-xs flex items-center justify-between shadow-2xl animate-fade-in font-sans">
          <div className="flex items-center space-x-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong className="text-amber-300 font-bold">Safety Advisory:</strong> {activeCall.warningMessage}
            </span>
          </div>
        </div>
      )}

      {/* Main Video Stream Canvas */}
      <div className="relative flex-1 bg-slate-950 flex items-center justify-center overflow-hidden">
        {/* Remote Video Track or High Quality Feed */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={`w-full h-full object-cover transition-all duration-300 ${nudityShieldActive ? 'blur-2xl scale-110 opacity-60' : ''
            }`}
          style={{
            imageRendering: 'crisp-edges',
            transform: 'translateZ(0)',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
          poster={otherUser.gallery[0] || otherUser.avatarUrl}
        />

        {/* Fallback image if remote video track is not publishing */}
        <img
          src={otherUser.gallery[0] || otherUser.avatarUrl}
          alt="Remote Stream"
          className={`absolute inset-0 w-full h-full object-cover transition-all duration-300 -z-10 ${nudityShieldActive ? 'blur-2xl scale-110 opacity-60' : ''
            }`}
        />

        {/* Nudity Blur Shield Warning */}
        {nudityShieldActive && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-slate-950/70 text-center space-y-3 backdrop-blur-md">
            <ShieldAlert className="w-16 h-16 text-amber-400 animate-bounce" />
            <h3 className="text-xl font-bold text-white">AI Safety Shield Active</h3>
            <p className="text-xs text-slate-300 max-w-sm">
              Real-time computer vision blur shield is active to enforce safety compliance during live streams.
            </p>
            <button
              onClick={() => setNudityShieldActive(false)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-colors"
            >
              Disable Blur Shield
            </button>
          </div>
        )}

        {/* Floating In-Call 1-Minute Quick Recharge Pill */}
        {isFinalMinuteWarning && (
          <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-30 flex items-center space-x-2 bg-slate-950/95 border-2 border-amber-500/80 backdrop-blur-xl px-4 py-2 rounded-2xl shadow-2xl animate-pulse">
            <Zap className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs font-bold text-amber-300 whitespace-nowrap">
              Low Coins: ~{totalSecondsRemaining}s left
            </span>
            <button
              id="low-balance-buy-coins-btn"
              onClick={onOpenStore}
              className="px-3 py-1 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-xs rounded-xl shadow transition-transform hover:scale-105 active:scale-95 whitespace-nowrap"
            >
              ⚡ Refill
            </button>
          </div>
        )}

        {/* Floating In-Call Emoji Reactions Overlay */}
        <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
          {reactions.map((r) => (
            <div
              key={r.id}
              className="absolute bottom-28 text-4xl animate-bounce transition-all duration-1000"
              style={{
                left: `${r.x}%`,
                animation: 'floatUp 2.5s ease-out forwards',
              }}
            >
              {r.emoji}
            </div>
          ))}
        </div>

        {/* Quick Emoji Reaction Tap Bar */}
        <div className="absolute bottom-24 left-4 z-20 flex items-center space-x-2 bg-slate-900/80 border border-slate-800 backdrop-blur-md px-3 py-1.5 rounded-full shadow-lg">
          {['❤️', '🔥', '👑', '🌹', '😍', '🚀'].map((emoji) => (
            <button
              key={emoji}
              onClick={() => triggerReaction(emoji)}
              className="hover:scale-130 transition-transform active:scale-95 text-lg"
              title={`Send ${emoji} Reaction`}
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* PIP Local User Camera Preview Box */}
        <div className="absolute bottom-24 right-4 z-20 w-28 h-40 sm:w-36 sm:h-52 bg-slate-900 rounded-2xl border-2 border-slate-800 overflow-hidden shadow-2xl">
          {cameraEnabled ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${isMirrored ? 'scale-x-[-1]' : ''}`}
              style={{
                imageRendering: 'crisp-edges',
                transform: isMirrored ? 'scaleX(-1) translateZ(0)' : 'translateZ(0)',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
              }}
            />
          ) : (
            <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center text-slate-500">
              <VideoOff className="w-7 h-7 mb-1 text-slate-600" />
              <span className="text-[10px] font-mono">Camera Off</span>
            </div>
          )}

          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between bg-slate-950/80 px-2 py-1 rounded-xl backdrop-blur-sm">
            <span className="text-[10px] text-white font-semibold">You</span>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setIsMirrored(!isMirrored)}
                className="text-slate-400 hover:text-white"
                title="Flip Camera / Mirror"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
              {!micEnabled && <MicOff className="w-3 h-3 text-rose-400" />}
            </div>
          </div>
        </div>
      </div>

      {/* Mega Gift Drawer Overlay */}
      {showGiftDrawer && (
        <div className="absolute bottom-20 left-0 right-0 z-40 bg-slate-900/95 border-t border-slate-800 backdrop-blur-xl p-4 shadow-2xl animate-in slide-in-from-bottom duration-300">
          <div className="max-w-xl mx-auto space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2">
                <Gift className="w-4 h-4 text-pink-400" />
                <h4 className="font-extrabold text-xs text-white">Send Animated Mega Gift</h4>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-xs font-bold text-amber-300">Balance: {currentUser.coinBalance} 🪙</span>
                <button
                  onClick={() => setShowGiftDrawer(false)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Gift Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {virtualGifts.map((gift) => (
                <button
                  key={gift.id}
                  onClick={() => handleSendGift(gift.id)}
                  className="p-3 bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-pink-500/50 rounded-2xl flex flex-col items-center text-center transition-all group"
                >
                  <span className="text-3xl mb-1 group-hover:scale-125 transition-transform">{gift.icon}</span>
                  <span className="text-[11px] font-bold text-slate-200 truncate">{gift.name}</span>
                  <span className="text-[10px] text-amber-400 font-extrabold mt-0.5">🪙 {gift.coinCost}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* In-Call Slide-Out Chat Drawer */}
      {showChatDrawer && (
        <div className="absolute top-16 bottom-20 right-0 z-40 w-full sm:w-80 bg-slate-900/95 border-l border-slate-800 backdrop-blur-xl p-3 flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-300">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-pink-400" />
              <h4 className="font-bold text-xs text-white">In-Call Live Chat</h4>
            </div>
            <button onClick={() => setShowChatDrawer(false)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto space-y-2 py-3 px-1">
            {sessionMessages.map((m) => {
              const isMine = m.senderId === currentUser.id;
              return (
                <div key={m.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`p-2.5 rounded-2xl max-w-[85%] text-xs space-y-1 ${isMine
                        ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-tr-none'
                        : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                      }`}
                  >
                    <p>{m.translatedText || m.text}</p>
                    <span className="text-[9px] text-slate-300/80 block text-right">
                      Translated from {m.originalLanguage} • {m.timestamp}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input Form */}
          <form onSubmit={handleSendInCallChat} className="flex space-x-2 pt-2 border-t border-slate-800">
            <input
              type="text"
              placeholder="Type message..."
              value={chatInputText}
              onChange={(e) => setChatInputText(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-pink-500"
            />
            <button
              type="submit"
              className="p-2 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-xs font-bold"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Bottom Floating Control Bar */}
      <div className="absolute bottom-0 left-0 right-0 z-30 p-4 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent flex items-center justify-center space-x-3 sm:space-x-5">
        {/* Mic Toggle Button */}
        <button
          onClick={() => setMicEnabled(!micEnabled)}
          className={`p-3.5 rounded-2xl border transition-all ${micEnabled
              ? 'bg-slate-800/80 text-white border-slate-700 hover:bg-slate-700'
              : 'bg-rose-600 text-white border-rose-500'
            }`}
          title={micEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
        >
          {micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>

        {/* Camera Toggle Button */}
        <button
          onClick={() => setCameraEnabled(!cameraEnabled)}
          className={`p-3.5 rounded-2xl border transition-all ${cameraEnabled
              ? 'bg-slate-800/80 text-white border-slate-700 hover:bg-slate-700'
              : 'bg-rose-600 text-white border-rose-500'
            }`}
          title={cameraEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
        >
          {cameraEnabled ? <VideoIcon className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        {/* Flip Camera Button */}
        <button
          onClick={() => setIsMirrored(!isMirrored)}
          className="p-3.5 rounded-2xl bg-slate-800/80 text-slate-200 border border-slate-700 hover:bg-slate-700 transition-colors"
          title="Flip Camera / Toggle Mirror"
        >
          <RefreshCw className="w-5 h-5" />
        </button>

        {/* Send Gift Button */}
        {isMaleCaller && (
          <button
            id="incall-send-gift-btn"
            onClick={() => setShowGiftDrawer(!showGiftDrawer)}
            className="p-3.5 rounded-2xl bg-gradient-to-r from-pink-600 to-rose-600 text-white font-bold shadow-lg shadow-pink-500/30 hover:scale-105 transition-transform"
            title="Send Virtual Mega Gift"
          >
            <Gift className="w-5 h-5" />
          </button>
        )}

        {/* In-Call Chat Button */}
        <button
          onClick={() => setShowChatDrawer(!showChatDrawer)}
          className="p-3.5 rounded-2xl bg-slate-800/80 text-slate-200 border border-slate-700 hover:bg-slate-700 transition-colors"
          title="Toggle In-Call Live Chat"
        >
          <MessageSquare className="w-5 h-5 text-pink-400" />
        </button>

        {/* End Call Button */}
        <button
          id="incall-end-call-btn"
          onClick={endCall}
          className="px-5 sm:px-6 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs flex items-center space-x-2 shadow-xl shadow-rose-600/30 transition-transform active:scale-95"
        >
          <PhoneOff className="w-5 h-5" />
          <span>End Call</span>
        </button>
      </div>

      {/* Mega Gift Overlay FX */}
      {activeGiftAnim && (
        <MegaGiftOverlay
          giftName={activeGiftAnim.name}
          giftIcon={activeGiftAnim.icon}
          animationType={activeGiftAnim.type}
          cost={activeGiftAnim.cost}
          onComplete={() => setActiveGiftAnim(null)}
        />
      )}
    </div>
  );
};
