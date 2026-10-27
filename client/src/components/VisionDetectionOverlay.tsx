/**
 * D-Fence — AI Vision Detection Overlay Component.
 * Renders normalized bounding boxes [x, y, w, h] and specimen index tags over evidence photographs.
 * Supports direct image URLs, sample photo matching, and authenticated storage key resolution.
 * Traces: 5.1.15, 5.1.16, 11.2.8, 11.2.10, 11.2.15.
 */

import { useEffect, useState } from 'react';
import { BoundingBox } from '../lib/pestRecognition';
import { SAMPLE_REPORT_PHOTOS } from '../lib/reportVisuals';

const SESSION_KEY = 'dfence_token';

export interface VisionDetectionOverlayProps {
  imageUrl?: string;
  photoKey?: string;
  reportId?: string;
  boundingBoxes?: BoundingBox[];
  priority?: string;
  alt?: string;
  pestType?: string;
  className?: string;
}

export function VisionDetectionOverlay({
  imageUrl: directUrl,
  photoKey,
  reportId,
  boundingBoxes = [],
  priority = 'Medium',
  alt = 'Evidence Photograph',
  className = '',
}: VisionDetectionOverlayProps): JSX.Element {
  const sampleMatch = photoKey
    ? SAMPLE_REPORT_PHOTOS.find((s) => s.storageKey === photoKey || s.filename === photoKey)
    : null;

  const [resolvedUrl, setResolvedUrl] = useState<string | null>(
    directUrl ?? (sampleMatch ? sampleMatch.url : null),
  );
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setLoadError(null);
    setResolvedUrl(null);
    if (directUrl) {
      setResolvedUrl(directUrl);
      return;
    }
    if (sampleMatch) {
      setResolvedUrl(sampleMatch.url);
      return;
    }
    if (!photoKey || !reportId) {
      return;
    }

    let live = true;
    const token = typeof window !== 'undefined' ? window.localStorage.getItem(SESSION_KEY) : null;
    fetch(`/api/images/report/${encodeURIComponent(reportId)}/${encodeURIComponent(photoKey)}`, {
      headers: token === null ? {} : { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const body = (await res.json()) as { url?: string; error?: string };
        if (!live) return;
        if (res.ok && typeof body.url === 'string') {
          setResolvedUrl(body.url);
        } else {
          setLoadError(body.error ?? 'Could not load evidence image');
        }
      })
      .catch((err) => {
        if (live) setLoadError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      live = false;
    };
  }, [directUrl, photoKey, reportId, sampleMatch]);

  const tone = priority.toLowerCase();
  const count = boundingBoxes.length;

  if (loadError) {
    return (
      <div className={`ai-vision-preview-card ${className}`} role="status">
        <p className="ai-vision-error">Failed to load evidence photograph: {loadError}</p>
      </div>
    );
  }

  if (!resolvedUrl) {
    return (
      <div className={`ai-vision-preview-card ${className}`}>
        <div className="ai-vision-preview-wrap" style={{ display: 'block', maxHeight: 'none' }}>
          <div className="ai-scanner-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className={`ai-vision-preview-card ${className}`} data-part="vision-overlay">
      <div className="ai-vision-preview-wrap" style={{ display: 'block', maxHeight: 'none' }}>
        <img src={resolvedUrl} alt={alt} className="ai-vision-preview-img" style={{ width: '100%', height: 'auto' }} />
        {count > 0 && (
          <svg className="ai-vision-boxes-svg" viewBox="0 0 1000 1000" preserveAspectRatio="none">
            {boundingBoxes.map((bbox, bIdx) => {
              const [bx, by, bw, bh] = bbox.box;
              const px = bx * 1000;
              const py = by * 1000;
              const pw = bw * 1000;
              const ph = bh * 1000;
              const tagWidth = Math.min(180, bbox.label.length * 9.5 + 45);

              return (
                <g key={bIdx} className="ai-bbox-group">
                  <rect
                    x={px}
                    y={py}
                    width={pw}
                    height={ph}
                    className={`ai-bbox-rect tone-${tone}`}
                    rx="6"
                  />
                  <g className="ai-bbox-tag" transform={`translate(${px}, ${Math.max(22, py - 4)})`}>
                    <rect
                      x="0"
                      y="-18"
                      width={tagWidth}
                      height="20"
                      rx="3"
                      className={`ai-bbox-tag-bg tone-${tone}`}
                    />
                    <text x="6" y="-4" className="ai-bbox-tag-text">
                      {bbox.label}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>
        )}
      </div>
      {count > 0 && (
        <div className="ai-vision-overlay-meta">
          <span className="ai-vision-overlay-count">
            👁️ <strong>{count} specimen detection{count === 1 ? '' : 's'}</strong> counted by AI
          </span>
          <span className="ai-vision-overlay-tip">
            Model detections. Check each box against the photograph.
          </span>
        </div>
      )}
    </div>
  );
}
