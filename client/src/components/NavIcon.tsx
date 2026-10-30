/**
 * D-Fence — the navigation glyphs.
 * Stereotype: <<boundary>>. Traces: 11.1.1–11.1.4, 11.7.5, 11.8.x.
 *
 * Every navigation item draws an 18×18 stroked glyph beside its label (22×22 above it on a phone).
 * The glyphs come from lucide-react, by named import only, so the bundle carries just these icons.
 *
 * **The glyph is never the label.** 11.7.5 forbids carrying meaning in appearance alone, and an
 * icon is exactly that. Every item renders its word too; `aria-hidden` here says so to a screen
 * reader, which would otherwise announce a decorative shape between two useful ones. The bottom
 * bar on a phone shrinks the word, it does not drop it.
 *
 * Lucide strokes with `currentColor`, so the active/inactive colouring is decided once in the
 * stylesheet by the same rule that colours the label, and the two can never disagree.
 */
import {
  Bell,
  BriefcaseBusiness,
  ChartColumn,
  ClipboardList,
  Database,
  FileText,
  LayoutGrid,
  Map as MapIcon,
  MapPin,
  Route,
  ShieldCheck,
  Square,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react';

/** The glyphs, keyed by the `screenId` the route table already uses. */
const ICONS: Record<string, LucideIcon> = {
  // — Resident —
  ResidentMap: MapIcon,
  MyLocations: MapPin,
  MyReports: FileText,
  AlertSettings: Bell,

  // — Operations —
  OpsDashboard: LayoutGrid,
  Analytics: ChartColumn,
  ModQueue: ShieldCheck,
  DispatchProposal: Route,
  WOList: ClipboardList,
  StaffAccounts: Users,
  DataSources: Database,
  VehicleRegistry: Truck,

  // — Crew —
  MyJobs: BriefcaseBusiness,
};

export interface NavIconProps {
  screenId: string;
}

export function NavIcon(props: NavIconProps): JSX.Element {
  // The fallback: a plain square, so an unmapped screen still lines up rather than collapsing.
  const Icon = ICONS[props.screenId] ?? Square;
  // Decorative: the label beside it carries the meaning (11.7.5).
  return <Icon className="nav-icon" size={22} strokeWidth={1.5} aria-hidden="true" focusable="false" />;
}
