/**
 * D-Fence — the drawn map.
 * Stereotype: <<boundary>>. Traces: 9.1.1–9.1.11, 10.4.5, 11.7.2, 11.7.5, 11.7.7, 11.8.13.
 *
 * Until now §9.1 was answered with a list, on the argument that every *fact* the requirement asks
 * the map to convey was present in text. That argument was true and it was not sufficient. A
 * dengue cluster is a shape on the ground, and "Lentor Ave, Cres, Green, Gr, Ln, Plain, Rd, St,
 * Ter, Vale, Walk, Way" is not a place a person can picture. The server has been returning real
 * NEA polygons — fifty-four points for that one cluster — since the feed was first ingested; the
 * client simply never drew them.
 *
 * Four decisions worth defending:
 *
 * **The basemap is OneMap, not a global provider.** Singapore Land Authority tiles, from the same
 * agency whose geocoder already resolves a resident's address. It needs no key, it names local
 * streets and block numbers the way a resident says them, and 10.4.5's attribution obligation is
 * satisfied by a source we already attribute. It is also the only external origin the client
 * touches, which is why the CSP names it explicitly rather than loosening `img-src` to `*`.
 *
 * **The list did not go away.** It is rendered beneath the map, from the same data. Leaflet's
 * panes are not reachable by a screen reader in any useful way, and 11.7.5 does not become
 * optional because a picture is now available. The map is the addition; the text is the record.
 *
 * **Colour is never the only carrier of tier** (9.1.11, 11.7.5). Each polygon is filled by tier
 * *and* labelled by tier in words, in its tooltip, in its popup and in the list.
 *
 * **It degrades rather than explodes.** Leaflet needs a laid-out element, which jsdom does not
 * provide; construction is wrapped so a failure leaves the accessible list standing rather than
 * taking the screen down with it. A map is an enhancement of this screen, not its substance.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
// Statically imported and bundled: the client ships no CDN reference, and esbuild's IIFE output
// has no module loader to resolve a dynamic one at runtime. Leaflet touches no DOM at import
// time, so the cost of importing it on a screen that never draws is a few kilobytes.
import * as L from 'leaflet';
import type { Map as LeafletMap, LayerGroup, PathOptions } from 'leaflet';
import { reportPhotoUrl } from '../lib/reportVisuals';
import { label } from '../lib/labels';
import { createReportRejectSection } from './TaskScoreCallout';
import type { RejectReport } from './ReportRejectControl';
import type { TaskScoreExplanation } from '../../../src/presentation/TaskScoreExplanation';

/** Roughly the Republic, with enough margin that a cluster on the coast is not against the edge. */
const SINGAPORE_BOUNDS: [[number, number], [number, number]] = [
  [1.15, 103.55],
  [1.51, 104.14],
];
const SINGAPORE_CENTRE: [number, number] = [1.3521, 103.8198];

/**
 * 10.4.5 — the attribution the Singapore Land Authority asks for, rendered by Leaflet in the
 * corner of the map and repeated in the screen's own text so it survives with the drawing off.
 */
export const ONEMAP_ATTRIBUTION =
  '<a href="https://www.onemap.gov.sg/" rel="noreferrer">OneMap</a> © Singapore Land Authority';

/** Basemaps: grey is default where colours (routes, clusters) must carry; night and plain stay for other screens. */
export type Basemap = 'Grey_HD' | 'Night_HD' | 'Default_HD';

export interface MapCluster {
  clusterId: string;
  locality: string;
  tier: string;
  tierLabel: string;
  caseSize: number;
  /** GeoJSON order — [longitude, latitude] — which is the reverse of how the map wants it. */
  ring: Array<[number, number]>;
  pestType?: string;
  icon?: string;
  countLabel?: string;
}

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  /** The heading of the popup, and the text of the list entry. */
  title: string;
  /** One line under the heading. Never a colour name. */
  detail: string;
  kind: 'report' | 'workOrder' | 'savedLocation';
  pestType?: string;
}

export interface MapRouteWaypoint {
  label: string;
  point: { latitude: number; longitude: number };
  isCompleted?: boolean;
  isBaseReturn?: boolean;
  isHq?: boolean;
  priority?: string;
  pestType?: string;
  taskType?: string;
}

export interface MapRoute {
  teamId: string;
  color: string;
  label: string;
  coordinates: Array<{ latitude: number; longitude: number }>;
  walkingSegments?: Array<{ coordinates: Array<{ latitude: number; longitude: number }> }>;
  waypoints?: MapRouteWaypoint[];
}

export interface MapTask {
  id: string;
  point: { latitude: number; longitude: number };
  /** Source enum keys; format only at the visible-text boundary, never before icon/photo lookup. */
  pestType?: string;
  taskType?: string;
  priority?: string;
  location: string;
  photoUrl: string;
  photoIsReference: boolean;
  sourceReportId?: string;
  teamId?: string;
  teamLabel?: string;
  assignmentState?: 'planned' | 'assigned' | 'unassigned' | 'unknown';
  scoreExplanation?: TaskScoreExplanation;
}

