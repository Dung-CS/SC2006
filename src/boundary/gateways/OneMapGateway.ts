/**
 * D-Fence — OneMapGateway (Adapter).
 * Stereotype: <<boundary>>. Traces: 3.1.3, 3.1.14–3.1.17, 8.1.x.
 *
 * **Verified live 2026-09-03.** `GET /api/common/elastic/search?searchVal=…&returnGeom=Y&getAddrDetails=Y`
 * with the token in the `Authorization` header returns `{found, totalNumPages, pageNum, results[]}`,
 * each result carrying LATITUDE and LONGITUDE **as strings**. An unmatched address is `found: 0`
 * with an empty array, not an error — so "no such address" and "the service is down" are different
 * outcomes here, and only the second one throws.
 *
 * Tokens last three days (3.1.14). The account credentials mint one at
 * `POST /api/auth/post/getToken`; a token supplied through configuration is used as-is until it
 * expires, which is how the team can work from a pasted token before the credentials are shared.
 */
import { GeocodeCandidate, GeocodingSource } from '../../ports/ExternalGateway';
import { HttpClient } from './HttpClient';
import { SourceKind } from '../../entity/enums';
import { GeoPoint } from '../../entity/valueTypes';

interface SearchResponse {
  found?: number;
  results?: Array<{ LATITUDE?: string; LONGITUDE?: string; ADDRESS?: string; POSTAL?: string; SEARCHVAL?: string }>;
}

interface TokenResponse {
  access_token?: string;
  expiry_timestamp?: string | number;
}

interface DrivingRouteResponse {
  route_geometry?: unknown;
  route_summary?: { total_distance?: number; total_time?: number };
}

export interface DrivingRouteLeg {
  coordinates: GeoPoint[];
  distanceMetres: number;
  durationSeconds: number;
}

function decodePolyline(encoded: string, precision = 5): GeoPoint[] {
  const factor = 10 ** precision;
  let index = 0, lat = 0, lng = 0;
  const points: GeoPoint[] = [];
  while (index < encoded.length) {
    let b = 0, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : result >> 1;
    points.push(new GeoPoint(lat / factor, lng / factor));
  }
  return points;
}

export interface OneMapCredentials {
  email: string;
  password: string;
}

export class OneMapGateway implements GeocodingSource {
  constructor(
    private readonly http: HttpClient,
    private readonly baseUrl = 'https://www.onemap.gov.sg',
    token: string | null = null,
    private readonly credentials: OneMapCredentials | null = null,
  ) {
    this.token = token;
    // A token pasted into configuration carries its own expiry in the JWT. Read it rather than
    // assuming three days from now: a token minted on Monday and pasted on Wednesday has one day
    // left, and assuming otherwise turns a refresh into a run of 401s mid-demo.
    this.tokenExpiry = token === null ? null : OneMapGateway.expiryOf(token);
  }

  private token: string | null;
  private tokenExpiry: Date | null;

  /**
   * When the held token expires, or null before one has been obtained.
   *
   * The expiry, deliberately, and never the token itself: 3.1.16's source-health panel and the
   * renewal check both need to say how long is left, and neither needs the credential. A getter
   * that returned the token would put it one careless `console.log` away from a shared screen.
   */
  tokenExpiresAt(): Date | null {
    return this.tokenExpiry;
  }

