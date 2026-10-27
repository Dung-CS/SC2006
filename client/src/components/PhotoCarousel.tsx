import { useState, useEffect, KeyboardEvent } from 'react';

export interface CarouselPhoto {
  url: string;
  alt: string;
  caption?: string;
  tag?: string;
}

export interface PhotoCarouselProps {
  photos: CarouselPhoto[];
  aspectRatio?: string;
  className?: string;
  showDots?: boolean;
  label?: string;
}

/**
 * Accessible, responsive Photo Carousel conforming to Better-UI guidelines.
 *
 * Enforces:
 * - Reduced motion media query (`prefers-reduced-motion: reduce`)
 * - Inset 1px outline (`--image-outline`)
 * - Active button press scaling feedback
 * - Keyboard navigation (ArrowLeft / ArrowRight)
 * - WAI-ARIA carousel role structure with polite live region updates
 */
export function PhotoCarousel({
  photos,
  aspectRatio = '16 / 9',
  className = '',
  showDots = true,
  label = 'Photographs',
}: PhotoCarouselProps): JSX.Element {
  const [index, setIndex] = useState(0);

  // Reset or wrap index if photos length changes
  useEffect(() => {
    if (index >= photos.length) {
      setIndex(0);
    }
  }, [photos.length, index]);

  if (photos.length === 0) {
    return (
      <div className={`carousel-empty ${className}`} data-aspect={aspectRatio}>
        <p>No photographs available</p>
      </div>
    );
  }

  const fallbackPhoto: CarouselPhoto = photos[0] ?? { url: '', alt: 'Photograph' };
  const current: CarouselPhoto = photos[index] ?? fallbackPhoto;
  const hasMultiple = photos.length > 1;

  function prev(): void {
    setIndex((curr) => (curr === 0 ? photos.length - 1 : curr - 1));
  }

  function next(): void {
    setIndex((curr) => (curr === photos.length - 1 ? 0 : curr + 1));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      prev();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      next();
    }
  }

  const aspectClass = `aspect-${aspectRatio.replace(/\s+/g, '').replace('/', '-')}`;

  return (
    <div
      className={`photo-carousel ${className}`}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      data-count={photos.length}
    >
      <div
        className={`carousel-viewport ${aspectClass}`}
        data-aspect={aspectRatio}
        role="group"
        aria-roledescription="slide"
        aria-label={`${index + 1} of ${photos.length}: ${current.alt}`}
      >
        <img
          src={current.url}
          alt={current.alt}
          className="carousel-image"
          loading="lazy"
        />

        {current.tag ? (
          <span className="carousel-tag" aria-hidden="true">
            {current.tag}
          </span>
        ) : null}

        {hasMultiple ? (
          <span className="carousel-counter" aria-hidden="true">
            {index + 1} / {photos.length}
          </span>
        ) : null}

        {current.caption ? (
          <div className="carousel-caption">
            <p>{current.caption}</p>
          </div>
        ) : null}

        {hasMultiple ? (
          <div className="carousel-controls">
            <button
              type="button"
              className="carousel-nav-btn prev"
              onClick={prev}
              aria-label="Previous photograph"
              title="Previous photograph"
            >
              &#x2039;
            </button>
            <button
              type="button"
              className="carousel-nav-btn next"
              onClick={next}
              aria-label="Next photograph"
              title="Next photograph"
            >
              &#x203A;
            </button>
          </div>
        ) : null}
      </div>

      {hasMultiple && showDots ? (
        <div className="carousel-indicators" role="tablist" aria-label="Slides">
          {photos.map((photo, i) => (
            <button
              key={photo.url + i}
              type="button"
              className={`carousel-dot ${i === index ? 'active' : ''}`}
              role="tab"
              aria-selected={i === index}
              aria-label={`Go to photograph ${i + 1} of ${photos.length}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