export interface SingaporeMapProps {
  clusters: MapCluster[];
  markers?: MapMarker[];
  routes?: MapRoute[];
  tasks?: MapTask[];
  onTaskOpen?: (task: MapTask) => void;
  /** Reject a report-sourced task's source report; the callout shows the control only when given. */
  onRejectReport?: RejectReport;
  /** Open the task view (where the score breakdown lives); the callout shows "Open task" only when given. */
  onTaskDetail?: (task: MapTask) => void;
  basemap?: Basemap;
  /** Deliberate caller view changes may refit; data refreshes must not. */
  viewKey?: string;
  showClusterBadges?: boolean;
  /** Called when a cluster shape or its list entry is chosen. Absent means the shapes are inert. */
  onSelectCluster?: (clusterId: string) => void;
  /** Drawn thicker, and the map opens on it. */
  selectedClusterId?: string | null;
  /**
   * How tall the drawn area is. A named size rather than a pixel value, because the CSP forbids
   * inline styles and the answer to that - stated in `ExpressApp`'s own policy comment - is a
   * class in `styles.css`, never a weaker policy.
   */
  size?: 'tall' | 'short';
  /**
   * Points the view should open on — a resident's saved locations, typically. When given, the map
   * opens around them with a kilometre of margin rather than around every cluster in the country:
   * "is it near my block" is answered by a frame that contains my block, and an island-wide view
   * showing sixteen shapes the size of a full stop answers nothing.
   */
  focus?: Array<[number, number]>;
  /** For `data-part` hooks in the acceptance harness. */
  label: string;
  /** Called when a marker or its popup action link is selected. */
  onSelectMarker?: (marker: MapMarker) => void;
  /** Centre the map on a marker and open its popup. A new object (same id) asks again. */
  focusRequest?: { id: string } | null;
}

/**
 * 9.1.11 — the fill for a tier, and the only place a colour is written in this file. Leaflet draws
 * on a canvas element and cannot take a CSS class, so these hex values must exist in JavaScript;
 * they are the same three the stylesheet uses for `--tier-high`, `--tier-medium` and `--tier-low`,
 * and the swatches in the legend take theirs from the stylesheet rather than from here.
 */
const DEFAULT_TIER = { stroke: '#6EE7B7', fill: '#10B981' };

const TIER_COLOURS: Record<string, { stroke: string; fill: string }> = {
  Critical: { stroke: '#FECACA', fill: '#DC2626' },
  High: { stroke: '#FCA5A5', fill: '#EF4444' },
  Medium: { stroke: '#FDBA74', fill: '#F97316' },
  Low: DEFAULT_TIER,
};

const MARKER_COLOURS: Record<MapMarker['kind'], string> = {
  report: '#0D9488',
  workOrder: '#2563EB',
  savedLocation: '#7C3AED',
};

const MARKER_NAMES: Record<MapMarker['kind'], string> = {
  report: 'Reports',
  workOrder: 'Work orders',
  savedLocation: 'My locations',
};

const PEST_ICONS: Record<string, { emoji: string; color: string; label: string }> = {
  Mosquito: { emoji: '\uD83E\uDD9F', color: '#DC2626', label: 'Mosquito' },
  Rat: { emoji: '\uD83D\uDC00', color: '#D97706', label: 'Rat' },
  Cockroach: { emoji: '\uD83E\uDEB3', color: '#92400E', label: 'Cockroach' },
  Fly: { emoji: '\uD83E\uDEB0', color: '#475569', label: 'Fly' },
  BedBug: { emoji: '\uD83D\uDC1B', color: '#92400E', label: 'Bed Bug' },
  Flea: { emoji: '\uD83D\uDC1B', color: '#92400E', label: 'Flea' },
  Termite: { emoji: '\uD83E\uDEB5', color: '#854D0E', label: 'Termite' },
  Ant: { emoji: '\uD83D\uDC1C', color: '#DC2626', label: 'Ant' },
  Snake: { emoji: '\uD83D\uDC0D', color: '#059669', label: 'Snake' },
  WildBoar: { emoji: '\uD83D\uDC17', color: '#78350F', label: 'Wild Boar' },
  Macaque: { emoji: '\uD83D\uDC12', color: '#B45309', label: 'Macaque' },
  MonitorLizard: { emoji: '\uD83E\uDD8E', color: '#059669', label: 'Monitor Lizard' },
  Otter: { emoji: '\uD83E\uDDA6', color: '#059669', label: 'Otter' },
  Civet: { emoji: '\uD83D\uDC08', color: '#78350F', label: 'Civet' },
  Bat: { emoji: '\uD83E\uDD87', color: '#4B5563', label: 'Bat' },
  Pangolin: { emoji: '\uD83E\uDD8E', color: '#78350F', label: 'Pangolin' },
  Crocodile: { emoji: '\uD83D\uDC0A', color: '#059669', label: 'Crocodile' },
  HouseCrow: { emoji: '\uD83E\uDD85', color: '#4B5563', label: 'House Crow' },
  Pigeon: { emoji: '\uD83D\uDC26', color: '#64748B', label: 'Pigeon' },
  JavanMyna: { emoji: '\uD83D\uDC26', color: '#4B5563', label: 'Javan Myna' },
  BeeWasp: { emoji: '\uD83D\uDC1D', color: '#CA8A04', label: 'Bee / Wasp' },
  Other: { emoji: '\uD83D\uDC1B', color: '#64748B', label: 'Other pest' },
};

