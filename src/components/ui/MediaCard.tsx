import React from 'react';

export type MediaCardAspect = '3/4' | '9/16';

export interface MediaCardProps extends React.HTMLAttributes<HTMLDivElement> {
  src: string;
  alt: string;
  aspect?: MediaCardAspect;
  statusSlot?: React.ReactNode;
  metadata?: React.ReactNode;
  footer?: React.ReactNode;
  onImageError?: React.ReactEventHandler<HTMLImageElement>;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  src,
  alt,
  aspect = '3/4',
  statusSlot,
  metadata,
  footer,
  onImageError,
  className = '',
  onClick,
  ...rest
}) => {
  const aspectClass = aspect === '9/16' ? 'aspect-[9/16]' : 'aspect-[3/4]';

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
        <img
          src={src}
          alt={alt}
          onError={onImageError}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent pointer-events-none" />

        {statusSlot ? (
          <div className="absolute top-2.5 left-2.5 right-2.5 z-10 flex items-start justify-between gap-2">
            {statusSlot}
          </div>
        ) : null}

        {metadata ? (
          <div className="absolute bottom-0 left-0 right-0 z-10 p-3 sm:p-3.5 pointer-events-none">
            <div className="pointer-events-auto">{metadata}</div>
          </div>
        ) : null}
      </div>

      {footer ? <div className="p-2.5 sm:p-3 border-t border-hairline bg-app-card">{footer}</div> : null}
    </div>
  );
};
