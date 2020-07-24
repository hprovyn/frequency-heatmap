<?php
echo '<html><head><style>
body {
    padding: 2;
    margin: 2;
}
html, body, #lmap {
    height: 100%;
            width: 100%;
    
}
</style></head><body>';

if (isset($_POST["points"])) {
    $points = json_decode($_POST["points"]);

    $sample_weights = file_get_contents("../heatmap/sample_weights.csv");    
    
    $lines = explode("\n", $sample_weights);

    $grid_weights = array();
    $cols = count($lines);
    foreach ($lines as $line) {
        $weights = explode(",", $line);
        array_push($grid_weights, $weights);
    }
    $rows = count($grid_weights[0]);
    $minLon = -180;
    $minLat = -56;
    $maxLon = 180;
    $maxLat = 75;
    $cellWidth = ($maxLon - $minLon) / $cols;
    $cellHeight = ($maxLat - $minLat) / $rows;
    function getIndexFromLatLon($lat, $lng, $minLon, $minLat, $cellHeight, $cellWidth) {
       
        $c = ($lng - $minLon) / $cellWidth;
        $r = ($lat - $minLat) / $cellHeight;
        $c = floor($c);
        $r = floor($r);
        $c = max(0, $c);
        $r = max(0, $r);
        return array($c, $r);
    }
    $rc = getIndexFromLatLon(51.0, 0.0, $minLon, $minLat, $cellHeight, $cellWidth);
    $col = $rc[0];
    $row = $rc[1];
    $weightedPoints = array();
    foreach($points as $point) {
        $rc = getIndexFromLatLon($point[0], $point[1], $minLon, $minLat, $cellHeight, $cellWidth);
        $col = $rc[0];
        $row = $rc[1];
        array_push($weightedPoints, array($point[0], $point[1], 1 / floatval($grid_weights[$col][$row]), $point[2], $point[3]));
    }

    if (isset($_POST["hg"])) {
        $hg = $_POST["hg"];
    } 
    if (isset($_POST["version"])) {
        $version = $_POST["version"];
    }
    if (isset($_POST["link"])) {
        $link = $_POST["link"];
    }
}
?>

<div id="title"></div>
<div id="lmap"></div> 
<link rel="stylesheet" href="https://phylogeographer.com/scripts/leaflet07.css"/>
<script src="https://phylogeographer.com/scripts/leaflet07.js"></script>
<script src="https://phylogeographer.com/scripts/heatmap.min.js"></script>
<script src="https://phylogeographer.com/scripts/leaflet-heatmap.js"></script>
<script>
var lmap;
var heatmapLayer = null;
var pointLayer = null;

var cfg = {
        // radius should be small ONLY if scaleRadius is true (or small radius is intended)
        // if scaleRadius is false it will be the constant radius used in pixels
        "radius": 6,
        "maxOpacity": .6,
        // scales the radius based on map zoom
        "scaleRadius": true,
        // if set to false the heatmap uses the global maximum for colorization
        // if activated: uses the data maximum within the current map boundaries
        //   (there will always be a red spot with useLocalExtremas true)
        "useLocalExtrema": false,
        // which field name in your data represents the latitude - default "lat"
        latField: 'lat',
        // which field name in your data represents the longitude - default "lng"
        lngField: 'lng',
        // which field name in your data represents the data value - default "value"
        valueField: 'count'
      };

var hg = '<?php echo $hg; ?>';
var version = '<?php echo $version; ?>';
var link = '<?php echo $link; ?>';
var numpoints = '<?php echo count($points); ?>';
function leafletMap() {



lmap = L.map('lmap', {zoomSnap:0.5, zoomDelta:0.5, zoom:2, zoomControl: false}).fitWorld();

L.tileLayer('http://ket.yseq.de:8000/osm/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' +
			'<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, '
    }).addTo(lmap);

addHeatMap();

lmap.on('zoomend', function() {
    if (lmap.getZoom() > 5 && lmap.hasLayer(pointLayer) == false) {
        lmap.addLayer(pointLayer)
    }
    if (lmap.getZoom() < 6 && lmap.hasLayer(pointLayer)) {
        lmap.removeLayer(pointLayer);
    }
});
}

function getUniqueMap(data) {
    var spotMap = {}
    for (var i = 0; i < data.length; i++) {
        spotKey = data[i]["lat"] + "_" + data[i]["lng"]
        if (spotMap.hasOwnProperty(spotKey)) {
            spotMap[spotKey]["points"].push(data[i]["clade"])
            spotMap[spotKey]["weight"] = spotMap[spotKey]["weight"] + data[i]["count"]
        } else {
            spotMap[spotKey] = {lat: data[i]["lat"], lng: data[i]["lng"], points: [data[i]["clade"]], weight: data[i]["count"]}
        }
    }
    return spotMap
}

function getMax(arr) {
    return Math.max.apply(Math, arr.map(function(o) { return o["weight"]; }))
}

function getPercentile(arr, perc) {
    var sorted = arr.map(function(o) { return o["weight"]; })
    sorted.sort()
    return sorted[Math.floor(arr.length * perc)]
}