export function getMapPestIcon(pestType?: string): string {
  return PEST_ICONS[pestType ?? '']?.emoji ?? '\uD83D\uDC1B';
}

export function getMapPriorityClass(priority?: string): string {
  return ['Critical', 'High', 'Medium', 'Low'].includes(priority ?? '') ? `priority-${priority?.toLowerCase()}` : 'priority-low';
}

const REPORT_TYPE_ICONS: Record<string, { emoji: string; color: string; label: string }> = {
  StandingWater: { emoji: '💧', color: '#0284C7', label: 'Standing Water' },
  BlockedDrain: { emoji: '🚰', color: '#0369A1', label: 'Blocked Drain' },
  UnclearedRefuse: { emoji: '🗑️', color: '#D97706', label: 'Refuse' },
  OvergrownVegetation: { emoji: '🌿', color: '#16A34A', label: 'Vegetation' },
  Other: { emoji: '⚠️', color: '#DC2626', label: 'Report' },
};

function getMarkerVisual(marker: MapMarker): { emoji: string; color: string; label: string } {
  if (marker.kind === 'workOrder') {
    return { emoji: '🛠️', color: '#2563EB', label: 'Work order' };
  }
  if (marker.kind === 'savedLocation') {
    return { emoji: '📍', color: '#7C3AED', label: 'My location' };
  }
  if (marker.pestType !== undefined) {
    const pestMatch = PEST_ICONS[marker.pestType];
    if (pestMatch !== undefined) {
      return pestMatch;
    }
  }
  const reportTypeMatch = REPORT_TYPE_ICONS[marker.title];
  if (reportTypeMatch !== undefined) {
    return reportTypeMatch;
  }
  return { emoji: '⚠️', color: '#0D9488', label: 'Report' };
}

function tierStyle(tier: string, selected: boolean): PathOptions {
  const palette = TIER_COLOURS[tier] ?? DEFAULT_TIER;
  return {
    color: selected ? '#FFFFFF' : palette.stroke,
    weight: selected ? 6 : 4,
    opacity: 1,
    fillColor: palette.fill,
    fillOpacity: selected ? 0.72 : 0.52,
    className: `cluster-polygon tier-${tier} ${selected ? 'is-selected' : ''}`,
  };
}

/**
 * Escape before interpolating into a Leaflet popup. Popups take an HTML string, and a locality
 * name arrives from a government feed rather than from us — 10.3.x does not stop applying because
 * the source is trusted today.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** DOM text and URL properties keep source fields out of the HTML parser. */
export function createTaskCallout(task: MapTask, onRejectReport?: RejectReport, onTaskDetail?: (task: MapTask) => void): HTMLElement {
  const card = document.createElement('div');
  card.className = 'map-popup-card';
  card.dataset.taskId = task.id;
  card.dataset.part = 'task-callout';
  const add = (label: string, value: string) => {
    const row = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = `${label}: `;
    row.append(name, document.createTextNode(value));
    card.append(row);
  };
  add('Pest', task.pestType ? label(task.pestType) : 'Not recorded');
  add('Task', task.taskType ? label(task.taskType) : 'Not recorded');
  add('Priority', task.priority ?? 'Not recorded');
  add('Location', task.location);
  const team = task.teamLabel ?? (task.teamId ? `Team ${task.teamId}` : 'Team not recorded');
  add('Team', task.assignmentState === 'unassigned' ? 'Unassigned'
    : task.assignmentState === 'planned' ? `${team} (planned)`
    : task.assignmentState === 'unknown' ? 'Team not recorded' : team);
  // The score breakdown is shown only in the opened task view, never in this popup.
  if (onTaskDetail) {
    const open = document.createElement('button');
    open.type = 'button';
    open.dataset.part = 'open-task';
    open.textContent = 'Open task';
    open.addEventListener('click', () => onTaskDetail(task));
    card.append(open);
  }
  const rejectSection = createReportRejectSection(task, onRejectReport);
  if (rejectSection) card.append(rejectSection);
  const figure = document.createElement('figure');
  figure.className = 'report-reference-photo-card';
  const caption = document.createElement('figcaption');
  caption.className = 'report-reference-caption';
  caption.textContent = task.photoIsReference ? 'Reference photo' : 'Report photo';
  try {
    const url = new URL(task.photoUrl, window.location.href);
    if (!['http:', 'https:', 'blob:'].includes(url.protocol) || !task.photoUrl.trim()) throw new Error('Invalid photo URL');
    const image = document.createElement('img');
    image.className = 'report-reference-img';
    image.src = url.href;
    image.alt = task.photoIsReference ? `${task.pestType ? label(task.pestType) : 'Pest'} reference` : 'Reported site';
    image.width = 240;
    image.height = 140;
    let isReference = task.photoIsReference;
    image.addEventListener('error', () => {
      if (!isReference) {
        isReference = true;
        image.src = reportPhotoUrl(task.taskType ?? 'StandingWater', task.pestType);
        image.alt = `${task.pestType ? label(task.pestType) : 'Pest'} reference`;
        caption.textContent = 'Reference photo';
      } else {
        image.remove();
        caption.textContent = 'Reference photo unavailable';
      }
    });
    const visual = document.createElement('div');
    visual.className = 'report-reference-visual';
    visual.append(image);
    figure.append(visual);
  } catch {
    caption.textContent = 'Photo unavailable';
  }
  figure.append(caption);
  card.append(figure);
  return card;
}

