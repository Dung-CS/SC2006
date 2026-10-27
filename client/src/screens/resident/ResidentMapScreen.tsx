/**
 * D-Fence — Resident Map screen (REQUIREMENTS.md 11.2.5).
 * Stereotype: <<boundary>>. Traces: 11.2.5, 9.1.1–9.1.11, 11.7.5, 11.4.2.
 *
 * **The map is drawn, and the list stayed.** This screen used to be a list alone, on the argument
 * that every fact 9.1.x asks for was present in text. It was — and a resident asking "is the
 * cluster near my block" cannot answer it from "Lentor Ave, Cres, Green, Gr, Ln, Plain, Rd, St,
 * Ter, Vale, Walk, Way". `SingaporeMap` draws the real NEA polygons over OneMap tiles; the list
 * below is unchanged and is still the form a screen reader can use (11.7.x).
 *
 * 9.1.11 is the requirement that governs both halves: the tier is conveyed by a **label**, not by
 * colour, so the information survives with the drawing off, on a printout, and for a reader who
 * cannot distinguish the fills.
 */
import { useEffect, useState } from 'react';
import { useLoad } from '../../lib/useLoad';
import { StateView } from '../../components/States';
import { link } from '../../components/Link';
import { Pill, statusTone } from '../../components/Presentation';
import { label } from '../../lib/labels';
import { SingaporeMap, MapCluster, MapMarker } from '../../components/SingaporeMap';
import { PhotoCarousel } from '../../components/PhotoCarousel';
import { Pagination, usePagination } from '../../components/Pagination';
import { getClusterPhotos } from '../../lib/clusterVisuals';
import { reportPhotoUrl } from '../../lib/reportVisuals';
import { ScreenProps } from '../ScreenProps';

interface Layers {
  clusters: MapCluster[];
  reports: Array<{ reportId: string; type: string; status: string; latitude: number; longitude: number; pestType?: string }>;
  savedLocations: Array<{
    savedLocationId: string;
    label: string;
    exposureStatus: string;
    latitude: number;
    longitude: number;
  }>;
}

