// "Neon cartography" Google Maps style — the map is Zorr's game board.
// Near-pure-black ground so territory glows read like light on a dark table;
// arterial roads carry a violet current, parks a faint emerald wash, water an
// abyssal blue. Place + street names stay readable (bright text on a dark halo)
// so the board reads as YOUR city; only POI/transit icon noise is stripped.
export const darkMapStyle = [
  // Ground + a legible label base (bright fill, dark halo for contrast)
  { elementType: 'geometry', stylers: [{ color: '#050509' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#04040a' }, { weight: 2.5 }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#aeaecc' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },

  // Districts / boundaries — a whisper of violet, names bright
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#241d3a' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#e0e0f4' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill', stylers: [{ color: '#b8b8d8' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },

  // POI — keep parks as terrain (with names), silence the commercial noise
  { featureType: 'poi', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#08130d' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#5aa886' }] },

  // Roads — dark veins; arterials carry the violet current; names legible
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#181822' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0d0d14' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9a9ab8' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#221d38' }] },
  { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#b0a8d4' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#33285f' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#4a3a80' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#cfc4ff' }] },
  { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#7e7e98' }] },

  // Transit — off; it isn't part of the game board
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },

  // Water — abyssal
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#04070f' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3a4d78' }] },

  // Built terrain
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#07070c' }] },
]
