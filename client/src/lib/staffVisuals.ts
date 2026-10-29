/**
 * D-Fence — staff profile photo visual resolver.
 * Maps staff emails and roles deterministically to authentic portrait assets.
 */

export interface StaffVisual {
  email: string;
  url: string;
  name: string;
}

const CREW_PHOTOS = [
  '/visuals/staff/crew-ahseng.jpg',
  '/visuals/staff/crew-ravi.jpg',
  '/visuals/staff/crew-muthu.jpg',
  '/visuals/staff/crew-siti.jpg',
  '/visuals/staff/crew-john.jpg',
  '/visuals/staff/crew-shots.jpg',
];

export function staffPhotoUrl(email: string, role?: string): string {
  const clean = (email || '').toLowerCase().trim();
  if (clean.includes('ychow') || clean.includes('yenkit')) {
    return '/visuals/staff/manager-ychow.jpg';
  }
  if (clean.includes('manager')) {
    return '/visuals/staff/manager-default.jpg';
  }
  if (clean.includes('seng')) {
    return '/visuals/staff/crew-ahseng.jpg';
  }
  if (clean.includes('ravi')) {
    return '/visuals/staff/crew-ravi.jpg';
  }
  if (clean.includes('muthu')) {
    return '/visuals/staff/crew-muthu.jpg';
  }
  if (clean.includes('siti')) {
    return '/visuals/staff/crew-siti.jpg';
  }
  if (clean.includes('john')) {
    return '/visuals/staff/crew-john.jpg';
  }
  if (clean.includes('shots')) {
    return '/visuals/staff/crew-shots.jpg';
  }

  if (role === 'OperationsManager') {
    return '/visuals/staff/manager-default.jpg';
  }

  // Deterministic mapping by email string
  let hash = 0;
  for (let i = 0; i < clean.length; i += 1) {
    hash = (hash << 5) - hash + clean.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % CREW_PHOTOS.length;
  return CREW_PHOTOS[idx] ?? '/visuals/staff/crew-ravi.jpg';
}

/** Formats an email into a friendly staff display name */
export function staffDisplayName(email: string, role?: string): string {
  const clean = (email || '').split('@')[0] ?? '';
  if (clean.toLowerCase().includes('ychow')) {
    return 'Chow Yen Kit';
  }
  if (!clean || /\d/.test(clean) || /^(?:demo|walkthrough|uat|test|crew|staff|manager)(?:[-_.]|$)/i.test(clean) || /(?:^|[-_.])demo(?:[-_.]|$)/i.test(clean)) {
    return staffRoleLocationLabel(role ?? 'CleaningCrew');
  }
  return clean
    .split(/[._-]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function staffRoleLocationLabel(role?: string, location?: string | null): string {
  const roleLabel = role === 'OperationsManager' ? 'Operations manager' : role === 'CleaningCrew' ? 'Field crew' : 'Staff';
  const locationLabel = location?.replace(/([a-z])([A-Z])/g, '$1 $2') ?? '';
  return locationLabel ? `${roleLabel} · ${locationLabel}` : roleLabel;
}

// Capability is not derived here. It is `Account.specialisation`, recorded by a manager and
// labelled by `dispatchRouting.ts`; a portrait chosen from an email is cosmetic, a skill is not.