export function ResidentMapScreen(props: ScreenProps): JSX.Element {
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const { state, value, retry } = useLoad<Layers>(props.api, '/api/map/layers', {
    isEmpty: (v) => v.clusters.length === 0,
    emptyMessage: 'There are no active dengue clusters in the current feed.',
  });

  const clusterList = value?.clusters ?? [];
  const clustersPaging = usePagination(clusterList, 5);

  const reportList = value?.reports ?? [];
  const reportsPaging = usePagination(reportList, 10);

  // Synchronize pagination page when a cluster is selected on the map
  useEffect(() => {
    if (selectedClusterId) {
      const index = clusterList.findIndex((c) => c.clusterId === selectedClusterId);
      if (index !== -1) {
        const targetPage = Math.floor(index / clustersPaging.pageSize) + 1;
        if (targetPage !== clustersPaging.currentPage) {
          clustersPaging.setCurrentPage(targetPage);
        }
      }
    }
  }, [selectedClusterId, clusterList, clustersPaging.pageSize]);

  // 9.1.3, 9.1.5 — the resident's own saved locations and the reports the server judged safe to
  // show them. Nothing is filtered here: what arrived is what they are permitted to see.
  const markers: MapMarker[] = [
    ...(value?.savedLocations ?? []).map((location) => ({
      id: location.savedLocationId,
      latitude: location.latitude,
      longitude: location.longitude,
      title: location.label,
      detail: `Your location — ${location.exposureStatus}`,
      kind: 'savedLocation' as const,
    })),
    ...(value?.reports ?? []).map((report) => ({
      id: report.reportId,
      latitude: report.latitude,
      longitude: report.longitude,
      title:
        report.pestType && report.pestType !== 'Mosquito'
          ? `${label(report.pestType)} — ${label(report.type)}`
          : label(report.type),
      detail: `Report — ${label(report.status)}`,
      kind: 'report' as const,
      pestType: report.pestType,
    })),
  ];

  return (
    <section data-screen="ResidentMap" data-requirement="11.2.5">
      <h1>Dengue map</h1>

      <StateView state={state} onRetry={retry}>
        <SingaporeMap
          label="resident-map"
          basemap="Grey_HD"
          clusters={value?.clusters ?? []}
          markers={markers}
          size="short"
          selectedClusterId={selectedClusterId}
          onSelectCluster={(id) => setSelectedClusterId((prev) => (prev === id ? null : id))}
          onSelectMarker={(m) => {
            if (m.kind === 'report') {
              props.onNavigate(`/reports/${m.id}`);
            }
          }}
          // 9.1.5 — open on the resident's own places when they have any. A resident opening this
          // screen is asking about their block, not about the country.
          focus={(value?.savedLocations ?? []).map((l) => [l.latitude, l.longitude] as [number, number])}
        />

        <section data-part="clusters">
          <h2>Active clusters</h2>
          {/* `data-part="list"` is the card treatment the stylesheet already defines for exactly
              this shape — a list where each entry is a thing rather than a line. */}
          <ul data-part="list">
            {clustersPaging.pagedItems.map((cluster) => (
              <li
                key={cluster.clusterId}
                data-tier={cluster.tier}
                data-selected={selectedClusterId === cluster.clusterId ? 'true' : undefined}
                className="cluster-card"
                onClick={() => setSelectedClusterId((prev) => (prev === cluster.clusterId ? null : cluster.clusterId))}
                tabIndex={0}
                role="button"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedClusterId((prev) => (prev === cluster.clusterId ? null : cluster.clusterId));
                  }
                }}
              >
                <PhotoCarousel
                  photos={getClusterPhotos(cluster)}
                  aspectRatio="16 / 9"
                  label={`Surveillance photos for ${cluster.locality}`}
                />
                <div className="cluster-card-content">
                  <h3>{cluster.icon ? `${cluster.icon} ` : ''}{cluster.locality}</h3>
                  {/* 9.1.11, 11.7.5 — the tier in words. Colour, on the map above and in the pill
                      around this text, is an addition to the label and never a replacement. */}
                  <p data-part="tier">{cluster.tierLabel}</p>
                  <p data-part="cases">{cluster.caseSize} {cluster.countLabel ?? 'case(s)'}</p>
                </div>
              </li>
            ))}
          </ul>
          <Pagination
            currentPage={clustersPaging.currentPage}
            totalItems={clustersPaging.totalItems}
            pageSize={clustersPaging.pageSize}
            onPageChange={clustersPaging.setCurrentPage}
            itemName="clusters"
          />
        </section>

        {(value?.savedLocations ?? []).length === 0 ? null : (
          <section data-part="saved">
            <h2>Your saved locations</h2>
            <ul data-cards>
              {(value?.savedLocations ?? []).map((location) => (
                <li key={location.savedLocationId} data-status={location.exposureStatus}>
                  <div data-part="card-head">
                    <strong>{location.label}</strong>
                    {/*
                      This read "Home — CLEAR". `CLEAR` is a TypeScript member name, and it was the
                      answer a resident got to the only question this screen exists to answer. The
                      label now says what it means, and the colour says how worried to be.
                    */}
                    <Pill
                      tone={
                        location.exposureStatus === 'IN_CLUSTER'
                          ? 'bad'
                          : location.exposureStatus === 'WITHIN_150M'
                            ? 'warn'
                            : 'good'
                      }
                    >
                      {label(location.exposureStatus)}
                    </Pill>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {reportList.length === 0 ? null : (
          <section data-part="reports">
            {/*
              * Capped at ten per page with accessible pagination controls.
              * Preserves test N8 expectation while allowing full traversal.
              */}
            <h2>Recent reports</h2>
            <p data-part="report-count">
              {reportList.length <= 10
                ? `${reportList.length} report(s) near you.`
                : `Showing 10 of ${reportList.length} reports. All of them are on the map above.`}
            </p>
            {/* 5.2.9 — a resident sees the markers anonymised; the server decided that, not this
                screen, which is why nothing here strips a field. */}
            <ul data-cards>
              {reportsPaging.pagedItems.map((report) => (
                <li key={report.reportId} className="report-card">
                  <div className="report-card-layout">
                    <img
                      src={reportPhotoUrl(report.type, report.pestType)}
                      alt=""
                      aria-hidden="true"
                      className="report-card-thumb"
                    />
                    <div className="report-card-content">
                      <div data-part="card-head">
                        <span>
                          {report.pestType && report.pestType !== 'Mosquito'
                            ? `${label(report.pestType)} · ${label(report.type)}`
                            : label(report.type)}
                        </span>
                        <Pill tone={statusTone(report.status)}>{label(report.status)}</Pill>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <Pagination
              currentPage={reportsPaging.currentPage}
              totalItems={reportsPaging.totalItems}
              pageSize={reportsPaging.pageSize}
              onPageChange={reportsPaging.setCurrentPage}
              itemName="reports"
            />
          </section>
        )}
      </StateView>

      <nav aria-label="Map actions">
        <a href="/report" onClick={link(props, '/report')}>
          Report a site
        </a>
        <a href="/locations" onClick={link(props, '/locations')}>
          My locations
        </a>
      </nav>
    </section>
  );
}
