// "Neon cartography" Google Maps style — the map is Zorr's game board.
// Near-pure-black ground so territory glows read like light on a dark table;
// arterial roads carry a violet current, parks a faint emerald wash, water an
// abyssal blue. All POI/transit icon noise is stripped: only the streets, the
// land, and your conquest remain.
export const darkMapStyle = [
  // Ground
  { elementType: 'geometry', stylers: [{ color: '#050509' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#050509' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#585868' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },

  // Districts / boundaries — a whisper of violet
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#201b33' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#7a7a90' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },

  // POI — keep parks as terrain, silence the rest
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#08130d' }] },
  { featureType: 'poi.park', elementType: 'labels.text', stylers: [{ visibility: 'on' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#2e5c48' }] },

  // Roads — dark veins; arterials carry the violet current
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#16161f' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0d0d14' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#585868' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#1d1a2e' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2b2350' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#3d2f6b' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#8f86b8' }] },
  { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'off' }] },

  // Transit — off; it isn't part of the game board
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },

  // Water — abyssal
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#04070f' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#2b3a5c' }] },

  // Built terrain
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#07070c' }] },
]
