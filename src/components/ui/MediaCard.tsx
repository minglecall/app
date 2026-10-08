import React, { useEffect, useState } from 'react';

export type MediaCardAspect = '3/4' | '9/16';

export interface MediaCardProps extends React.HTMLAttributes<HTMLDivElement> {
  src: string;
  alt: string;
  aspect?: MediaCardAspect;
  /** Used when primary src fails or is empty — kept in React state so re-renders cannot wipe it. */
  fallbackSrc?: string;
  statusSlot?: React.ReactNode;
  metadata?: React.ReactNode;
  footer?: React.ReactNode;
  onImageError?: React.ReactEventHandler<HTMLImageElement>;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  src,
  alt,
  aspect = '3/4',
  fallbackSrc,
  statusSlot,
  metadata,
  footer,
  onImageError,
  className = '',
  onClick,
  ...rest
}) => {
  // Mobile: tall phone portrait; sm+: classic 3/4
  const aspectClass =
    aspect === '9/16' ? 'aspect-[9/16]' : 'aspect-[9/16] sm:aspect-[3/4]';
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
    onImageError?.(e);
  };

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
      <div className={`relative w-full ${aspectClass} overflow-hidden bg-app`}>
        {/* Soft placeholder while the real image decodes */}
        {!loaded && (
          <div
            className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-800 via-slate-750 to-slate-900"
            aria-hidden
          />
        )}
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={alt}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={handleError}
            className={[
              'absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover:scale-105',
              loaded ? 'opacity-100' : 'opacity-0',
            ].join(' ')}
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10 pointer-events-none" />

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
