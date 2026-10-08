import React, { useMemo } from 'react';
import { Flame, PhoneCall, ShieldCheck, Video } from 'lucide-react';
import { UserProfile, CreatorMetrics } from '../../types';
import { Badge, MediaCard } from '../ui';
import { SvgFlag } from '../common/SvgFlag';
import { getUserEffectiveLocation } from '../../utils/location';
import { normalizeMediaUrl } from '../../utils/r2Storage';
import { getFallbackAvatar } from '../../utils/avatars';
import { isCurrentlyPeakHour } from '../../utils/discoveryAlgorithm';
import {
  DiscoveryCardLayout,
  DiscoveryCardSlotId,
  DiscoveryCardWidgetConfig,
  DiscoveryCardWidgetId,
  groupWidgetsBySlot,
  parseDiscoveryCardLayout,
  splitSlotIntoLines,
  widgetBoxAlignClasses,
  widgetPaddingStyle,
} from '../../../shared/discoveryCardLayout';

export interface DiscoveryCardProps {
  user: UserProfile;
  layout?: DiscoveryCardLayout | null;
  onStartCall: (userId: string) => void;
  onOpenProfile: (user: UserProfile) => void;
  metrics?: CreatorMetrics | null;
  peakHoursStart?: string;
  peakHoursEnd?: string;
  className?: string;
  /** When true, call button does not fire (admin preview) */
  previewMode?: boolean;
}

const STATUS_BADGE_CLASS =
  'backdrop-blur-md shadow-md shadow-black/50 font-bold text-white border';

