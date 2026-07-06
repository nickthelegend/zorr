/**
 * Self-contained Leaflet map HTML for the Capture screen, rendered inside a WebView.
 * Dark OSM (Carto) tiles — no API key. Draws a ~55m territory-tile grid around the
 * player, highlights captured tiles, and posts tile taps back to React Native.
 *
 * RN -> WebView bridge:  window.zorr.setLocation(lat,lng) / window.zorr.setCaptured(keys[])
 * WebView -> RN bridge:  postMessage({ type:'tileTap', key }) and ({ type:'ready' })
 */
export const TILE_DEG = 0.0005 // ~55m at the equator

export function tileKey(lat: number, lng: number) {
  return `${Math.floor(lat / TILE_DEG)}_${Math.floor(lng / TILE_DEG)}`
}

export const mapHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html,body,#map{height:100%;margin:0;background:#000}
  .leaflet-control-attribution{font-size:8px;background:rgba(0,0,0,0.4);color:#666}
  .leaflet-control-zoom{display:none}
</style>
</head>
<body>
<div id="map"></div>
<script>
  var TILE = ${TILE_DEG};
  var map = L.map('map', { zoomControl:false, attributionControl:true }).setView([17.4239,78.4738], 17);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 20, subdomains:'abcd', attribution:'© OSM © CARTO'
  }).addTo(map);

  var meDot = L.circleMarker([17.4239,78.4738], { radius:8, color:'#7C3AED', fillColor:'#7C3AED', fillOpacity:1, weight:3 }).addTo(map);
  var meRing = L.circle([17.4239,78.4738], { radius:28, color:'#7C3AED', weight:1, fillOpacity:0.08 }).addTo(map);
  var captured = {};       // key -> layer
  var capturedSet = {};    // key -> true
  var haveFix = false;

  function post(obj){ if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(obj)); }
  function tileBounds(key){
    var p = key.split('_'); var y=parseInt(p[0]); var x=parseInt(p[1]);
    return [[y*TILE,x*TILE],[(y+1)*TILE,(x+1)*TILE]];
  }
  function drawCaptured(key){
    if(captured[key]) return;
    var rect = L.rectangle(tileBounds(key), { color:'#22D3A6', weight:1, fillColor:'#22D3A6', fillOpacity:0.28 }).addTo(map);
    captured[key]=rect;
  }

  // Grid of tappable tiles around the player.
  var grid = L.layerGroup().addTo(map);
  function drawGrid(lat,lng){
    grid.clearLayers();
    var cy=Math.floor(lat/TILE), cx=Math.floor(lng/TILE);
    for(var dy=-4; dy<=4; dy++){
      for(var dx=-4; dx<=4; dx++){
        var key=(cy+dy)+'_'+(cx+dx);
        if(capturedSet[key]) continue;
        var r=L.rectangle(tileBounds(key), { color:'rgba(255,255,255,0.10)', weight:1, fillColor:'#7C3AED', fillOpacity:0.02 });
        (function(k){ r.on('click', function(){ post({type:'tileTap', key:k}); }); })(key);
        grid.addLayer(r);
      }
    }
  }

  window.zorr = {
    setLocation: function(lat,lng){
      meDot.setLatLng([lat,lng]); meRing.setLatLng([lat,lng]);
      drawGrid(lat,lng);
      if(!haveFix){ map.setView([lat,lng], 18); haveFix=true; }
    },
    setCaptured: function(keys){
      capturedSet={}; keys.forEach(function(k){ capturedSet[k]=true; drawCaptured(k); });
    }
  };
  post({type:'ready'});
</script>
</body>
</html>`
