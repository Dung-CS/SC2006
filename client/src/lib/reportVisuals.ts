export interface SamplePhotoOption {
  id: string;
  name: string;
  type: string;
  url: string;
  filename: string;
  sizeBytes: number;
  contentType: string;
  storageKey: string;
  description: string;
}

/**
 * Authentic sample evidence photos available for 1-click attachment during reporting.
 */
export const SAMPLE_REPORT_PHOTOS: SamplePhotoOption[] = [
  {
    id: 'sample-python-snake',
    name: '🐍 Reticulated Python (Drain)',
    type: 'BlockedDrain',
    url: '/visuals/pests/reticulated-python-snake.jpg',
    filename: 'evidence-reticulated-python-snake.jpg',
    sizeBytes: 3085676,
    contentType: 'image/jpeg',
    storageKey: 'evidence-reticulated-python-snake-sample.jpg',
    description: 'Reticulated python coiled along residential perimeter storm drain',
  },
  {
    id: 'sample-brown-rat',
    name: 'Brown rat',
    type: 'UnclearedRefuse',
    url: '/visuals/pests/rattus-norvegicus-brown-rat.jpg',
    filename: 'evidence-brown-rat.jpg',
    sizeBytes: 4479232,
    contentType: 'image/jpeg',
    storageKey: 'evidence-brown-rat-sample.jpg',
    description: 'Brown rat reference photograph',
  },
  {
    id: 'sample-house-crow',
    name: 'House crow',
    type: 'UnclearedRefuse',
    url: '/visuals/pests/corvus-splendens-house-crow-singapore.webp',
    filename: 'evidence-house-crow.webp',
    sizeBytes: 12656,
    contentType: 'image/webp',
    storageKey: 'evidence-house-crow-sample.webp',
    description: 'House crow reference photograph',
  },
  {
    id: 'sample-cockroach-refuse',
    name: 'German cockroach',
    type: 'UnclearedRefuse',
    url: '/visuals/pests/blattella-germanica-german-cockroach.jpg',
    filename: 'evidence-german-cockroach-chute.jpg',
    sizeBytes: 1040309,
    contentType: 'image/jpeg',
    storageKey: 'evidence-german-cockroach-sample.jpg',
    description: 'German cockroach reference photograph',
  },
  {
    id: 'sample-wasp-nest',
    name: 'Hornet/wasp reference',
    type: 'Other',
    url: '/visuals/pests/asian-hornet-wasp.webp',
    filename: 'evidence-asian-hornet-wasp-nest.webp',
    sizeBytes: 116700,
    contentType: 'image/webp',
    storageKey: 'evidence-asian-hornet-wasp-sample.webp',
    description: 'Hornet/wasp reference photograph',
  },
  {
    id: 'sample-standing-water',
    name: 'Standing water',
    type: 'StandingWater',
    url: '/visuals/reports/standing-water.webp',
    filename: 'evidence-standing-water.jpg',
    sizeBytes: 143360,
    contentType: 'image/jpeg',
    storageKey: 'evidence-standing-water-sample.jpg',
    description: 'Standing water reference photograph',
  },
  {
    id: 'sample-blocked-drain',
    name: '🌧️ Blocked Storm Drain',
    type: 'BlockedDrain',
    url: '/visuals/reports/blocked-drain.webp',
    filename: 'evidence-blocked-drain.jpg',
    sizeBytes: 218112,
    contentType: 'image/jpeg',
    storageKey: 'evidence-blocked-drain-sample.jpg',
    description: 'Perimeter concrete drain blocked with leaves and stagnant water',
  },
];

/**
 * Map report condition type and optional pest type to its authentic photo URL.
 */
export function reportPhotoUrl(type: string, pestType?: string): string {
  if (pestType) {
    switch (pestType) {
      case 'Rat':
        return '/visuals/pests/rattus-norvegicus-brown-rat.jpg';
      case 'Cockroach':
        return '/visuals/pests/blattella-germanica-german-cockroach.jpg';
      case 'Snake':
        return '/visuals/pests/reticulated-python-snake.jpg';
      case 'BeeWasp':
        return '/visuals/pests/asian-hornet-wasp.webp';
      case 'HouseCrow':
      case 'Pigeon':
      case 'JavanMyna':
        return '/visuals/pests/corvus-splendens-house-crow-singapore.webp';
    }
  }
  switch (type) {
    case 'StandingWater':
      return '/visuals/reports/standing-water.webp';
    case 'BlockedDrain':
      return '/visuals/reports/blocked-drain.webp';
    case 'UnclearedRefuse':
      return '/visuals/reports/uncleared-refuse.jpg';
    case 'OvergrownVegetation':
      return '/visuals/reports/overgrown-vegetation.webp';
    default:
      return '/visuals/reports/standing-water.webp';
  }
}

export interface ReportAttribution {
  title: string;
  author: string;
  license: string;
}

export function reportPhotoAttribution(type: string, pestType?: string): ReportAttribution {
  if (pestType) {
    switch (pestType) {
      case 'Rat':
        return {
          title: 'Brown rat (Rattus norvegicus) foraging in urban environment',
          author: 'Wikimedia Commons / CC BY-SA 4.0',
          license: 'CC BY-SA 4.0',
        };
      case 'Cockroach':
        return {
          title: 'German cockroach (Blattella germanica) in drainage structure',
          author: 'CDC Public Health Image Library / Public Domain',
          license: 'Public Domain',
        };
      case 'Snake':
        return {
          title: 'Reticulated python (Malayopython reticulatus) in park verge',
          author: 'Wikimedia Commons / CC BY-SA 4.0',
          license: 'CC BY-SA 4.0',
        };
      case 'BeeWasp':
        return {
          title: 'Asian hornet / wasp nest in urban tree canopy',
          author: 'Wikimedia Commons / CC BY-SA 4.0',
          license: 'CC BY-SA 4.0',
        };
      case 'HouseCrow':
      case 'Pigeon':
      case 'JavanMyna':
        return {
          title: 'House crow / feral pigeon congregation in municipal estate',
          author: 'Wikimedia Commons / CC BY-SA 4.0',
          license: 'CC BY-SA 4.0',
        };
    }
  }
  switch (type) {
    case 'BlockedDrain':
      return {
        title: 'Concrete street drain blocked by debris and silt',
        author: 'Flickr / CC BY 2.0',
        license: 'CC BY 2.0',
      };
    case 'UnclearedRefuse':
      return {
        title: 'Roadside litter and discarded beverage containers holding rainwater',
        author: 'Wikimedia Commons / CC BY-SA 4.0',
        license: 'CC BY-SA 4.0',
      };
    case 'OvergrownVegetation':
      return {
        title: 'Dense unmaintained grass and pooled stormwater',
        author: 'Flickr / CC BY 2.0',
        license: 'CC BY 2.0',
      };
    case 'StandingWater':
    default:
      return {
        title: 'Stagnant water trapped in outdoor receptacle with visible larvae',
        author: 'CDC Public Health Image Library / Public Domain',
        license: 'Public Domain',
      };
  }
}