function circleify(spotMap) {
    var spotKeys = Object.keys(spotMap)
    var circleified = []
    var offset = 0.01
    for (var i = 0; i < spotKeys.length; i++) {
        var thisSpot = spotMap[spotKeys[i]]
        var length = thisSpot["points"].length
        if (length == 1) {
            circleified.push({lat: thisSpot["lat"], lng: thisSpot["lng"], clade:thisSpot["points"][0]})
        } else {
            for (var j = 0; j < length; j++) {
                var circLat = Math.cos(j * 2 * Math.PI / length) * offset * length
                var circLng = Math.sin(j * 2 * Math.PI / length) * offset * length
                circleified.push({lat: thisSpot["lat"] + circLat, lng: thisSpot["lng"] + circLng, clade: thisSpot["points"][j]})
            }
        }
    }
    return circleified
}

var pstring = '<?php echo json_encode($weightedPoints); ?>';
var points = JSON.parse(pstring);
var max = null;

var baseRadius = 3;
var heatmapInput = points.map(function(p) {return {lat: p[0], lng: p[1], count: p[2] / p[3], radius: p[3] * baseRadius, clade: p[4]}})
leafletMap();




function addHeatMap() {
    var testData = {
        max: max,
        data: heatmapInput
      };

      var mapIcon = L.icon({
        iconUrl: 'images/marker-red.png',
        shadowUrl: 'images/marker-shadow.png',
        iconSize:     [32, 44], // size of the icon
    shadowSize:   [64, 89], // size of the shadow
    iconAnchor:   [16, 44], // point of the icon which will correspond to marker's location
    shadowAnchor: [32, 89],  // the same for the shadow
    popupAnchor:  [0, -54] // point from which the popup should open relative to the iconAnchor

      })
      
      
      var points = [];
      var uniqMap = getUniqueMap(heatmapInput)
      max = getPercentile(Object.values(uniqMap), .9) 
      testData["max"] = max
      var circleified = circleify(uniqMap)
      for (var i = 0; i < circleified.length; i++) {
          points.push(L.marker([circleified[i]["lat"], circleified[i]["lng"]], {icon:mapIcon}).bindPopup('<iframe class="resized" src="https://cladefinder.yseq.net/interactive_tree.php?snps=' +  circleified[i]["clade"].substring(circleified[i]["clade"].indexOf("-") + 1, circleified[i]["clade"].length) + '%2B" width="560" height="315"></iframe>', {
  maxWidth: 560
}))
      }
      pointLayer = L.layerGroup(points);
      
      heatmapLayer = new HeatmapOverlay(cfg);
      heatmapLayer.addTo(lmap);
      
      heatmapLayer.setData(testData);
      lmap.setZoom(2);

      L.Control.Watermark = L.Control.extend({
    onAdd: function(map) {
        var text = L.DomUtil.create('div');
		text.id = "info_text";
		text.innerHTML = '<div style="font-size:30"><b>Y Heatmap</b></div>A Relative Frequency Map for Y Haplogroups<br>Developed by Hunter Provyn and Thomas Krahn<br>Apache 2.0 License<br>Github repo: <a href="https://github.com/hprovyn/frequency-heatmap">hprovyn/frequency-heatmap</a><br><a href="https://www.yfull.com/tree/' + hg + '">' + hg + '</a> - ' + numpoints + " Geolocated Samples<br>" + version + "<br><br>"+ '<a href="https://www.phylogeographer.com"><img src="https://www.phylogeographer.com/img/Phylogeographer-Logo-small-transparent.png" width="70%"/></a><br><a href="https://www.yseq.net"><img src="https://www.phylogeographer.com/img/YSEQ-GmbH-Logo-small-transparent.png"/></a><br><a href="https://www.yfull.com"><img src="https://www.phylogeographer.com/img/YFull-Logo-small-transparent.png"/></a>'+"<br><br><form onsubmit='submitNewClade()'><input type='text' id='newlookup' value=" + hg + "><br><input type='submit'></form><br><br>Intensity<br>" + '<button type="button" onclick="increase()">-</button>  <button type="button" onclick="decrease()">+</button>'
		return text;
    },

    onRemove: function(map) {
        // Nothing to do here
    }
});

L.control.watermark = function(opts) {
    return new L.Control.Watermark(opts);
}

L.control.watermark({ position: 'topleft' }).addTo(lmap);

L.control.zoom({
    position: 'topright'
}).addTo(lmap);


}

var maxFactor = 0
var maxBase = 1.2
function increase() {
    maxFactor = maxFactor + 1
    adjustMax()
}
function decrease() {
    maxFactor = maxFactor - 1
    adjustMax()
}

function submitNewClade() {
  newValue = document.getElementById('newlookup').value
  window.open("https://phylogeographer.com/heatmaps?" + newValue)
}
function adjustMax() {
    lmap.removeLayer(heatmapLayer)

    heatmapLayer = new HeatmapOverlay(cfg);
    heatmapLayer.addTo(lmap);
    var testData = {
        max: max * Math.pow(maxBase, maxFactor),
        data: heatmapInput
    }
    heatmapLayer.setData(testData);
}

</script>
</body>
</html>