export const DiscoveryCard: React.FC<DiscoveryCardProps> = ({
  user,
  layout: layoutProp,
  onStartCall,
  onOpenProfile,
  metrics,
  peakHoursStart,
  peakHoursEnd,
  className,
  previewMode = false,
}) => {
  const layout = useMemo(() => parseDiscoveryCardLayout(layoutProp), [layoutProp]);
  const bySlot = useMemo(() => groupWidgetsBySlot(layout), [layout]);

  const isUserOnline = user.onlineStatus === 'online';
  const isUserBusy = user.onlineStatus === 'busy' || user.onlineStatus === 'in_call';
  const isReadyNow =
    Boolean(metrics?.isReadyNowActive) &&
    isUserOnline &&
    isCurrentlyPeakHour(peakHoursStart || '18:00', peakHoursEnd || '00:00');
  const countryName = getUserEffectiveLocation(user).country || user.nationality || '';

  const fallbackAvatar = getFallbackAvatar(user.name, user.gender, user.role);
  const avatarUrl = normalizeMediaUrl(user.avatarUrl);
  const galleryUrl = normalizeMediaUrl(user.gallery?.[0]);
  const primaryAvatar = (() => {
    if (layout.photoSource === 'avatar') return avatarUrl || fallbackAvatar;
    if (layout.photoSource === 'galleryFirst') return galleryUrl || avatarUrl || fallbackAvatar;
    return avatarUrl || galleryUrl || fallbackAvatar;
  })();

  const wrapPad = (w: DiscoveryCardWidgetConfig, node: React.ReactNode): React.ReactNode => {
    if (node == null) return null;
    const full = w.widthPercent >= 100;
    return (
      <span
        key={w.id}
        className={`inline-flex items-center max-w-full leading-none ${full ? 'w-full min-w-0' : 'shrink-0'}`}
        style={widgetPaddingStyle(w)}
      >
        {node}
      </span>
    );
  };

  const renderWidget = (w: DiscoveryCardWidgetConfig): React.ReactNode => {
    const id = w.id as DiscoveryCardWidgetId;
    switch (id) {
      case 'statusBadge': {
        let badge: React.ReactNode;
        if (isReadyNow) {
          badge = (
            <Badge
              tone="brand"
              className={`${STATUS_BADGE_CLASS} !bg-orange-500 !text-white !border-orange-200/70`}
              style={{ fontSize: layout.badgeFontPx }}
            >
              <Flame className="w-2.5 h-2.5" /> Ready
            </Badge>
          );
        } else if (isUserOnline) {
          badge = (
            <Badge
              tone="neutral"
              className={`${STATUS_BADGE_CLASS} !bg-emerald-500 !text-white !border-emerald-200/70`}
              style={{ fontSize: layout.badgeFontPx }}
            >
              {layout.statusBadgePing ? (
                <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-white shadow-sm" />
                </span>
              ) : null}
              Online
            </Badge>
          );
        } else if (isUserBusy) {
          badge = (
            <Badge
              tone="warning"
              className={`${STATUS_BADGE_CLASS} !bg-amber-500 !text-white !border-amber-200/70`}
              style={{ fontSize: layout.badgeFontPx }}
            >
              Busy
            </Badge>
          );
        } else {
          badge = (
            <Badge
              tone="neutral"
              className={`${STATUS_BADGE_CLASS} !bg-slate-900/85 !text-white !border-white/40`}
              style={{ fontSize: layout.badgeFontPx }}
            >
              Offline
            </Badge>
          );
        }
        return wrapPad(w, badge);
      }

      case 'verifiedIcon':
        if (!user.isVerified) return null;
        return wrapPad(
          w,
          <span title="Verified" aria-label="Verified" className="drop-shadow-md shrink-0">
            <ShieldCheck
              style={{ width: layout.verifiedIconPx, height: layout.verifiedIconPx }}
              className="text-emerald-400"
              strokeWidth={2.5}
            />
          </span>
        );

      case 'name':
        return wrapPad(
          w,
          <span
            className={`font-display font-bold text-on-media drop-shadow-md leading-tight truncate ${
              w.widthPercent >= 100 ? 'block w-full whitespace-nowrap' : 'block max-w-full'
            }`}
            style={{ fontSize: layout.nameFontPx }}
            title={user.name}
          >
            {user.name}
          </span>
        );

      case 'age':
        return wrapPad(
          w,
          <span
            className="font-medium text-white/90 drop-shadow-sm shrink-0 leading-none"
            style={{ fontSize: layout.metaFontPx }}
          >
            {user.age}
          </span>
        );

      case 'flag':
        return wrapPad(
          w,
          <SvgFlag
            countryCode={user.countryCode}
            nationality={countryName}
            size={layout.flagSize}
            rounded={true}
            className="block"
          />
        );

      case 'country':
        return wrapPad(
          w,
          <span
            className={`text-white/90 font-medium drop-shadow-sm leading-none ${
              w.widthPercent >= 100 ? 'block w-full truncate whitespace-nowrap' : 'truncate'
            }`}
            style={{ fontSize: layout.metaFontPx }}
            title={countryName}
          >
            {countryName}
          </span>
        );

      case 'callButton': {
        const btnStyle: React.CSSProperties = {
          width: layout.callStyle === 'circle' ? layout.callButtonPx : undefined,
          height: layout.callButtonPx,
          minWidth: layout.callStyle === 'pill' ? layout.callButtonPx * 1.6 : layout.callButtonPx,
          borderRadius: layout.callStyle === 'circle' ? 9999 : 12,
        };
        return wrapPad(
          w,
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!previewMode) onStartCall(user.id);
            }}
            title={isUserBusy ? 'Busy' : 'Call'}
            aria-label={isUserBusy ? 'Busy' : 'Call'}
            className={`flex items-center justify-center transition-all cursor-pointer px-2 ${
              isUserOnline
                ? 'bg-flirt text-white shadow-brand active:scale-95'
                : isUserBusy
                ? 'bg-amber-500 text-white shadow-md'
                : 'bg-black/55 text-white/80 border border-white/25 backdrop-blur-md'
            }`}
            style={btnStyle}
          >
            {isUserBusy ? (
              <PhoneCall style={{ width: layout.callIconPx, height: layout.callIconPx }} />
            ) : (
              <Video style={{ width: layout.callIconPx, height: layout.callIconPx }} />
            )}
          </button>
        );
      }

      default:
        return null;
    }
  };

  const renderSlotBlock = (slot: DiscoveryCardSlotId, fallbackJustify: 'start' | 'center' | 'end' = 'start') => {
    const widgets = bySlot[slot];
    if (!widgets.length) return null;
    const lines = splitSlotIntoLines(widgets);
    const lineNodes = lines
      .map((line, lineIdx) => {
        const cells = line
          .map((w) => {
            const node = renderWidget(w);
            if (!node) return null;
            const pct = w.widthPercent > 0 ? Math.min(100, Math.max(10, w.widthPercent)) : 0;
            const style: React.CSSProperties =
              pct > 0
                ? {
                    flex: `0 0 ${pct}%`,
                    maxWidth: `${pct}%`,
                    width: pct === 100 ? '100%' : undefined,
                    minWidth: 0,
                  }
                : { flex: '0 1 auto', minWidth: 0, maxWidth: '100%' };
            return (
              <div key={w.id} className={`min-w-0 ${widgetBoxAlignClasses(w)}`} style={style}>
                {node}
              </div>
            );
          })
          .filter(Boolean);
        if (!cells.length) return null;
        const usesWidths = line.some((w) => w.widthPercent > 0);
        const lineAlign = line[0]?.hAlign === 'right' ? 'end' : fallbackJustify === 'center' ? 'center' : 'start';
        const justifyClass =
          lineAlign === 'center' ? 'justify-center' : lineAlign === 'end' ? 'justify-end' : 'justify-start';
        return (
          <div
            key={`${slot}-line-${lineIdx}`}
            className={`flex items-center gap-1.5 min-w-0 w-full ${
              usesWidths ? 'flex-nowrap' : 'flex-wrap'
            } ${justifyClass}`}
          >
            {cells}
          </div>
        );
      })
      .filter(Boolean);
    if (!lineNodes.length) return null;
    return <div className="flex flex-col gap-0.5 min-w-0 w-full">{lineNodes}</div>;
  };

  const topLeft = renderSlotBlock('topLeft', 'start');
  const topRight = renderSlotBlock('topRight', 'end');
  const hasTop = Boolean(topLeft || topRight);

  const metaPrimary = renderSlotBlock('metaPrimary', 'start');
  const metaSecondary = renderSlotBlock('metaSecondary', 'start');
  const hasMeta = Boolean(metaPrimary || metaSecondary);

  const footerLeft = renderSlotBlock('footerLeft', 'start');
  const footerCenter = renderSlotBlock('footerCenter', 'center');
  const footerRight = renderSlotBlock('footerRight', 'end');
  const hasFooter = Boolean(footerLeft || footerCenter || footerRight);

  return (
    <MediaCard
      className={className}
      src={primaryAvatar}
      fallbackSrc={fallbackAvatar}
      alt={user.name}
      aspectMobile={layout.cardAspectMobile}
      aspectDesktop={layout.cardAspectDesktop}
      showPhoto={layout.showPhoto}
      objectFit={layout.photoFit}
      objectPosition={layout.photoPosition}
      onClick={previewMode ? undefined : () => onOpenProfile(user)}
      statusSlot={
        hasTop ? (
          <>
            <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">{topLeft}</div>
            <div className="flex items-center gap-1.5 flex-wrap min-w-0 justify-end">{topRight}</div>
          </>
        ) : null
      }
      metadata={
        hasMeta ? (
          <div className="space-y-0.5 text-on-media min-w-0">
            {metaPrimary}
            {metaSecondary}
          </div>
        ) : null
      }
      footer={
        hasFooter ? (
          <div className="grid grid-cols-3 items-center gap-1">
            <div className="flex justify-start min-w-0">{footerLeft}</div>
            <div className="flex justify-center min-w-0">{footerCenter}</div>
            <div className="flex justify-end min-w-0">{footerRight}</div>
          </div>
        ) : null
      }
    />
  );
};
