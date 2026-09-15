import { useState } from 'react';

// Square image (album cover or artist photo). Covers and photos are hotlinked from other
// sites, so a missing URL or a failed load shows a flat placeholder instead.
// The caller sets the width through className.
export default function Cover({ src, alt, className = '' }) {
  // Remember which URL failed, so the placeholder resets when src changes.
  const [failedSrc, setFailedSrc] = useState(null);
  const showImage = src && failedSrc !== src;

  return (
    <div className={`aspect-square overflow-hidden bg-line ${className}`}>
      {showImage ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailedSrc(src)}
          className="size-full object-cover"
        />
      ) : (
        <div role="img" aria-label={alt} className="flex size-full items-center justify-center text-xs text-muted">
          No image
        </div>
      )}
    </div>
  );
}
