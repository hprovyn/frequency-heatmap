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

$parentChildren = array();
$childParents = array();
function getProjectBaseDir($hg) {
    return "https://phylogeographer.com/data/projects/mtdna/" . $hg . "/";
}



$weightedPoints = array();
$hg = "";
$version = "";
$link = "";
$points = "";
$parent = "";

$multipleOptions = array();

if (isset($_GET["hg"])) {
    processGetHG(str_replace(array("<",">",";","\"","script"),"",trim($_GET["hg"])));
}

function processGetHG($hg) {
echo "<script>var mtdna_hg = \"" . $hg . "\"</script>";
}



?>

<div id="title"></div>
<div id="lmap"></div>
<div id="denom"></div>
<link rel="stylesheet" href="https://phylogeographer.com/scripts/leaflet171.css"/>
<script src="https://phylogeographer.com/scripts/leaflet171.js"></script>

<script src="https://phylogeographer.com/scripts/mtdnaHeatmapB3_lat.js"></script>
<script src="https://ajax.googleapis.com/ajax/libs/jquery/3.2.1/jquery.min.js"></script>

<script>
var lmap;
var heatmapLayer = null;
var pointLayer = null;
var sampleMap = {};
var cfg = {
        // radius should be small ONLY if scaleRadius is true (or small radius is intended)
        // if scaleRadius is false it will be the constant radius used in pixels
        "radius": 6,
        "maxOpacity": 0.7,
        "minOpacity": .12,
        "blur": 1,
        // scales the radius based on map zoom
        "scaleRadius": true,
        "gradient": {'0':'white',
        '.2': 'blue',
        '.4': 'green',
        '.55': 'yellow',
        '.7': 'orange',
        '.85': 'red',
        '1': 'magenta'},

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
var version = 'MTree 1.02.16447';
var link = '<?php echo $link; ?>';
var numpoints = '<?php echo count($points); ?>';
var parent = '<?php echo $parent; ?>';
//var snpsAndBranchesString = '<?php echo json_encode($snpsAndBranches); ?>';
//var snpsAndBranches = JSON.parse(snpsAndBranchesString);
var markers = {}
var circ = {}

var watermark = {};

function leafletMap() {



lmap = L.map('lmap', {zoomSnap:0.5, zoomDelta:0.5, zoom:2, zoomControl: false, tap: false}).fitWorld();

L.tileLayer('https://map.yseq.net:8444/osm/{z}/{x}/{y}.png', {
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
            spotMap[spotKey]["points"].push({clade: data[i]["clade"], id: data[i]["id"]})
            spotMap[spotKey]["weight"] = spotMap[spotKey]["weight"] + data[i]["count"]
        } else {
            spotMap[spotKey] = {lat: data[i]["lat"], lng: data[i]["lng"], points: [{clade: data[i]["clade"], id: data[i]["id"]}], weight: data[i]["count"]}
        }
    }
    return spotMap
}

function getMax(arr) {
    return Math.max.apply(Math, arr.map(function(o) { return o["weight"]; }))
}

function getPercentile(arr, perc) {
    var sorted = arr.map(function(o) { return o["weight"]; })
    sorted.sort(function (a,b) {
    return a - b; // Ascending
});
    return sorted[Math.floor(arr.length * perc)]
}

var pstring = '<?php echo json_encode($weightedPoints); ?>';
var mOptionsString = '<?php echo json_encode($multipleOptions); ?>';
var points = JSON.parse(pstring);
var multipleOptions = JSON.parse(mOptionsString);
var max = null;

var baseRadius = 3// / 400 * 229;
var heatmapInput = points.map(function(p) {return {id: p[0], lat: p[1], lng: p[2], count: p[3] / Math.pow(p[4], 1.3), radius: p[4] * baseRadius / ((1 + Math.cos(p[1] / 180 * Math.PI)) / 2) / 1.1 , clade: p[5]}})
var scalePercentages = []
var scalePercentageFactor = 0.1745 * 3.7
leafletMap();

for (var i = 0; i < points.length; i++) {
    sampleMap[points[i][0]] = {clade: points[i][5], lat: points[i][1], lng: points[i][2]}
}
var mapIcon, selectedIcon;


function addWatermark() {
    L.Control.Watermark = L.Control.extend({
        onAdd: function(map) {
            var text = L.DomUtil.create('div');
            text.id = "info_text";
            var hgOrMultipleOptions = hg;
            var samplesText = "";
            var backHTML = "";
            if (multipleOptions.length > 0) {
                hgOrMultipleOptions = "\"" + multipleOptions.join(" or ") + "\""
            } else {
                if (hg != "") {
                    samplesText = '<br><a href="https://www.yfull.com/tree/' + hg + '">' + hg + '</a> - ' + numpoints + " Geolocated Samples";
                    backHTML =  '<a href="https://phylogeographer.com/scripts/mt_heatmap.php?newlookup=' + parent + '"><img src="https://www.phylogeographer.com/img/back.png" width="6%"/></a> ';
                } else {
                    hgOrMultipleOptions = "\"i.e. R1b, G or Z631\""
                }
            }
            backHTML += '<a href="https://phylogeographer.com/mt-heatmap/"><img src="https://img.icons8.com/ios/26/000000/help.png" width="6%"/></a>'
            text.innerHTML = '<div style="font-size:30"><b>mt Heatmap - Beta</b></div>Relative Frequency Map for mtDNA Haplogroups<br>Developed by Hunter Provyn and Thomas Krahn<br>Apache 2.0 License<br><a href="https://phylogeographer.com/mt-heatmap/">Instructions</a> <br>Github repo: <a href="https://github.com/hprovyn/frequency-heatmap">hprovyn/frequency-heatmap</a>' + samplesText + "<br>" + version + "<br><br>"+ '<a href="https://www.phylogeographer.com"><img src="https://www.phylogeographer.com/img/Phylogeographer-Logo-small-transparent.png" width="55%"/></a><br><a href="https://www.yseq.net"><img src="https://www.phylogeographer.com/img/YSEQ-GmbH-Logo-small-transparent.png"/></a><br><a href="https://www.yfull.com"><img src="https://www.phylogeographer.com/img/YFull-Logo-small-transparent.png"/></a>'+"<br><br><form autocomplete='off' id='lookup' onsubmit='submitNewClade();'><div class='autocomplete' style='width:150px;' overflow='scroll'><input type='text' style='width:150px;' id='newlookup' name='newlookup'  placeholder='SNP or haplogroup' ></div><br></form><button onClick='submitNewClade();'>Submit</button>"+backHTML
            if (hg != "" || hg == "") {
                text.innerHTML += '<br><div id="radius"></div>';
                text.innerHTML += '<div class="slidecontainer"><input type="range" min="1" max="3" value="2" class="slider" id="myRange" style="width:50%" onchange="updateMapRadiusChanged()"></div>';
                text.innerHTML += 'Intensity&nbsp;<div class="slidecontainer"><input type="range" min="1" max="20" value="3" class="slider" id="hardmaxRange" style="width:50%" onchange="updateMapMaxChanged()"></div>';
                text.innerHTML += '<div id="hardmax"></div>';
                text.innerHTML += '<div id="legend"></div>'
            }
            text.style.width = '270px'
            return text;
        },

        onRemove: function(map) {
            // Nothing to do here
        }
    });

    L.control.watermark = function(opts) {
        return new L.Control.Watermark(opts);
    }

    watermark = L.control.watermark({ position: 'topleft'})
    watermark.addTo(lmap);
}

function addHeatMap() {
    mapIcon = L.icon({
        iconUrl: 'images/marker-red.png',
        shadowUrl: 'images/marker-shadow.png',
        iconSize:     [32, 44], // size of the icon
    shadowSize:   [64, 89], // size of the shadow
    iconAnchor:   [16, 44], // point of the icon which will correspond to marker's location
    shadowAnchor: [32, 89],  // the same for the shadow
    popupAnchor:  [0, -54] // point from which the popup should open relative to the iconAnchor

      })

    selectedIcon =L.icon({
        iconUrl: 'images/marker-yellow.png',
        shadowUrl: 'images/marker-shadow.png',
        iconSize:     [32, 44], // size of the icon
    shadowSize:   [64, 89], // size of the shadow
    iconAnchor:   [16, 44], // point of the icon which will correspond to marker's location
    shadowAnchor: [32, 89],  // the same for the shadow
    popupAnchor:  [0, -54] // point from which the popup should open relative to the iconAnchor

      })
    
      
      //heatmapLayer = new HeatmapOverlay(cfg);
      //heatmapLayer.addTo(lmap);
      
      //heatmapLayer.setData(testData);
      lmap.setZoom(2);

addWatermark()

L.control.zoom({
    position: 'topright'
}).addTo(lmap);


}

var maxFactor = 0
var maxBase = 1.2

function submitNewClade() {
    var newValue = document.getElementById('newlookup').value
    if (entries.indexOf(newValue) != -1) {
        var newValueSplit = newValue.split(" ")
        var hgAndClade = newValueSplit[newValueSplit.length-1].split("->")
        var hg = hgAndClade[0]
        var clade = hgAndClade[1]
        loadTree(hg)
        loadKitsBelowSubclade(hg,clade)
        loadTargetAndAddToMap()
    } else {
        alert (newValue + " not valid")
    }
}


var selectedId = null;

function checkIfYFullSample(value) {
    if (sampleMap.hasOwnProperty(value)) {
        var thesample = circ[value]
        if (selectedId) {
            var selected = markers[selectedId];
            pointLayer.removeLayer(selected);
            var selectedData = circ[selectedId];
            selected = L.marker([selectedData["lat"], selectedData["lng"]], {icon:mapIcon, title:selectedId}).bindPopup('<iframe class="resized" src="https://cladefinder.yseq.net/interactive_tree.php?snps=' +  selectedData["clade"].substring(selectedData["clade"].indexOf("-") + 1, selectedData["clade"].length) + '%2B" width="560" height="315"></iframe>', {
                maxWidth: 560
            })
            markers[selectedId] = selected;
            pointLayer.addLayer(selected);
        }
        selectedId = value
        var newSelected = markers[selectedId];
        pointLayer.removeLayer(newSelected);
        selected = L.marker([thesample["lat"], thesample["lng"]], {icon:selectedIcon, title:selectedId}).bindPopup('<iframe class="resized" src="https://cladefinder.yseq.net/interactive_tree.php?snps=' +  thesample["clade"].substring(thesample["clade"].indexOf("-") + 1, thesample["clade"].length) + '%2B" width="560" height="315"></iframe>', {
                maxWidth: 560
        }).addTo(pointLayer);
        markers[selectedId] = selected
        //lmap.addLayer(selected);

        lmap.setView([thesample["lat"],thesample["lng"]],8)
        
        return true
    }
    return false
}

loadMTDNAsnpMap()
updateMapRadiusChanged()
</script>
<style>
.autocomplete {
  position: relative;
  display: inline-block;
}
.autocomplete-items {
  position: absolute;
  border: 1px solid #d4d4d4;
  border-bottom: none;
  border-top: none;
  z-index: 99;
  top: 100%;
  left: 0;
  right: 0;
}
.autocomplete-items div {
  padding: 1px;
  cursor: pointer;
  background-color: #fff;
  border-bottom: 1px solid #d4d4d4; 
}
.autocomplete-items div:hover {
  background-color: #e9e9e9; 
}
.autocomplete-active {
  background-color: DodgerBlue !important; 
  color: #ffffff; 
}
</style>
</body>
</html>