export function SingaporeMap(props: SingaporeMapProps): JSX.Element {
  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<LeafletMap | null>(null);
  const clusterLayer = useRef<LayerGroup | null>(null);
  const routeLayer = useRef<LayerGroup | null>(null);
  const taskLayer = useRef<LayerGroup | null>(null);
  const taskPopup = useRef<L.Popup | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const markerLayers = useRef<Partial<Record<MapMarker['kind'], LayerGroup>>>({});
  const markerObjects = useRef<Map<string, L.Marker>>(new Map());
  const [drawn, setDrawn] = useState(false);
  const [failed, setFailed] = useState(false);
  const legendId = useId();
  const framedView = useRef<string | null>(null);
  const userMoved = useRef(false);

  const markers = useMemo(() => props.markers ?? [], [props.markers]);
  // 9.1.6 — a layer can be hidden. Only the kinds actually present are offered, so a resident is
  // not shown a switch for work orders they are not permitted to see in the first place.
  const kinds = useMemo(
    () => Array.from(new Set(markers.map((m) => m.kind))) as Array<MapMarker['kind']>,
    [markers],
  );
  const [hidden, setHidden] = useState<Record<string, boolean>>({});

  /** Construct the map once, and never let a failure to construct it take the screen down. */
  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    const element = container.current;
    if (element === null) {
      return;
    }

    function initMap(): void {
      if (cancelled || map.current !== null || element === null) {
        return;
      }
      /*
       * Leaflet requires a laid-out container: it reads the element's size to decide how many tiles
       * to request and where to put them, and given a zero-width element it constructs an object
       * that throws from inside its own callbacks later, where no `try` of ours can reach it.
       */
      if (element.clientWidth === 0 || element.clientHeight === 0) {
        return;
      }
      try {
        const instance = L.map(element, {
          center: SINGAPORE_CENTRE,
          zoom: 11,
          minZoom: 10,
          maxZoom: 18,
          // 11.7.2 — Leaflet's own keyboard handling: arrows pan, +/- zoom, and the container is
          // focusable. Switching this off, as many integrations quietly do, removes the only way
          // to use the map without a mouse.
          keyboard: true,
          // A map that can be dragged into the South China Sea is a map a user has to recover
          // from. `maxBounds` plus viscosity lets it stretch and pull back.
          maxBounds: SINGAPORE_BOUNDS,
          maxBoundsViscosity: 1,
          // Two fingers to pan the map, so a phone scrolls the page past it (11.8.x). Without this
          // the map traps the scroll and the screen below becomes unreachable.
          dragging: true,
          scrollWheelZoom: true,
          tap: true,
        });
        L.tileLayer(`https://www.onemap.gov.sg/maps/tiles/${props.basemap ?? 'Grey_HD'}/{z}/{x}/{y}.png`, {
          attribution: ONEMAP_ATTRIBUTION,
          maxZoom: 18,
          // OneMap serves Singapore alone; beyond it the tiles are blank, and blank tiles look
          // like a broken map rather than like the edge of the country.
          bounds: SINGAPORE_BOUNDS,
        }).addTo(instance);
        instance.attributionControl.setPrefix('');
        clusterLayer.current = L.layerGroup().addTo(instance);
        routeLayer.current = L.layerGroup().addTo(instance);
        taskLayer.current = L.layerGroup().addTo(instance);
        for (const kind of ['report', 'workOrder', 'savedLocation'] as const) {
          markerLayers.current[kind] = L.layerGroup().addTo(instance);
        }
        map.current = instance;
        const syncMapState = () => {
          const centre = instance.getCenter();
          element.dataset.mapZoom = String(instance.getZoom());
          element.dataset.mapMinZoom = String(instance.getMinZoom());
          element.dataset.mapLatitude = String(centre.lat);
          element.dataset.mapLongitude = String(centre.lng);
        };
        const constrainViewport = () => {
          // Keep the viewport within the Singapore envelope, including after a resize.
          instance.setMinZoom(Math.min(18, instance.getBoundsZoom(L.latLngBounds(SINGAPORE_BOUNDS), true)));
          instance.panInsideBounds(SINGAPORE_BOUNDS, { animate: false });
          syncMapState();
        };
        instance.on('moveend zoomend', syncMapState);
        instance.on('resize', constrainViewport);
        constrainViewport();
        instance.on('dragstart', () => { userMoved.current = true; });
        if (!cancelled) {
          setDrawn(true);
        }
        requestAnimationFrame(() => {
          if (!cancelled && map.current !== null) {
            map.current.invalidateSize();
          }
        });
        setTimeout(() => {
          if (!cancelled && map.current !== null) {
            map.current.invalidateSize();
          }
        }, 200);
      } catch {
        // jsdom, or a browser that could not lay the element out. The list below is the fallback
        // and it is always rendered, so there is nothing to replace.
        if (!cancelled) {
          setFailed(true);
        }
      }
    }

    if (element.clientWidth > 0 && element.clientHeight > 0) {
      initMap();
    }

    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        if (map.current !== null) {
          map.current.invalidateSize();
        } else if (element.clientWidth > 0 && element.clientHeight > 0) {
          initMap();
        }
      });
      observer.observe(element);
    }

    const markUserMoved = () => { userMoved.current = true; };
    for (const event of ['wheel', 'touchstart', 'keydown', 'pointerdown']) element.addEventListener(event, markUserMoved);
    const handleWindowResize = () => {
      map.current?.invalidateSize();
    };
    window.addEventListener('resize', handleWindowResize);

    return () => {
      cancelled = true;
      for (const event of ['wheel', 'touchstart', 'keydown', 'pointerdown']) element.removeEventListener(event, markUserMoved);
      observer?.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      // Stop a running pan animation first: its transitionend would otherwise fire on a removed map.
      map.current?.stop();
      map.current?.closePopup();
      map.current?.remove();
      map.current = null;
      clusterLayer.current = null;
      routeLayer.current = null;
      taskLayer.current = null;
      taskPopup.current = null;
      markerLayers.current = {};
    };
    // Constructed once. The basemap is a per-screen constant, not a control.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Redraw the cluster shapes whenever the data or the selection changes. */
  useEffect(() => {
    if (!drawn || map.current === null || clusterLayer.current === null) {
      return;
    }
    try {
      const layer = clusterLayer.current;
      if (layer === null) {
        return;
      }
      layer.clearLayers();

      for (const cluster of props.clusters) {
        if (cluster.ring.length < 3) {
          continue;
        }
        const latlngs = cluster.ring.map(([lng, lat]) => [lat, lng] as [number, number]);
        const selected = props.selectedClusterId === cluster.clusterId;
        const shape = L.polygon(latlngs, tierStyle(cluster.tier, selected));
        // Hover and focus both, because a keyboard user gets no hover. Leaflet makes the path
        // focusable when it is interactive, which it is whenever a selection handler exists.
        shape.bindTooltip(`${escapeHtml(cluster.locality)} — ${escapeHtml(cluster.tierLabel)}`, {
          sticky: true,
        });
        shape.bindPopup(
          `<strong>${escapeHtml(cluster.locality)}</strong><br>${escapeHtml(cluster.tierLabel)}<br>${cluster.caseSize} ${escapeHtml(cluster.countLabel ?? 'case(s)')}`,
        );
        if (props.onSelectCluster !== undefined) {
          shape.on('click', () => props.onSelectCluster?.(cluster.clusterId));
          shape.on('keypress', (event) => {
            const key = (event as unknown as { originalEvent?: KeyboardEvent }).originalEvent?.key;
            if (key === 'Enter' || key === ' ') {
              props.onSelectCluster?.(cluster.clusterId);
            }
          });
        }
        shape.addTo(layer);

        if (props.showClusterBadges !== false) {
          // Prominent centroid badge pill with case count and tier color for high map visibility
          const center = shape.getBounds().getCenter();
          const badgeIcon = L.divIcon({
            className: 'cluster-badge-container',
            html: `<div class="cluster-map-pill ${getMapPriorityClass(cluster.tier)} ${selected ? 'is-selected' : ''}" role="button" tabindex="0" aria-label="${escapeHtml(cluster.locality)}: ${escapeHtml(cluster.tierLabel)}">
              <span class="cluster-pill-icon" aria-hidden="true">${getMapPestIcon(cluster.pestType)}</span>
            </div>`,
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          });
          const badgeMarker = L.marker(center, { icon: badgeIcon, interactive: true });
          badgeMarker.bindTooltip(`${escapeHtml(cluster.locality)} — ${escapeHtml(cluster.tierLabel)}`, {
            sticky: true,
          });
          badgeMarker.bindPopup(
            `<strong>${escapeHtml(cluster.locality)}</strong><br>${escapeHtml(cluster.tierLabel)}<br>${cluster.caseSize} ${escapeHtml(cluster.countLabel ?? 'case(s)')}`,
          );
          if (props.onSelectCluster !== undefined) {
            badgeMarker.on('click', () => props.onSelectCluster?.(cluster.clusterId));
            badgeMarker.on('keypress', (event) => {
              const key = (event as unknown as { originalEvent?: KeyboardEvent }).originalEvent?.key;
              if (key === 'Enter' || key === ' ') {
                props.onSelectCluster?.(cluster.clusterId);
              }
            });
          }
          badgeMarker.addTo(layer);

        }
      }
    } catch {
      // A redraw that fails must not take the screen with it; the list below is unaffected.
      setFailed(true);
    }
  }, [drawn, props.clusters, props.focus, props.selectedClusterId, props.onSelectCluster, props.showClusterBadges]);

  /** Redraw the multi-team route polylines and stop waypoints. */
  useEffect(() => {
    if (!drawn || map.current === null || routeLayer.current === null) {
      return;
    }
    try {
      const layer = routeLayer.current;
      layer.clearLayers();
      const routes = props.routes ?? [];
      if (routes.length === 0) {
        return;
      }

      routes.forEach((r) => {
        if (r.coordinates.length >= 2) {
          const latlngs = r.coordinates.map((c) => [c.latitude, c.longitude] as [number, number]);

          const polyline = L.polyline(latlngs, {
            color: r.color,
            weight: 5,
            opacity: 0.95,
            lineJoin: 'round',
          });
          polyline.bindTooltip(`Team ${r.teamId}: ${r.label}`, { sticky: true });
          polyline.addTo(layer);
        }
        (r.walkingSegments ?? []).forEach((segment) => {
          if (segment.coordinates.length < 2) return;
          const walking = L.polyline(segment.coordinates.map((c) => [c.latitude, c.longitude] as [number, number]), {
            color: r.color, weight: 4, opacity: 0.9, dashArray: '7 7', lineJoin: 'round',
          });
          walking.bindTooltip(`Team ${r.teamId}: walking access`, { sticky: true });
          walking.addTo(layer);
        });

        if (r.waypoints) {
          r.waypoints.forEach((wp, idx) => {
            const isHq = wp.isHq;
            if (props.tasks !== undefined && !isHq) return;
            const isDone = wp.isCompleted;

            const icon = L.divIcon({
              className: 'custom-route-marker',
              html: `<div class="route-stop-pin ${isHq ? 'is-hq' : getMapPriorityClass(wp.priority)}" aria-label="${escapeHtml(isHq ? wp.label : `${wp.label}: ${wp.priority ?? 'Low'} priority`)}">${isHq ? '🏢' : `<span aria-hidden="true">${getMapPestIcon(wp.pestType)}</span>`}</div>`,
              iconSize: [isHq ? 30 : 36, isHq ? 30 : 36],
              iconAnchor: [isHq ? 15 : 18, isHq ? 15 : 18],
            });

            const marker = L.marker([wp.point.latitude, wp.point.longitude], {
              icon,
              title: isHq ? wp.label : `${wp.label}: ${wp.priority ?? 'Low'} priority`,
            });
            marker.bindPopup(`
              <div class="route-popup-card">
                <strong>Team ${escapeHtml(r.teamId)}</strong>
                <div>${escapeHtml(wp.label)}</div>
                ${wp.priority ? `<div class="route-popup-priority ${wp.priority === 'Critical' ? 'critical' : wp.priority === 'High' ? 'high' : 'medium'}">${escapeHtml(wp.priority)} priority</div>` : ''}
                ${isDone ? '<div class="route-popup-completed">✓ Completed</div>' : ''}
              </div>
            `);
            marker.addTo(layer);
          });
        }
      });

    } catch {
      // Degrades gracefully
    }
  }, [drawn, props.routes, props.tasks !== undefined, props.clusters.length, props.selectedClusterId]);

  /** Task markers may refresh; their standalone popup remains open by stable source ID. */
  useEffect(() => {
    const layer = taskLayer.current;
    if (!drawn || layer === null) return;
    layer.clearLayers();
    for (const task of props.tasks ?? []) {
      if (!Number.isFinite(task.point.latitude) || !Number.isFinite(task.point.longitude)) continue;
      const icon = L.divIcon({
        className: 'custom-route-marker',
        html: `<div class="route-stop-pin ${getMapPriorityClass(task.priority)}" data-task-id="${escapeHtml(task.id)}" data-pest-type="${escapeHtml(task.pestType ?? '')}" data-assignment-state="${escapeHtml(task.assignmentState ?? 'unknown')}"><span aria-hidden="true">${getMapPestIcon(task.pestType)}</span></div>`,
        iconSize: [36, 36], iconAnchor: [18, 18],
      });
      L.marker([task.point.latitude, task.point.longitude], {
        icon, title: `${task.pestType ? label(task.pestType) : 'Pest'}: ${task.location}`, keyboard: true,
      }).on('click', () => {
        setActiveTaskId(task.id);
        props.onTaskOpen?.(task);
      }).addTo(layer);
    }
  }, [drawn, props.tasks, props.onTaskOpen]);

  useEffect(() => {
    const instance = map.current;
    if (!drawn || instance === null) return;
    const task = props.tasks?.find((candidate) => candidate.id === activeTaskId);
    if (!task) {
      taskPopup.current?.remove();
      taskPopup.current = null;
      if (activeTaskId !== null) setActiveTaskId(null);
      return;
    }
    if (taskPopup.current === null) {
      taskPopup.current = L.popup({ autoPan: true, autoPanPadding: L.point(12, 12), maxHeight: 320, maxWidth: 300 })
        .on('remove', () => { taskPopup.current = null; setActiveTaskId(null); });
    }
    // A refresh must not wipe a reject form the operator is using: keep the open card as it is.
    const shown = taskPopup.current.getContent();
    const typing = shown instanceof HTMLElement && shown.dataset.taskId === task.id &&
      (shown.querySelector('form:not([hidden])') !== null || Array.from(shown.querySelectorAll('textarea')).some((box) => box.value !== ''));
    taskPopup.current.setLatLng([task.point.latitude, task.point.longitude]);
    if (!typing) taskPopup.current.setContent(createTaskCallout(task, props.onRejectReport, props.onTaskDetail));
    if (!instance.hasLayer(taskPopup.current)) taskPopup.current.openOn(instance);
  }, [drawn, activeTaskId, props.tasks, props.onRejectReport, props.onTaskDetail]);

  // Frame once after data arrives, or after an explicit focus/team change. Polls only redraw.
  useEffect(() => {
    const instance = map.current;
    if (!drawn || instance === null) return;
    const viewKey = JSON.stringify([props.viewKey ?? '', props.selectedClusterId ?? null, props.focus ?? []]);
    if (framedView.current === viewKey) return;
    if (framedView.current === null && userMoved.current) {
      framedView.current = viewKey; // Consume only the initial frame; later explicit focus still works.
      return;
    }
    const bounds = L.latLngBounds([]);
    const selected = props.clusters.find((c) => c.clusterId === props.selectedClusterId);
    if (selected && selected.ring.length >= 3) {
      selected.ring.forEach(([lng, lat]) => bounds.extend([lat, lng]));
    } else if ((props.focus?.length ?? 0) > 0) {
      const near = L.latLngBounds(props.focus!);
      bounds.extend([near.getSouth() - .0065, near.getWest() - .0065]);
      bounds.extend([near.getNorth() + .0065, near.getEast() + .0065]);
      const closest = props.clusters.filter((c) => c.ring.length >= 3)
        .map((c) => L.latLngBounds(c.ring.map(([lng, lat]) => [lat, lng] as [number, number])))
        .sort((a, b) => near.getCenter().distanceTo(a.getCenter()) - near.getCenter().distanceTo(b.getCenter()))[0];
      if (closest) bounds.extend(closest);
    } else {
      props.clusters.forEach((c) => c.ring.forEach(([lng, lat]) => bounds.extend([lat, lng])));
      (props.routes ?? []).forEach((r) => {
        r.coordinates.forEach((p) => bounds.extend([p.latitude, p.longitude]));
        r.waypoints?.forEach((p) => bounds.extend([p.point.latitude, p.point.longitude]));
      });
      (props.tasks ?? []).forEach((task) => bounds.extend([task.point.latitude, task.point.longitude]));
    }
    if (!bounds.isValid()) return; // The first async payload has not arrived yet.
    instance.fitBounds(bounds, { padding: [24, 24], maxZoom: selected || props.focus?.length ? 15 : 14 });
    framedView.current = viewKey;
  }, [drawn, props.clusters, props.routes, props.tasks, props.selectedClusterId, props.focus, props.viewKey]);

  /** Redraw the markers. Separate from the shapes so toggling a layer does not refit the view. */
  useEffect(() => {
    if (!drawn || map.current === null) {
      return;
    }
    try {
      for (const kind of ['report', 'workOrder', 'savedLocation'] as const) {
        const layer = markerLayers.current[kind];
        if (layer === undefined) {
          continue;
        }
        layer.clearLayers();
        for (const m of markers) {
          if (m.kind === kind) markerObjects.current.delete(m.id);
        }
        if (hidden[kind] === true) {
          continue;
        }
        for (const marker of markers.filter((m) => m.kind === kind)) {
          const visual = getMarkerVisual(marker);
          const icon = L.divIcon({
            className: 'custom-map-pin',
            html: `<div class="map-pest-pin kind-${marker.kind} pest-${marker.pestType ?? marker.title}">
              <span class="map-pest-symbol" aria-hidden="true">${visual.emoji}</span>
            </div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -18],
          });

          const popupHtml = `<div class="map-popup-card">
                 <div class="map-popup-header">
                   <span class="map-popup-badge ${marker.kind}">${escapeHtml(visual.label)}</span>
                   <span class="map-popup-emoji">${visual.emoji}</span>
                 </div>
                 <strong class="map-popup-title">${escapeHtml(marker.title)}</strong>
                 <div class="map-popup-detail">${escapeHtml(marker.detail)}</div>
                 ${
                   marker.kind === 'report'
                     ? `<div class="map-popup-actions"><a href="/reports/${escapeHtml(marker.id)}" class="map-popup-action-btn" data-marker-kind="report" data-marker-id="${escapeHtml(marker.id)}">View full report details →</a></div>`
                     : marker.kind === 'workOrder'
                     ? `<div class="map-popup-actions"><a href="/ops/work-orders/${escapeHtml(marker.id)}" class="map-popup-action-btn" data-marker-kind="workOrder" data-marker-id="${escapeHtml(marker.id)}">View work order →</a></div>`
                     : ''
                 }
               </div>`;

          const mapMarker = L.marker([marker.latitude, marker.longitude], { icon })
            .bindPopup(popupHtml)
            .addTo(layer);
          markerObjects.current.set(marker.id, mapMarker);

          if (props.onSelectMarker !== undefined) {
            mapMarker.on('dblclick', () => props.onSelectMarker?.(marker));
          }
        }
      }
    } catch {
      setFailed(true);
    }
  }, [drawn, markers, hidden, props.onSelectMarker]);

  /** A list card asked for its marker: centre on it and open the popup. */
  useEffect(() => {
    const target = props.focusRequest;
    const instance = map.current;
    if (!drawn || !target || instance === null) {
      return;
    }
    const found = markerObjects.current.get(target.id);
    if (found !== undefined) {
      instance.setView(found.getLatLng(), Math.max(instance.getZoom(), 15));
      found.openPopup();
    }
  }, [drawn, props.focusRequest]);

  /** Intercept clicks on .map-popup-action-btn to trigger client routing or onSelectMarker. */
  useEffect(() => {
    const el = container.current;
    if (!el) {
      return;
    }
    const handleActionClick = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('.map-popup-action-btn');
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        const markerId = btn.getAttribute('data-marker-id');
        const href = btn.getAttribute('href');
        if (markerId && props.onSelectMarker) {
          const found = markers.find((m) => m.id === markerId);
          if (found) {
            props.onSelectMarker(found);
            return;
          }
        }
        if (href) {
          window.history.pushState({}, '', href);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      }
    };
    el.addEventListener('click', handleActionClick);
    return () => el.removeEventListener('click', handleActionClick);
  }, [markers, props.onSelectMarker]);

  /** 9.1.7 — recentre on everything, for a user who has panned away and wants back. */
  function resetView(): void {
    const instance = map.current;
    if (instance === null) {
      return;
    }
    const bounds = L.latLngBounds([]);
    for (const task of props.tasks ?? []) bounds.extend([task.point.latitude, task.point.longitude]);
    for (const route of props.routes ?? []) {
      for (const point of route.coordinates) bounds.extend([point.latitude, point.longitude]);
      for (const waypoint of route.waypoints ?? []) bounds.extend([waypoint.point.latitude, waypoint.point.longitude]);
    }
    for (const cluster of props.clusters) {
      for (const [lng, lat] of cluster.ring) {
        bounds.extend([lat, lng]);
      }
    }
    if (bounds.isValid()) {
      instance.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });
    } else {
      instance.setView(SINGAPORE_CENTRE, 11);
    }
  }

  const tiersPresent = props.clusters.length === 0 ? [] : ['Critical', 'High', 'Medium', 'Low'];

  return (
    <div className="map" data-part={props.label}>
      <div className="map-toolbar">
        {/* 9.1.6 — the layer switches, and only for layers this caller actually received. */}
        {kinds.map((kind) => (
          <label key={kind} className="map-toggle">
            <input
              type="checkbox"
              checked={hidden[kind] !== true}
              onChange={(event) =>
                setHidden((previous) => ({ ...previous, [kind]: !event.target.checked }))
              }
            />
            <span className="map-swatch" data-kind={kind} aria-hidden="true" />
            {MARKER_NAMES[kind]}
          </label>
        ))}
        <button type="button" onClick={resetView} disabled={!drawn}>
          Fit to map
        </button>
      </div>

      {/*
        * `role="application"` rather than `img`: the arrow keys pan and +/- zoom, and telling a
        * screen reader it is an image would take those away. The description points at the list,
        * which is where the same information is readable.
        */}
      <div
        ref={container}
        className="map-canvas"
        data-size={props.size ?? 'tall'}
        data-basemap={props.basemap ?? 'Grey_HD'}
        role="application"
        aria-label={`${props.tasks !== undefined ? `Dispatch tasks map. ${props.tasks.length} task(s).` : `Map of active dengue clusters. ${props.clusters.length} cluster(s).`} Arrow keys pan, plus and minus zoom.`}
        aria-describedby={legendId}
      />

      <p id={legendId} className="map-legend">
        {/* 9.1.11, 11.7.5 — the key, in words. A colour-blind reader and a printout both get this. */}
        {tiersPresent.length === 0 && props.tasks === undefined ? 'No cluster boundaries to draw.' : null}
        {tiersPresent.map((tier) => (
          <span key={tier} className="map-key" data-tier={tier}>
            <span className="map-swatch" data-tier={tier} aria-hidden="true" />
            {tier} priority
          </span>
        ))}
        <span className="map-attribution">Map data: OneMap © Singapore Land Authority</span>
      </p>

      {failed ? (
        // 10.5.3 — a cause and a remedy, and never a blank rectangle.
        <p role="status" data-part="map-unavailable">
          {props.tasks !== undefined ? 'The map could not be drawn on this device. Open task details below.' : 'The map could not be drawn on this device. Every cluster is listed below.'}
        </p>
      ) : null}
    </div>
  );
}
