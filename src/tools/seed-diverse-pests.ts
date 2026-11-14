/**
 * D-Fence — seed authentic non-mosquito pest reports across Singapore.
 *
 * Populates realistic citizen reports for Rats, Cockroaches, Snakes,
 * Bees/Wasps, Crows, Pigeons, Wild Boars, and Macaques.
 *
 *     npx tsx src/tools/seed-diverse-pests.ts
 */
import { randomUUID } from 'node:crypto';
import { ConfigLoader } from '../config/ConfigLoader';
import { Database } from '../persistence/Database';

interface SeedPestReport {
  id: string;
  pestType: string;
  type: string;
  status: 'Verified' | 'Submitted' | 'Actioned';
  locality: string;
  lat: number;
  lng: number;
  corroborations: number;
  locationContext?: 'Indoor' | 'Outdoor';
  injuryReported?: boolean;
  description: string;
  photoKey: string;
  photoSizeBytes: number;
}

const SEED_REPORTS: SeedPestReport[] = [
  // --- RODENTS (Rat) ---
  {
    id: 'f1000001-0000-4000-8000-000000000001',
    pestType: 'Rat',
    type: 'UnclearedRefuse',
    status: 'Verified',
    locality: 'Chinatown / Kreta Ayer',
    lat: 1.2845,
    lng: 103.8432,
    corroborations: 6,
    locationContext: 'Outdoor',
    injuryReported: false,
    description: 'Active brown rat burrowing and foraging observed near commercial bin centre and perimeter drain culvert.',
    photoKey: 'evidence-rat-chinatown-f1000001.jpg',
    photoSizeBytes: 4479232,
  },
  {
    id: 'f1000001-0000-4000-8000-000000000002',
    pestType: 'Rat',
    type: 'BlockedDrain',
    status: 'Verified',
    locality: 'Toa Payoh Central',
    lat: 1.3325,
    lng: 103.8488,
    corroborations: 4,
    locationContext: 'Outdoor',
    injuryReported: false,
    description: 'Rats sighted emerging from silted roadside storm drain grating adjacent to food centre loading bay.',
    photoKey: 'evidence-rat-toapayoh-f1000002.jpg',
    photoSizeBytes: 4479232,
  },
  {
    id: 'f1000001-0000-4000-8000-000000000003',
    pestType: 'Rat',
    type: 'UnclearedRefuse',
    status: 'Submitted',
    locality: 'Geylang Serai Market',
    lat: 1.3168,
    lng: 103.8982,
    corroborations: 2,
    locationContext: 'Outdoor',
    injuryReported: false,
    description: 'Litter and food scrap spillage attracting rodent activity along market service alley.',
    photoKey: 'evidence-rat-geylang-f1000003.jpg',
    photoSizeBytes: 4479232,
  },

  // --- INSECTS (Cockroach) ---
  {
    id: 'f1000001-0000-4000-8000-000000000004',
    pestType: 'Cockroach',
    type: 'BlockedDrain',
    status: 'Verified',
    locality: 'Little India / Buffalo Road',
    lat: 1.3068,
    lng: 103.8516,
    corroborations: 5,
    locationContext: 'Outdoor',
    injuryReported: false,
    description: 'Dense German cockroach cluster inside perimeter inspection chamber and perimeter drain walls.',
    photoKey: 'evidence-cockroach-littleindia-f1000004.jpg',
    photoSizeBytes: 1040309,
  },
  {
    id: 'f1000001-0000-4000-8000-000000000005',
    pestType: 'Cockroach',
    type: 'UnclearedRefuse',
    status: 'Verified',
    locality: 'Bedok North Street 3',
    lat: 1.3312,
    lng: 103.9295,
    corroborations: 3,
    locationContext: 'Outdoor',
    injuryReported: false,
    description: 'Cockroach infestation around refuse chute hopper and ground-floor collection chamber.',
    photoKey: 'evidence-cockroach-bedok-f1000005.jpg',
    photoSizeBytes: 1040309,
  },
  {
    id: 'f1000001-0000-4000-8000-000000000006',
    pestType: 'Cockroach',
    type: 'BlockedDrain',
    status: 'Submitted',
    locality: 'Jurong West Street 52',
    lat: 1.3418,
    lng: 103.7052,
    corroborations: 1,
    locationContext: 'Outdoor',
    injuryReported: false,
    description: 'Multiple cockroaches emerging from drain grates near wet market during evening.',
    photoKey: 'evidence-cockroach-jurong-f1000006.jpg',
    photoSizeBytes: 1040309,
  },

  // --- REPTILES (Snake / Reticulated Python) ---
  {
    id: 'f1000001-0000-4000-8000-000000000007',
    pestType: 'Snake',
    type: 'OvergrownVegetation',
    status: 'Verified',
    locality: 'Pasir Ris Park / Sungei Tampines',
    lat: 1.3785,
    lng: 103.9535,
    corroborations: 8,
    locationContext: 'Outdoor',
    injuryReported: false,
    description: 'Large reticulated python (~2.5m) resting in overgrown shrubs beside pedestrian park connector.',
    photoKey: 'evidence-snake-pasirris-f1000007.jpg',
    photoSizeBytes: 3085676,
  },
  {
    id: 'f1000001-0000-4000-8000-000000000008',
    pestType: 'Snake',
    type: 'BlockedDrain',
    status: 'Verified',
    locality: 'Kallang Riverside Park',
    lat: 1.3052,
    lng: 103.8655,
    corroborations: 4,
    locationContext: 'Outdoor',
    injuryReported: false,
    description: 'Python spotted swimming along canal drainage wall towards bridge abutment.',
    photoKey: 'evidence-snake-kallang-f1000008.jpg',
    photoSizeBytes: 3085676,
  },

  // --- HYMENOPTERA (Bee / Wasp / Hornet) ---
  {
    id: 'f1000001-0000-4000-8000-000000000009',
    pestType: 'BeeWasp',
    type: 'OvergrownVegetation',
    status: 'Verified',
    locality: 'Ang Mo Kio Avenue 4 (Bishan-AMK Park verge)',
    lat: 1.3665,
    lng: 103.8395,
    corroborations: 9,
    locationContext: 'Outdoor',
    injuryReported: false,
    description: 'Active Asian hornet / wasp nest suspended from roadside tree branch over footway.',
    photoKey: 'evidence-wasp-amk-f1000009.jpg',
    photoSizeBytes: 116700,
  },
  {
    id: 'f1000001-0000-4000-8000-000000000010',
    pestType: 'BeeWasp',
    type: 'Other',
    status: 'Verified',
    locality: 'Clementi West Street 1',
    lat: 1.3038,
    lng: 103.7682,
    corroborations: 3,
    locationContext: 'Outdoor',
    injuryReported: false,
    description: 'Wasp nest forming under multi-storey car park 2nd-storey concrete beam.',
    photoKey: 'evidence-wasp-clementi-f1000010.jpg',
    photoSizeBytes: 116700,
  },

  // --- BIRDS (House Crow & Pigeon) ---
  {
    id: 'f1000001-0000-4000-8000-000000000011',
    pestType: 'HouseCrow',
    type: 'UnclearedRefuse',
    status: 'Verified',
    locality: 'Hougang Central Bus Interchange',
    lat: 1.3712,
    lng: 103.8925,
    corroborations: 7,
    locationContext: 'Outdoor',
    injuryReported: false,
    description: 'Large congregation of house crows scavenging open waste bins; occasional territorial swooping.',
    photoKey: 'evidence-crow-hougang-f1000011.jpg',
    photoSizeBytes: 12656,
  },
  {
    id: 'f1000001-0000-4000-8000-000000000012',
    pestType: 'Pigeon',
    type: 'UnclearedRefuse',
    status: 'Verified',
    locality: 'Tampines Central 1',
    lat: 1.3528,
    lng: 103.9442,
    corroborations: 5,
    locationContext: 'Outdoor',
    injuryReported: false,
    description: 'Feral pigeon gathering around outdoor dining area; heavy droppings along corridor ledges.',
    photoKey: 'evidence-pigeon-tampines-f1000012.jpg',
    photoSizeBytes: 12656,
  },

  // --- WILDLIFE (Wild Boar & Macaque) ---
  {
    id: 'f1000001-0000-4000-8000-000000000013',
    pestType: 'WildBoar',
    type: 'OvergrownVegetation',
    status: 'Verified',
    locality: 'Bukit Panjang / Zhenghua Nature Park',
    lat: 1.3855,
    lng: 103.7712,
    corroborations: 6,
    locationContext: 'Outdoor',
    injuryReported: false,
    description: 'Sounder of wild boars foraging across park perimeter lawn near residential block 450.',
    photoKey: 'evidence-overgrown-puddle-boar-f1000013.jpg',
    photoSizeBytes: 96256,
  },
  {
    id: 'f1000001-0000-4000-8000-000000000014',
    pestType: 'Macaque',
    type: 'UnclearedRefuse',
    status: 'Verified',
    locality: 'Bukit Timah / Hindhede Road',
    lat: 1.3482,
    lng: 103.7765,
    corroborations: 4,
    locationContext: 'Outdoor',
    injuryReported: false,
    description: 'Long-tailed macaques opening municipal bins along landed boundary road and scattering refuse.',
    photoKey: 'evidence-refuse-litter-macaque-f1000014.jpg',
    photoSizeBytes: 331776,
  },
];

