import React, { useEffect, useState } from 'react';

export type MediaCardAspect = '3/4' | '9/16' | '2/3';
export type MediaCardImageFit = 'cover' | 'contain' | 'fill';
export type MediaCardImagePosition = 'center' | 'top' | 'bottom';

export interface MediaCardProps extends React.HTMLAttributes<HTMLDivElement> {
  src: string;
  alt: string;
  /** Single aspect when responsive pair not provided */
  aspect?: MediaCardAspect;
  /** Mobile aspect (default 9/16). Used with aspectDesktop for responsive cards. */
  aspectMobile?: MediaCardAspect;
  /** sm+ aspect (default 3/4) */
  aspectDesktop?: MediaCardAspect;
  /** Used when primary src fails or is empty — kept in React state so re-renders cannot wipe it. */
  fallbackSrc?: string;
  statusSlot?: React.ReactNode;
  metadata?: React.ReactNode;
  footer?: React.ReactNode;
  onImageError?: React.ReactEventHandler<HTMLImageElement>;
  /** When false, hide the photo and show a solid placeholder. Default true. */
  showPhoto?: boolean;
  imageFit?: MediaCardImageFit;
  imagePosition?: MediaCardImagePosition;
  /** Scrim strength 0–100 (bottom gradient). Default 70. */
  overlayStrength?: number;
  /** Zoom percent 100–140. Default 100. */
  imageScale?: number;
}

/** Full static class strings so Tailwind JIT always emits them. */
function aspectComboClass(mobile: MediaCardAspect, desktop: MediaCardAspect): string {
  if (mobile === '9/16' && desktop === '3/4') return 'aspect-[9/16] sm:aspect-[3/4]';
  if (mobile === '9/16' && desktop === '2/3') return 'aspect-[9/16] sm:aspect-[2/3]';
  if (mobile === '9/16' && desktop === '9/16') return 'aspect-[9/16] sm:aspect-[9/16]';
  if (mobile === '2/3' && desktop === '3/4') return 'aspect-[2/3] sm:aspect-[3/4]';
  if (mobile === '2/3' && desktop === '2/3') return 'aspect-[2/3] sm:aspect-[2/3]';
  if (mobile === '2/3' && desktop === '9/16') return 'aspect-[2/3] sm:aspect-[9/16]';
  if (mobile === '3/4' && desktop === '3/4') return 'aspect-[3/4] sm:aspect-[3/4]';
  if (mobile === '3/4' && desktop === '2/3') return 'aspect-[3/4] sm:aspect-[2/3]';
  return 'aspect-[9/16] sm:aspect-[3/4]';
}

function aspectCss(a: MediaCardAspect): string {
  if (a === '9/16') return '9 / 16';
  if (a === '2/3') return '2 / 3';
  return '3 / 4';
}

function objectPosition(pos: MediaCardImagePosition): string {
  if (pos === 'top') return 'center top';
  if (pos === 'bottom') return 'center bottom';
  return 'center center';
}

export const MediaCard: React.FC<MediaCardProps> = ({
  src,
  alt,
  aspect = '3/4',
  aspectMobile,
  aspectDesktop,
  fallbackSrc,
  statusSlot,
  metadata,
  footer,
  onImageError,
  showPhoto = true,
  imageFit = 'cover',
  imagePosition = 'center',
  overlayStrength = 70,
  imageScale = 100,
  className = '',
  onClick,
  ...rest
}) => {
  const mobile = aspectMobile || (aspect === '9/16' || aspect === '2/3' ? aspect : '9/16');
  const desktop = aspectDesktop || (aspect === '3/4' || aspect === '2/3' ? aspect : '3/4');
  const resolvedAspectClass = aspectComboClass(mobile, desktop);

  const resolvedSrc = (src && String(src).trim()) || fallbackSrc || '';
  const [imgSrc, setImgSrc] = useState(resolvedSrc);
  const [loaded, setLoaded] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);

  useEffect(() => {
    const next = (src && String(src).trim()) || fallbackSrc || '';
    setImgSrc(next);
    setLoaded(false);
    setUsedFallback(!(src && String(src).trim()) && Boolean(fallbackSrc));
  }, [src, fallbackSrc]);

  const handleError: React.ReactEventHandler<HTMLImageElement> = (e) => {
    if (!usedFallback && fallbackSrc && imgSrc !== fallbackSrc) {
      setUsedFallback(true);
      setLoaded(false);
      setImgSrc(fallbackSrc);
      return;
    }
    // Keep a visible broken-state rather than infinite skeleton
    setLoaded(true);
    onImageError?.(e);
  };

  const overlay = Math.min(100, Math.max(0, overlayStrength)) / 100;
  const scale = Math.min(140, Math.max(100, imageScale)) / 100;

  return (
    <div
      className={[
        'group relative overflow-hidden rounded-app-xl bg-app-card border border-hairline shadow-app-sm',
        'transition-transform duration-300 hover:scale-[1.01] app-fade-up',
        onClick ? 'cursor-pointer' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
      {...rest}
    >
      <div
        className={`mc-aspect-responsive relative w-full min-h-[180px] ${resolvedAspectClass} overflow-hidden bg-slate-800`}
        style={
          {
            // Inline + CSS var fallbacks if Tailwind aspect utilities are purged
            aspectRatio: aspectCss(mobile),
            ['--mc-aspect-sm' as string]: aspectCss(desktop),
          } as React.CSSProperties
        }
      >
        {!loaded && showPhoto && (
          <div
            className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-800 via-slate-750 to-slate-900"
            aria-hidden
          />
        )}
        {showPhoto && imgSrc ? (
          <img
            src={imgSrc}
            alt={alt}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={handleError}
            className={[
              'absolute inset-0 w-full h-full transition-all duration-500 group-hover:scale-105',
              loaded ? 'opacity-100' : 'opacity-0',
            ].join(' ')}
            style={{
              objectFit: imageFit,
              objectPosition: objectPosition(imagePosition),
              transform: `scale(${scale})`,
            }}
          />
        ) : (
          <div
            className="absolute inset-0 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900"
            aria-hidden
          />
        )}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(to top, rgba(0,0,0,${0.85 * overlay}) 0%, rgba(0,0,0,${0.35 * overlay}) 45%, rgba(0,0,0,${0.1 * overlay}) 100%)`,
          }}
        />

        {statusSlot ? (
          <div className="absolute top-2 left-2 right-2 z-10 flex items-start justify-between gap-2">
            {statusSlot}
          </div>
        ) : null}

        {(metadata || footer) ? (
          <div className="absolute bottom-0 left-0 right-0 z-10 p-2.5 sm:p-3 pointer-events-none space-y-2">
            {metadata ? <div className="pointer-events-auto">{metadata}</div> : null}
            {footer ? <div className="pointer-events-auto">{footer}</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};
