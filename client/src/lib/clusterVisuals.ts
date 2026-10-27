import { CarouselPhoto } from '../components/PhotoCarousel';

export type HabitatKey = 'drain' | 'voidDeck' | 'garden' | 'construction' | 'vector' | 'standingWater';

/**
 * Authentic Singapore estate and breeding habitat visual bank for dengue clusters.
 */
export const CLUSTER_HABITAT_PHOTOS: Record<HabitatKey, CarouselPhoto> = {
  drain: {
    url: '/visuals/reports/blocked-drain.webp',
    alt: 'Perimeter concrete apron drain inspection along estate blocks',
    caption: 'Perimeter storm drain — inspected for silt and stagnant water accumulation',
    tag: 'Drainage',
  },
  standingWater: {
    url: '/visuals/reports/standing-water.webp',
    alt: 'Discarded receptacles and stagnant water accumulation survey',
    caption: 'Ground receptacle survey — potential vector breeding site',
    tag: 'Breeding Site',
  },
  voidDeck: {
    url: '/visuals/clusters/void-deck-compound.jpg',
    alt: 'Singapore HDB void deck and ground compound inspection',
    caption: 'Estate ground survey — common area and void deck perimeter',
    tag: 'Grounds',
  },
  garden: {
    url: '/visuals/clusters/residential-garden.jpg',
    alt: 'Residential potted plant corridor and garden area inspection',
    caption: 'Plant saucer & domestic container surveillance',
    tag: 'Domestic',
  },
  construction: {
    url: '/visuals/clusters/construction-site.jpg',
    alt: 'Active construction building site and excavation drainage',
    caption: 'Silt trap and excavation water accumulation inspection',
    tag: 'Construction',
  },
  vector: {
    url: '/visuals/pests/aedes-mosquito.jpg',
    alt: 'Aedes mosquito vector identification reference',
    caption: 'Aedes aegypti vector surveillance zone',
    tag: 'Vector Ref',
  },
};

/**
 * Return a carousel photo set tailored to the cluster's locality and priority tier.
 */
export function getClusterPhotos(cluster: {
  clusterId?: string;
  locality?: string;
  tier?: string;
  caseSize?: number;
  pestType?: string;
}): CarouselPhoto[] {
  if (cluster.pestType && cluster.pestType !== 'Mosquito') {
    switch (cluster.pestType) {
      case 'Rat':
        return [
          { url: '/visuals/pests/rattus-norvegicus-brown-rat.jpg', alt: 'Brown rat vector specimen', caption: 'Brown rat (Rattus norvegicus) urban activity survey', tag: 'Surveillance' },
          CLUSTER_HABITAT_PHOTOS.voidDeck,
          CLUSTER_HABITAT_PHOTOS.drain,
        ];
      case 'Snake':
        return [
          { url: '/visuals/pests/reticulated-python-snake.jpg', alt: 'Reticulated python specimen', caption: 'Reticulated python perimeter drainage survey', tag: 'Surveillance' },
          CLUSTER_HABITAT_PHOTOS.drain,
          CLUSTER_HABITAT_PHOTOS.garden,
        ];
      case 'Cockroach':
        return [
          { url: '/visuals/pests/blattella-germanica-german-cockroach.jpg', alt: 'German cockroach specimen', caption: 'Cockroach refuse chute and domestic perimeter inspection', tag: 'Surveillance' },
          CLUSTER_HABITAT_PHOTOS.voidDeck,
          CLUSTER_HABITAT_PHOTOS.standingWater,
        ];
      case 'BeeWasp':
        return [
          { url: '/visuals/pests/asian-hornet-wasp.webp', alt: 'Asian hornet specimen', caption: 'Hornet/wasp nest vegetation and corridor inspection', tag: 'Surveillance' },
          CLUSTER_HABITAT_PHOTOS.garden,
          CLUSTER_HABITAT_PHOTOS.voidDeck,
        ];
      case 'Pigeon':
      case 'HouseCrow':
      case 'JavanMyna':
        return [
          { url: '/visuals/pests/corvus-splendens-house-crow-singapore.webp', alt: 'Urban bird surveillance', caption: 'Avian flocking and municipal fouling survey zone', tag: 'Surveillance' },
          CLUSTER_HABITAT_PHOTOS.voidDeck,
          CLUSTER_HABITAT_PHOTOS.standingWater,
        ];
    }
  }

  const loc = (cluster.locality ?? '').toLowerCase();
  const idStr = cluster.clusterId ?? cluster.locality ?? '';
  let hash = 0;
  for (let i = 0; i < idStr.length; i++) {
    hash = (hash * 31 + idStr.charCodeAt(i)) >>> 0;
  }

  // Tailor photo selection based on locality keywords if applicable
  if (loc.includes('construction') || loc.includes('industrial') || loc.includes('road')) {
    return [
      CLUSTER_HABITAT_PHOTOS.construction,
      CLUSTER_HABITAT_PHOTOS.drain,
      CLUSTER_HABITAT_PHOTOS.standingWater,
      CLUSTER_HABITAT_PHOTOS.vector,
    ];
  }

  if (loc.includes('landed') || loc.includes('crescent') || loc.includes('park') || loc.includes('gardens')) {
    return [
      CLUSTER_HABITAT_PHOTOS.garden,
      CLUSTER_HABITAT_PHOTOS.standingWater,
      CLUSTER_HABITAT_PHOTOS.drain,
      CLUSTER_HABITAT_PHOTOS.vector,
    ];
  }

  // Diverse rotation for HDB clusters so adjacent cards have different authentic lead photos
  const leadRotations = [
    [CLUSTER_HABITAT_PHOTOS.voidDeck, CLUSTER_HABITAT_PHOTOS.standingWater, CLUSTER_HABITAT_PHOTOS.drain, CLUSTER_HABITAT_PHOTOS.vector],
    [CLUSTER_HABITAT_PHOTOS.drain, CLUSTER_HABITAT_PHOTOS.voidDeck, CLUSTER_HABITAT_PHOTOS.standingWater, CLUSTER_HABITAT_PHOTOS.vector],
    [CLUSTER_HABITAT_PHOTOS.standingWater, CLUSTER_HABITAT_PHOTOS.voidDeck, CLUSTER_HABITAT_PHOTOS.garden, CLUSTER_HABITAT_PHOTOS.vector],
    [CLUSTER_HABITAT_PHOTOS.garden, CLUSTER_HABITAT_PHOTOS.drain, CLUSTER_HABITAT_PHOTOS.voidDeck, CLUSTER_HABITAT_PHOTOS.vector],
  ];

  return leadRotations[hash % leadRotations.length] ?? leadRotations[0]!;
}