async function main(): Promise<void> {
  const url = ConfigLoader.load().get('DATABASE_URL');
  if (url === '') {
    console.log('DATABASE_URL is not set; skipping diverse pest database seeding.');
    return;
  }
  const db = new Database(url);
  try {
    console.log(`Seeding ${SEED_REPORTS.length} diverse pest reports across Singapore...`);
    let inserted = 0;

    for (const r of SEED_REPORTS) {
      // 1. Insert or update report
      await db.query(
        `INSERT INTO report (
           id, reporter_id, point, type, pest_type, location_context, injury_reported,
           description, status, cluster_id, locality_binding, corroboration_count,
           submitted_at, moderated_at, moderation_reason
         ) VALUES (
           $1, NULL, ST_MakePoint($3, $2)::geography, $4, $5, $6, $7,
           $8, $9, NULL, $10, $11,
           NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day', 'Verified by municipal officer'
         )
         ON CONFLICT (id) DO UPDATE SET
           pest_type = EXCLUDED.pest_type,
           type = EXCLUDED.type,
           status = EXCLUDED.status,
           description = EXCLUDED.description,
           point = EXCLUDED.point,
           locality_binding = EXCLUDED.locality_binding,
           corroboration_count = EXCLUDED.corroboration_count,
           location_context = EXCLUDED.location_context,
           injury_reported = EXCLUDED.injury_reported`,
        [
          r.id,
          r.lat,
          r.lng,
          r.type,
          r.pestType,
          r.locationContext ?? 'Outdoor',
          r.injuryReported ?? false,
          r.description,
          r.status,
          r.locality,
          r.corroborations,
        ],
      );

      // 2. Insert or update report_photo
      await db.query(
        `INSERT INTO report_photo (report_id, storage_key, content_type, size_bytes)
         VALUES ($1, $2, 'image/jpeg', $3)
         ON CONFLICT (storage_key) DO UPDATE SET
           report_id = EXCLUDED.report_id,
           size_bytes = EXCLUDED.size_bytes`,
        [r.id, r.photoKey, r.photoSizeBytes],
      );

      // 3. Record status history
      await db.query(
        `INSERT INTO report_status_change (report_id, from_status, to_status, changed_at)
         VALUES ($1, 'Submitted', $2, NOW() - INTERVAL '1 day')
         ON CONFLICT DO NOTHING`,
        [r.id, r.status],
      );

      inserted += 1;
    }

    console.log(`Successfully seeded ${inserted} authentic diverse pest reports with photographs.`);
  } finally {
    await db.close();
  }
}

void main();
