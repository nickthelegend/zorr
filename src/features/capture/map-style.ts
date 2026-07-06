// Dark "night" Google Maps style to match Zorr's theme.
export const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#0b0b12' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0b0b12' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b6b7b' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#5a5a6a' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0f1a14' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1c1c26' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#14141c' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#6b6b7b' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2a2440' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1c1c26' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a0f1a' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3a4a6a' }] },
]