  sourceKind(): SourceKind {
    return SourceKind.Geocoding;
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.search('Orchard Road');
      return true;
    } catch {
      return false;
    }
  }

  /** 3.1.14 — mint a token from the account credentials. */
  async requestToken(): Promise<void> {
    if (this.credentials === null) {
      throw new Error('no OneMap credentials configured; set ONE_MAP_EMAIL and ONE_MAP_PASSWORD');
    }
    const res = await this.http.post(`${this.baseUrl}/api/auth/post/getToken`, this.credentials, {
      attempts: 2,
    });
    if (!res.ok) {
      throw new Error(`OneMap token request failed: ${res.status}`);
    }
    const body = (await res.json()) as TokenResponse;
    if (!body.access_token) {
      throw new Error('OneMap token response carried no access_token');
    }
    this.token = body.access_token;
    this.tokenExpiry =
      body.expiry_timestamp === undefined
        ? OneMapGateway.expiryOf(body.access_token)
        : new Date(Number(body.expiry_timestamp) * 1000);
  }

  /**
   * 3.1.15 — refresh before use rather than after a failure. The margin is an hour: a token that
   * expires mid-request produces a 401 the user sees, and the refresh costs one call every few days.
   */
  private async ensureToken(): Promise<void> {
    const marginMs = 60 * 60 * 1000;
    const expired = this.tokenExpiry === null || this.tokenExpiry.getTime() - Date.now() < marginMs;
    if (this.token === null || expired) {
      await this.requestToken();
    }
  }

  /**
   * 3.1.3 — resolve an address to coordinates.
   * @returns every match, in OneMap's own ranking order; empty when the address does not exist.
   */
  async search(address: string): Promise<GeocodeCandidate[]> {
    await this.ensureToken();
    const url =
      `${this.baseUrl}/api/common/elastic/search` +
      `?searchVal=${encodeURIComponent(address)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
    const res = await this.http.get(url, {
      headers: { Authorization: this.token as string },
      attempts: 2,
    });
    if (res.status === 401) {
      // 3.1.16: one forced refresh, then give up. Retrying a bad credential in a loop locks accounts.
      await this.requestToken();
      return this.search(address);
    }
    if (!res.ok) {
      throw new Error(`OneMap search failed: ${res.status}`);
    }
    const body = (await res.json()) as SearchResponse;
    return (body.results ?? [])
      .filter((r) => r.LATITUDE !== undefined && r.LONGITUDE !== undefined)
      .map((r) => ({
        point: new GeoPoint(Number(r.LATITUDE), Number(r.LONGITUDE)),
        // Live payloads carry SEARCHVAL for the matched name and ADDRESS for the full one; either
        // may be absent, and a candidate with no readable label cannot satisfy 3.1.4.
        address: r.ADDRESS ?? r.SEARCHVAL ?? 'unnamed location',
        postalCode: r.POSTAL === undefined || r.POSTAL === 'NIL' ? null : r.POSTAL,
      }));
  }

  /** Fetch one driving leg. A malformed or unavailable response throws so the strategy can fall back. */
  async drivingRoute(start: GeoPoint, end: GeoPoint): Promise<DrivingRouteLeg> {
    await this.ensureToken();
    const query = new URLSearchParams({
      start: `${start.latitude},${start.longitude}`,
      end: `${end.latitude},${end.longitude}`,
      routeType: 'drive',
    });
    const res = await this.http.get(`${this.baseUrl}/api/public/routingsvc/route?${query}`, {
      headers: { Authorization: this.token as string }, attempts: 2,
    });
    if (res.status === 401) {
      await this.requestToken();
      return this.drivingRoute(start, end);
    }
    if (!res.ok) throw new Error(`OneMap driving route failed: ${res.status}`);
    const body = (await res.json()) as DrivingRouteResponse;
    const raw = body.route_geometry;
    let coordinates: GeoPoint[] = [];
    if (Array.isArray(raw)) {
      coordinates = raw.map((pair) => {
        const values = Array.isArray(pair) ? pair : [];
        return new GeoPoint(Number(values[0]), Number(values[1]));
      });
    } else if (typeof raw === 'string') {
      const isPipe = raw.includes('|') && raw.includes(',') && !/[A-Za-z]/.test(raw.slice(0, 30));
      if (isPipe) {
        coordinates = raw.split('|').map((pair) => pair.split(',').map(Number)).filter((pair) => pair.length === 2 && pair.every(Number.isFinite)).map(([lat, lon]) => new GeoPoint(lat!, lon!));
      } else if (raw.startsWith('[') && raw.endsWith(']')) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) coordinates = parsed.map((pair) => new GeoPoint(Number(pair[0]), Number(pair[1])));
        } catch {
          coordinates = decodePolyline(raw);
        }
      } else {
        coordinates = decodePolyline(raw);
      }
    }
    if (!coordinates.length || coordinates.some((p) => !Number.isFinite(p.latitude) || !Number.isFinite(p.longitude))) {
      throw new Error('OneMap driving route returned invalid geometry');
    }
    const distanceMetres = Number(body.route_summary?.total_distance);
    const durationSeconds = Number(body.route_summary?.total_time);
    if (!Number.isFinite(distanceMetres) || !Number.isFinite(durationSeconds)) throw new Error('OneMap driving route omitted distance or duration');
    return { coordinates, distanceMetres, durationSeconds };
  }

  /** Reads `exp` out of the JWT without verifying it — this is scheduling, not authentication. */
  private static expiryOf(token: string): Date | null {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    const claims = parts[1];
    if (claims === undefined) {
      return null;
    }
    try {
      const payload = JSON.parse(Buffer.from(claims, 'base64').toString('utf8')) as { exp?: number };
      return payload.exp === undefined ? null : new Date(payload.exp * 1000);
    } catch {
      return null;
    }
  }
}
