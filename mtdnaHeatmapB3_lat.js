var kilometersPerDegree = 111.3

function getDist(x1, y1, x2, y2) {
    return Math.sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2))
}

function getHeat(x1, y1, x2, y2, radius, cosLat) {
    var dist = getDist(x1 * cosLat, y1, x2 * cosLat, y2)
    if (dist < radius) {
        return (radius - dist) / radius
    } else {
        return 0
    }
}

function getGridSquare(lat, lon) {
    return [Math.floor((lat - latRange[0]) * cellsAlongOneDegree), Math.floor((lon-lonRange[0]) * cellsAlongOneDegree)]
}
function getGridSquareBounds(row, col) {
    return [[latRange[0] + row / cellsAlongOneDegree, lonRange[0] + col / cellsAlongOneDegree],[latRange[0] + (row + 1) / cellsAlongOneDegree, lonRange[0] + (col + 1) / cellsAlongOneDegree]]
}

var latRange = [-75,75]
var lonRange = [-180,180]
var cellsAlongOneDegree = 10
var rows = Math.floor((latRange[1]-latRange[0]) * cellsAlongOneDegree)
var cols = Math.floor((lonRange[1]-lonRange[0]) * cellsAlongOneDegree)

function getInsideCircleIndicesAndHeat(radius, y) {
    var squares = []
    var radiusInDegrees = radius / kilometersPerDegree
    var r2d2 = radiusInDegrees * radiusInDegrees
    var ridcaod = radiusInDegrees * cellsAlongOneDegree
    var rowz = Math.floor(ridcaod * 2)
    if (rowz % 2 == 0) {
        rowz++;
    }
    var rcenter = (rowz - 1) / 2
    var cosLat = Math.cos(y * Math.PI / 180)
    var colz = Math.floor(ridcaod * 2 / cosLat)
    if (colz % 2 == 0) {
        colz++;
    }
    var ccenter = (colz - 1) / 2

    for (var i = 0; i < rowz; i++) {
        for (var j = 0; j < colz; j++) {
            var heat = getHeat(ccenter,rcenter, j, i, ridcaod, cosLat) / r2d2
            if (heat > 0) {
                squares.push([i-rcenter,j-ccenter,heat])
            }
        }
    }
    return squares
}

function inBounds(row,col) {
    return (row >= 0 && row < rows && col >= 0 && col < cols) 
}

function addToGradient(gradient, x, y, radius, intensity) {
    var indicesAndHeat = getInsideCircleIndicesAndHeat(radius, y)
    var centerGridCell = getGridSquare(y, x)
    for (var i = 0; i < indicesAndHeat.length; i++) {
        thisRow = indicesAndHeat[i][0] + centerGridCell[0]
        thisCol = indicesAndHeat[i][1] + centerGridCell[1]
        if (inBounds(thisRow, thisCol)) {
            var gridkey = thisRow + "," + thisCol
            if (gradient.hasOwnProperty(gridkey)) {
                gradient[gridkey] += indicesAndHeat[i][2] * intensity
            } else {
                gradient[gridkey] = indicesAndHeat[i][2] * intensity
            }
        }
    }    
}

var maxIntensity = 350
var digits = "1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%()*+,-./:;=?@[]^|{}`~'"
var base = digits.length
var base2 = base * base
var base3 = base * base * base
var maxOverBase3 = maxIntensity / base3

function recalibrateMax(newMax) {
    maxIntensity = newMax
    maxOverBase3 = maxIntensity / base3
}

function translateToBase(value) {
    var translated = Math.floor(value / maxIntensity * (base * base * base - 1))
    var first = Math.floor(translated / base2)
    var second = Math.floor((translated - first * base2 ) / base)
    var third = translated % base
    return digits[first] + "" + digits[second] + "" + digits[third]
}
function translateToValue(encoded) {
    return (digits.indexOf(encoded[0]) * base2 + digits.indexOf(encoded[1]) * base + digits.indexOf(encoded[2]))* maxOverBase3
}
function translateToBaseUnscaled(value) {
    var first = Math.floor(value / base2)
    var second = Math.floor((value - first * base2 ) / base)
    var third = value % base
    return digits[first] + "" + digits[second] + "" + digits[third]
}

function translateToValueUnscaled(encoded) {
    return (digits.indexOf(encoded[0]) * base2 + digits.indexOf(encoded[1]) * base + digits.indexOf(encoded[2]))
}


function getRounded(hardMax) {
    var hardMaxPct = hardMax * 100
    var rounded = Math.round(hardMaxPct)
    if (hardMaxPct < 4) {
        var places = Math.floor(Math.log10(4) - Math.log10(hardMaxPct)) + 1
        rounded = Math.round(hardMaxPct * Math.pow(10,places)) / Math.pow(10,places)
    }
    return rounded
}

function divide(numerator, denominator) {
    var quotient = []
    for (const [key, value] of Object.entries(numerator)) {
        if (denominator.hasOwnProperty(key)) {
            var thisQ = numerator[key] / denominator[key]
            quotient[key] = thisQ
        }
    }
    var qMax = Math.min(getMaxOfSurface(quotient), 1)

    var hardMax = hardmaxFactor * qMax
    var rounded = getRounded(hardMax)
    if (qMax > 0) {
        addLegend(hardMax)
    }
    var filtered = []
    for (const [key, value] of Object.entries(quotient)) {
        var relFreq = value / hardMax
        if (relFreq > 1) {
            relFreq = 1
        }
        if (relFreq > 0.01) {
            filtered[key] = relFreq
        }
    }
    return filtered
}

function instantiateDummyAll(max) {
    var all = {}
    for (var i = 0; i < rows; i++) {
        for (var j = 0; j < cols; j++) {
            all["" + i + "," + j] = max
        }        
    }
    return all
}

function getMaxOfSurface(surface) {
    var max = 0
    for (const [key, value] of Object.entries(surface)) {
        if (value > max) {
            max = value
        }

    }
    return max
}

var thedenom = []

function expor7() {
    var thelines = []
    for (var i = 0; i < rows; i++) {
        var thisRow = []
        for (var j = 0; j < cols; j++) {
            var thekey = i + "," + j
            if (thedenom.hasOwnProperty(thekey)) {
                thisRow.push(Math.floor(thedenom[thekey] * 100) / 100)
            } else {
                thisRow.push(0)
            }
        }
        thelines.push(thisRow.join(" "))
    }
    
    document.getElementById('denom').innerHTML = thelines.join("<br>")
}

function convertToUnderscoreVar(line) {
    var converted = ""
    var lastZeroesBegin = null
    var col = -1
    for (var i = 0; i < line.length; i++) {
        if (line[i] == "_") {
            if (lastZeroesBegin == null) {
                lastZeroesBegin = col + 1
            }            
        } else {
            if (lastZeroesBegin != null) {
                converted += "_" + translateToBaseUnscaled(col + 1 - lastZeroesBegin)                
                lastZeroesBegin = null
            }
            converted += line[i] + line[i+1] + line[i+2]
            i += 2
        }
        col++
    }
    if (lastZeroesBegin != null) {
        converted += "_" + translateToBaseUnscaled(cols - lastZeroesBegin)                
    }
    return converted
}

var totalDiffs = []
function expor8() {
    var thelines = []
    thelines.push(getMaxOfSurface(thedenom))
    for (var i = 0; i < rows; i++) {
        var thisRow = []
        for (var j = 0; j < cols; j++) {
            var thekey = i + "," + j
            if (thedenom.hasOwnProperty(thekey) && thedenom[thekey] >= maxOverBase3 && waterGrid[i][j] != "0") {
                thisRow.push(translateToBase(thedenom[thekey]))
            } else {
                thisRow.push('_')
            }
        }
        thelines.push(convertToUnderscoreVar(thisRow.join("")))
    }
    //for (var i = 0; i < rows; i++) {
    //    var diff = 0
    //    var parsed = parseCompressedLine(thelines[i])
    //    for (var j = 0; j < cols; j++) {
    //        var thekey = i + "," + j
    //        if (thedenom.hasOwnProperty(thekey)) {
    //            diff += Math.abs(thedenom[thekey] - parsed[j])
    //        } else {
    //            diff += parsed[j]
    //        }
    //    }
    //    totalDiffs.push(diff)
    //}

    document.getElementById('denom').innerHTML = thelines.join("<br>")
}


function getQuotientMap(signals, all) {
    var signal = []
    var denom = []
    for (var i = 0; i < signals.length; i++) {
        addToGradient(signal, signals[i]["x"], signals[i]["y"], signals[i]["r"], signals[i]["i"])
    }
    //denom = instantiateDummyAll(getMaxOfSurface(signal))
    for (var i = 0; i < all.length; i++) {
        addToGradient(denom, all[i]["x"], all[i]["y"], all[i]["r"], all[i]["i"])
    }
    thedenom = denom
    var quotient = divide(signal, denom)
    return quotient
}

var signal = []
function getQuotientMapFromSignals(signals) {
    signal = []
    for (var i = 0; i < signals.length; i++) {
        addToGradient(signal, signals[i]["x"], signals[i]["y"], signals[i]["r"], signals[i]["i"])
    }
    quotient = divide(signal, thedenom)
    return quotient
}

function createSVGrect(block, row, bucketRows) {
    return '<rect x="' + block["colStart"] / cols * 100 + '%" y="' + (bucketRows - row % bucketRows - 1) / bucketRows * 100 + '%" width="'+ (block["colEnd"] - block["colStart"] + 1)/cols *100+'%" height="'+ 1 / bucketRows *100 + '%" fill="' + block["fillColor"] + '" fill-opacity="' + (.05 + block["value"] * .70) + '"/>'
}

function getHue(value) {
    var hueSpan = 180 + 40
    excessOfLeftBand = value - 180 / hueSpan
    if (excessOfLeftBand > 0) {
        return 1 - excessOfLeftBand * 220 / 360
    } else {        
        return (1-11/9*value) * 180 / 360
    }
}

var svgOverlays = []

var hues = 10

function addToMap(surface) {

    var precomputedHues = []
    var precomputedHexes = []
    for (var i = 0; i < hues + 1; i++) {
        precomputedHues[i / hues] = getHue(i/hues)
        precomputedHexes[i / hues] = rgbToHex(HSVtoRGB(precomputedHues[i / hues],1,1))
    }


    var buckets = 50
    var svgElems = []
    var rects = []
    var bucketRows = rows / buckets
    for (var i = 0; i < buckets; i++) {
        svgElems[i] = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgElems[i].setAttribute('xmlns', "http://www.w3.org/2000/svg");
        svgElems[i].setAttribute('viewBox', "0 0 " + cols + " " + bucketRows);
        svgElems[i].setAttribute('preserveAspectRatio',"none")
        rects[i] = '<rect x="0" y="0" width= "100%" height="100%" fill-opacity="0"/>'
    }
    
    var rgb = hexToRgb("#ff0000")
    var rowColMap = []

    for (const [key, value] of Object.entries(surface)) {
        var strsplit = key.split(",")
        var row = parseInt(strsplit[0])
        var col = parseInt(strsplit[1])
        if (!rowColMap.hasOwnProperty(row)) {
            rowColMap[row] = []
        }
        rowColMap[row][col] = value        
    }
    var rowKeys = Object.keys(rowColMap).sort()
    for (var i = 0; i < rowKeys.length; i++) {
        var row = rowKeys[i]
        var thisRowBucket = Math.floor(row / bucketRows)
        var colKeys = Object.keys(rowColMap[row]).sort()
        var thisBlock = null
        for (var j = 0; j < colKeys.length; j++) {
            var col = colKeys[j]
            var thisTruncVal = Math.floor(rowColMap[row][col] * hues) / hues

            if (thisBlock) {
                if (thisBlock["colEnd"] == col - 1 && thisBlock["value"] == thisTruncVal) {
                    thisBlock["colEnd"] = col
                } else {
                    rects[thisRowBucket] += createSVGrect(thisBlock, row, bucketRows)
                    //var hue = precomputedHues[thisTruncVal]
                    //var fillColor = rgbToHex(HSVtoRGB(hue,1,1))
                    var fillColor = precomputedHexes[thisTruncVal]
                    thisBlock = {"colStart": col, "colEnd": col, "fillColor": fillColor, "value":thisTruncVal}
                }
            } else {
                //var hue = precomputedHues[thisTruncVal]
                //var fillColor = rgbToHex(HSVtoRGB(hue,1,1))
                var fillColor = precomputedHexes[thisTruncVal]
                thisBlock = {"colStart": col, "colEnd": col, "fillColor": fillColor, "value":thisTruncVal}
            }

        }
        rects[thisRowBucket] += createSVGrect(thisBlock, row, bucketRows)

    }
    // create an orange rectangle
    
    
    
    //rects[thisRowBucket] += '<rect x="' + col / cols * 100 + '%" y="' + (bucketRows - row % bucketRows - 1) / bucketRows * 100 + '%" width="'+1/cols *100+'%" height="'+ 1 / bucketRows *100 + '%" fill="' + fillColor + '" fill-opacity="' + (.25 + value / 2) + '"/>'
    //}
    



var latSpan = latRange[1] - latRange[0]

for (var i = 0; i < buckets; i++) {
    svgElems[i].innerHTML = rects[i]

    svgOverlays.push(L.svgOverlay(svgElems[i], [ [ latRange[0] + latSpan / buckets * i, lonRange[0] ], [ latRange[0] + latSpan / buckets * (i+1), lonRange[1] ] ]))
}
for (var i = 0; i < svgOverlays.length; i++) {
    svgOverlays[i].addTo(lmap);
}

}

function removeSVGs() {
    for (var i = 0; i < svgOverlays.length; i++) {
        lmap.removeLayer(svgOverlays[i])
    }
    svgOverlays = []
}

function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
  }
  
  function rgbToHex(rgb) {
    return "#" + componentToHex(rgb["r"]) + componentToHex(rgb["g"]) + componentToHex(rgb["b"]);
  }

  function darken(rgb, percent) {
      r = Math.floor(rgb["r"] * percent)
      g = Math.floor(rgb["g"] * percent)
      b = Math.floor(rgb["b"] * percent)
      return rgbToHex(r,g,b)
  }
  
  function HSVtoRGB(h, s, v) {
    var r, g, b, i, f, p, q, t;
    if (arguments.length === 1) {
        s = h.s, v = h.v, h = h.h;
    }
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
}

function getProjectBaseDir(projectName) {
    return "https://phylogeographer.com/data/projects/mtdna/" + projectName + "/"
}


var pointRadiiMap = {}

var nans = []
function loadKits(projectName) {
    
  
    $.ajax({
      type:    "GET",
      async: false,
      url:     getProjectBaseDir(projectName) + projectName + "-samples.txt",
      success: function(text) {
        parseKits(projectName, text.split("\r\n"))
      }
    })
  }
  
  function parseKits(projectName, lines) {
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].split(",")
      var hg = line[0]
      var samples = line[1].split(":")
      for (var j = 0; j < samples.length; j++){
          sampleSplit = samples[j].split(" ")
          var lat = parseFloat(sampleSplit[1])
          var lng = parseFloat(sampleSplit[2])
          var id = sampleSplit[0]
          var radius = parseFloat(sampleSplit[3])
          var prKey = lat + "," + lng + "," + radius
          if (isNaN(lat)) {
              nans.push(projectName + " " + id)
          }
          if (pointRadiiMap.hasOwnProperty(prKey)) {
              pointRadiiMap[prKey]++
          } else {
              pointRadiiMap[prKey] = 1
          }
      }
    }
  }
//var allProjects = ["A00","A0", "A1a", "A1b1", "B", "C", "D", "E", "G", "H", "I1", "I2", "J1", "J2", "L", "M", "N", "O", "Q", "R1a", "R1b", "R2", "S", "T"]
var allProjects = ["HD","NM","DN","U",'R-a','R9c','R9b','F','R8','R7','R6','R5','R4','R32','R31','R30','R3','R2','T','J','R23','R22','R14','R13',"R12'21","R10","R1","R0a'b","HV-b","HV-a","HV5","HV4","HV32","HV31","HV30","HV3","HV29","HV28","HV27","HV26","HV25","HV21","HV19","HV18","HV13","HV12","HV1","HV0k","HV0j","HV0i","HV0h","V","HV0a7","HV0a6","HV0a5","HV0a4","HV0a3","HV0a2","HV0a1","HV0-a","H","P","A","N10","N11","N13","N14","N1a1a","I","N1a1b1","N1a2","N1a3","N1b","N1c","N5","N2a","W","N21","N22","N3","N6","N7","N8","N9a","N9b","Y","ND","L0","L1","L2'3'4'5'6a","L2","L3a","L3b'f","L3c'd","L3e'i'k'x","L3h","M10","M11","M1'20'51","G","M12","M13'46'61","M14","M15","M16","M17","M19'53","M2","M21","M22","M23'75","M24'41","M25","M26","M27","M28","M29","M29'Q1","Q","M3","M31","M32'56","M33","M34'57","M35","M36","M39'70","M40","M42'74","M44","M4''67","M47","M48","M49","M5","M50","M52","M55'77","M58","M59","M6","M62'68","M69","M7","M71","M72","M73'79","M76","M78","C","Z","M8a","D","M80","M80'D1","M81","M82","M83","M84","M85","M86","E","M9a'b","M91","O","S","X","L4","L5","L6"]
function loadAllSamples() {
    for (var i = 0; i < allProjects.length; i++) {
        var project = allProjects[i]
        loadKits(project)
    }
}



function loadPrecomputedTest(radius) {
    $.ajax({
        type:    "GET",
        async: false,
        url:        "https://phylogeographer.com/data/mtdna_denom_" + radius + "km_p66_compressed.txt",
        success: function(text) {
          //parsePrecomputed(text.split("\r\n"))
          parseCompressedTest(text.split("\r\n"))
          var qMapInput = points.map(function(p) {return {y: p[1], x: p[2], r: Math.pow(p[4], 0.666) * radius, i:1}})
          var q = getQuotientMapFromSignals(qMapInput)
          addToMap(q)
        }
      })
}

function loadPrecomputed(radius) {
    $.ajax({
        type:    "GET",
        async: false,
        url:        "https://phylogeographer.com/data/mtdna_denom_" + radius + "km_p66_compressed_b3_lat.txt",
        success: function(text) {
          //parsePrecomputed(text.split("\r\n"))
          parseCompressed2(text.split("\r\n"))
          var qMapInput = Object.keys(targetPointRadiiMap).map(function(k) {
            var split = k.split(",")
            return {y:parseFloat(split[0]), x:parseFloat(split[1]), r: getR(parseFloat(split[2])) * radius, i:targetPointRadiiMap[k]}
        })
          var q = getQuotientMapFromSignals(qMapInput)
          addToMap(q)
        }
      })
}

function getRadius() {
    return parseInt(document.getElementById("myRange").value) * 50 + 150
}

function loadTargetAndAddToMap() {
    removeSVGs()
    var radius = getRadius()
    var qMapInput = Object.keys(targetPointRadiiMap).map(function(k) {
        var split = k.split(",")
        return {y:parseFloat(split[0]), x:parseFloat(split[1]), r: getR(parseFloat(split[2])) * radius, i:targetPointRadiiMap[k]}
    })
    var q = getQuotientMapFromSignals(qMapInput)
    addToMap(q)
    addMarkers()
}

function parsePrecomputed(lines) {
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].split(" ")
      for (var j = 0; j < line.length; j++) {
          if (line[j] != "0") {
              thedenom[i + "," + j] = parseFloat(line[j]) + 0.01
          }
      }
    }
}

function parseCompressed(lines) {
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i]
      var col = 0
      for (var j = 0; j < line.length; j++) {
          if (line[j] != "_") {
            var encoded = line.substring(j, j + 2)            
            var parsed = translateToValue(encoded)
            if (parsed < 0) {
                alert(i + ", " + j + " " + encoded + " yields " + parsed)
            }
            if (parsed > 1) {
                thedenom[i + "," + col] = parseFloat(parsed) + 0.01
            }            
            j++                
          }
          col++  
      }
    }
}

function parseCompressed2(lines) {
    thedenom = []
    maxIntensity = lines[0]
    recalibrateMax(maxIntensity)
    for (var i = 1; i < lines.length; i++) {
      var line = lines[i]
      var col = 0
      for (var j = 0; j < line.length; j++) {
          if (line[j] != "_") {
            var encoded = line.substring(j, j + 3)            
            var parsed = translateToValue(encoded)
            if (parsed < 0) {
                alert(i + ", " + j + " " + encoded + " yields " + parsed)
            }
            //if (parsed > 2) {
                thedenom[i - 1 + "," + col] = parseFloat(parsed) + 0.01
            //}            
            col++                
          } else {
              var blanks = translateToValueUnscaled(line.substring(j+1, j+4))
              col += blanks
              j++
          }
          j += 2

      }
    }
    
}

var parseTestTotalDiffs = []
var parseTestDiffs = []
function parseCompressedTest(lines) {
    var newDenom = []
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i]
      var col = 0
      parseTestTotalDiffs[i] = 0
      parseTestDiffs[i] = []
      for (var j = 0; j < line.length; j++) {
          if (line[j] != "_") {
            var encoded = line.substring(j, j + 2)            
            var parsed = translateToValue(encoded)
            if (parsed < 0) {
                alert(i + ", " + j + " " + encoded + " yields " + parsed)
            }
            //if (parsed > 2) {
                newDenom[i + "," + col] = parseFloat(parsed) + 0.01
            //}            
            col++                
          } else {
              var blanks = translateToValueUnscaled(line.substring(j+1, j+3))              
              col += blanks
              j++
          }
          j++
      }
      for (var j = 0; j < cols; j++) {
          var key = i + "," + j
          if (newDenom.hasOwnProperty(key)) {
              if (thedenom.hasOwnProperty(key)) {
                parseTestDiffs[i][j] = Math.abs(newDenom[key] - thedenom[key])
                
              } else {

                parseTestDiffs[i][j] = newDenom[key]
              }
          } else {
              if (thedenom.hasOwnProperty(key)) {
                  parseTestDiffs[i][j] = thedenom[key]
              } else {
                parseTestDiffs[i][j] = 0                
              }
          }
          parseTestTotalDiffs[i] += parseTestDiffs[i][j]
      }
    }
}

function parseCompressedLine(line) {
    var decompressed = []
    var col = 0
    for (var j = 0; j < line.length; j++) {
        if (line[j] != "_") {
        var encoded = line.substring(j, j + 2)            
        var parsed = translateToValue(encoded)
        if (parsed < 0) {
            alert(j + " " + encoded + " yields " + parsed)
        }
        //if (parsed > 2) {
            decompressed[col] = parseFloat(parsed) + 0.01
        //}            
        col++                
        } else {
            var blanks = translateToValueUnscaled(line.substring(j+1, j+3))
            for (var i = 0; i < blanks; i++) {
                decompressed[col + i] = 0
            }
            col += blanks
            j++
        }
        j++
    }
    return decompressed
}

var entries = []

var hgMap = {}
function getHGs() {
    for (var i = 0; i < entries.length; i++) {
        var splt = entries[i].split(" ")
        var hgsplit = splt[splt.length -1].split("->")
        hgMap[hgsplit[1]] = hgsplit[0]
    }
}
function loadMTDNAsnpMap() {
    $.ajax({
        type:    "GET",
        async: false,
        url:        "https://phylogeographer.com/data/snpMapHeatMTDNA.csv",
        success: function(text) {
          //parsePrecomputed(text.split("\r\n"))
          entries = text.split(",")
          entries.sort(compare_mtdna_entry)
          getHGs()
          autocomplete(document.getElementById("newlookup"), entries);
          if (mtdna_hg && hgMap.hasOwnProperty(mtdna_hg)) {
            document.getElementById('newlookup').value = hgMap[mtdna_hg] + "->" + mtdna_hg
            submitNewClade()
          }
        }
    })
}

function getR(r) {
    return (r-1)/14*9+1
}

function qMap(radius) {
    var qMapInput = points.map(function(p) {return {y: p[1], x: p[2], r: getR(p[4]) * radius, i:1}})
    var qMapDenom = Object.keys(pointRadiiMap).map(function(k) {
        var split = k.split(",")
        return {y:parseFloat(split[0]), x:parseFloat(split[1]), r: getR(parseFloat(split[2])) * radius, i:pointRadiiMap[k]}
    })

    var q = getQuotientMap(qMapInput, qMapDenom)
    addToMap(q)
}

function updateMapRadiusChanged() {
    removeSVGs()
    hardmaxFactor = (21 - parseInt(document.getElementById('hardmaxRange').value)) / 20
    var radius = getRadius()
    loadPrecomputed(radius)
    document.getElementById('radius').innerHTML = 'Radius: ' + radius + " km"
}

var hardmaxFactor = .5
function updateMapMaxChanged() {
    removeSVGs()
    hardmaxFactor = (21 - parseInt(document.getElementById('hardmaxRange').value)) / 20
    var q = divide(signal, thedenom)
    addToMap(q)
}

function loadTree(projectName) {

    $.ajax({
        type:    "GET",
        async: false,
        url:     getProjectBaseDir(projectName) + projectName + "-tree.txt",
        success: function(text) {
        
                 if (lmap == null) {
                   alert('map not loaded')
                 }
                 parseXML(text);            
        },
        error:   function() {
            // An error occurred
            alert("error loading tree file");
        }
     });
     
}

function parseXML(xml) {
    var parser = new DOMParser();
    var rootxml = parser.parseFromString(xml,"text/xml").documentElement;    
    recurseXMLFromRoot(rootxml);  
  }
  
  var ybp = {}
  var childParents = {};
  var parentChildren = {};
  var tmrca = {}
  
  function recurseXMLFromRoot(node) {
    var name = node.getAttribute("name");
    if (node.hasAttribute("formed")) {
      ybp[name] = parseInt(node.getAttribute("formed"));
      tmrca[name] = parseInt(node.getAttribute("tmrca"));
    } else {
      if (Object.keys(childParents).length == 0) {
          ybp[name] = 0;
          tmrca[name] = 0;
      } else {
          ybp[name] = ybp[childParents[name]];
          tmrca[name] = tmrca[childParents[tmrca]];
      }
    }

    parentChildren[name] = []
    for (var i = 0; i < node.children.length; i++) {
      childParents[node.children[i].getAttribute("name")] = name;
      parentChildren[name].push(node.children[i].getAttribute("name"))
      recurseXMLFromRoot(node.children[i]);
    }
  }

  function getChildren(clade) {
    
    if (parentChildren.hasOwnProperty(clade)) {
        return parentChildren[clade]
    } else {
        return []
    }
}

  function getDownstream(clade) {
    var clades = [];
    clades.push(clade);
    
    var children = getChildren(clade);
    for (var i = 0; i < children.length; i++) {
        clades = clades.concat(getDownstream(children[i]))      
    }
    return clades;
  }

  function getSamplesDownstream(clade) {

  }


  var targetPointRadiiMap = []
  var targetPointRadiiIdSubclades = []

  function loadKitsBelowSubclade(projectName, subclade) {
    targetPointRadiiMap = []
    targetPointRadiiIdSubclades = []

    $.ajax({
      type:    "GET",
      async: false,
      url:     getProjectBaseDir(projectName) + projectName + "-samples.txt",
      success: function(text) {
        parseKitsBelowSubclade(projectName, subclade, text.split("\r\n"))
      }
    })
  }
  
  function parseKitsBelowSubclade(projectName, subclade, lines) {
    var downstr = getDownstream(subclade)
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].split(",")
      var hg = line[0]
      if (downstr.indexOf(hg) != -1) {
        var samples = line[1].split(":")
      
        for (var j = 0; j < samples.length; j++){
            sampleSplit = samples[j].split(" ")
            var lat = parseFloat(sampleSplit[1])
            var lng = parseFloat(sampleSplit[2])
            var id = sampleSplit[0]
            var radius = parseFloat(sampleSplit[3])
            var prKey = lat + "," + lng + "," + radius
            if (isNaN(lat)) {
                nans.push(projectName + " " + id)
            }
            if (targetPointRadiiMap.hasOwnProperty(prKey)) {
                targetPointRadiiMap[prKey]++
                targetPointRadiiIdSubclades[prKey].push({"clade":hg,"id":id})
            } else {
                targetPointRadiiMap[prKey] = 1
                targetPointRadiiIdSubclades[prKey] = [{"clade":hg,"id":id}]
            }
        }
      }
      
    }
  }

function compare_mtdna_entry( a, b )
  {
  if ( a.length < b.length){
    return -1;
  }
  if ( a.length > b.length){
    return 1;
  }
  return 0;
}

function autocomplete(inp, arr) {
  var currentFocus;
  inp.addEventListener("input", function(e) {
      var a, b, i, val = this.value;
      closeAllLists();
      if (!val) { return false;}
      currentFocus = -1;
      a = document.createElement("DIV");
      a.setAttribute("id", this.id + "autocomplete-list");
      a.setAttribute("class", "autocomplete-items");
      a.style.overflowY = "scroll"; 
      a.style.height = "123px";
      this.parentNode.appendChild(a);
      for (i = 0; i < arr.length; i++) {
        if (arr[i].substr(0, val.length).toUpperCase() == val.toUpperCase()) {
          b = document.createElement("DIV");
          b.innerHTML = "<strong>" + arr[i].substr(0, val.length) + "</strong>";
          b.innerHTML += arr[i].substr(val.length);
          b.innerHTML += "<input type='hidden' value=\"" + arr[i] + "\">";
          b.addEventListener("click", function(e) {
              inp.value = this.getElementsByTagName("input")[0].value;              
              closeAllLists();
              submitNewClade();
          });
          a.appendChild(b);
        } else {
            var theindex = arr[i].indexOf(val)
            if ( theindex != -1) {
                b = document.createElement("DIV");
                b.innerHTML = arr[i].substr(0, theindex);
                b.innerHTML += "<strong>" + arr[i].substr(theindex, val.length) + "</strong>";
                b.innerHTML += arr[i].substr(theindex + val.length);
                b.innerHTML += "<input type='hidden' value=\"" + arr[i] + "\">";
                b.addEventListener("click", function(e) {
                    inp.value = this.getElementsByTagName("input")[0].value;              
                    closeAllLists();
                    submitNewClade();
                });
                a.appendChild(b);
            }
        }
      }
  });
  inp.addEventListener("keydown", function(e) {
      var x = document.getElementById(this.id + "autocomplete-list");
      if (x) x = x.getElementsByTagName("div");
      if (e.keyCode == 40) {
        currentFocus++;
        addActive(x);
      } else if (e.keyCode == 38) { //up
        currentFocus--;
        addActive(x);
      } else if (e.keyCode == 13) {
        e.preventDefault();
        if (currentFocus > -1) {
          if (x) x[currentFocus].click();
        }
      }
  });
  function addActive(x) {
    if (!x) return false;
    removeActive(x);
    if (currentFocus >= x.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = (x.length - 1);
    x[currentFocus].classList.add("autocomplete-active");
  }
  function removeActive(x) {
    for (var i = 0; i < x.length; i++) {
      x[i].classList.remove("autocomplete-active");
    }
  }
  function closeAllLists(elmnt) {
    var x = document.getElementsByClassName("autocomplete-items");
    for (var i = 0; i < x.length; i++) {
      if (elmnt != x[i] && elmnt != inp) {
        x[i].parentNode.removeChild(x[i]);
      }
    }
  }
  document.addEventListener("click", function (e) {
      closeAllLists(e.target);
      });
}

function addLegend(hardMax) {
    const svg1 = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    // set width and height
    svg1.setAttribute("width", "60");
    svg1.setAttribute("height", "120");
    var colors = 10
    // create a circle
    
    for (var i = 0; i < colors + 1; i++) {
        var hue = getHue(i / colors)
        var cir1 = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect",
          );
        cir1.setAttribute("x", "0");
        cir1.setAttribute("y", "" + 100 - 10 * i);
        cir1.setAttribute("width", "10");
        cir1.setAttribute("height", "10");
        cir1.setAttribute("fill", rgbToHex(HSVtoRGB(hue,1,1)));
        cir1.setAttribute("fill-opacity", "" + (.05 + i / colors * .70))
        svg1.appendChild(cir1);
    }
    for (var i = 0; i < colors; i++) {
        var cir1 = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "line",
          );
        cir1.setAttribute("x1", "10");
        cir1.setAttribute("y1", "" + (10 * i + 10));
        cir1.setAttribute("x2", "7");
        cir1.setAttribute("y2", "" + (10 * i + 10));
        cir1.setAttribute("stroke", "black");
        svg1.appendChild(cir1);
    }
    var line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line",
      );
    line.setAttribute("x1", "10");
    line.setAttribute("y1", "0");
    line.setAttribute("x2", "10");
    line.setAttribute("y2", "110");
    line.setAttribute("stroke", "black");
    svg1.appendChild(line);
    for (var i = 1; i < colors + 1; i++) {
        var txt = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "text",
          );
        txt.setAttribute("x", "15");
        txt.setAttribute("y", "" + 100 - 10 * i + 14);
        var textNode = document.createTextNode("" + getRounded(hardMax * i / colors) + "%");
        txt.setAttribute("font-size","smaller")
        txt.appendChild(textNode);
        svg1.appendChild(txt);
    }

    
    // attach it to the container


    // attach container to document
    document.getElementById("legend").innerHTML = "<br>Relative Frequency<br>"
    document.getElementById("legend").appendChild(svg1);
  }

  function loadWaterGrid() {
    $.ajax({
        type:    "GET",
        async: false,
        url:        "https://phylogeographer.com/data/watergrid.txt",
        success: function(text) {
          //parsePrecomputed(text.split("\r\n"))
          parseWatergrid(text.split("\r\n"))
        }}          
      )
}


var waterGrid = []

function parseWatergrid(lines) {
    for (var i = 0; i < lines.length; i++) {
        waterGrid[i] = []
        var thisLine = lines[i]
        for (var j = 0; j < thisLine.length; j++) {
            waterGrid[i][j] = thisLine[j]
            //if (thisLine[j] == "1") {

            //    var bounds = getGridSquareBounds(i,j)
            //    var rect = L.rectangle(bounds, {color: 'blue', weight: 1})
            //    rect.addTo(lmap)
            //}
        }        
    }
}

function getGridSquareBounds3(row, col) {
    return [[latRange[0] + row / 3, lonRange[0] + col / 3],[latRange[0] + (row + 1) / 3, lonRange[0] + (col + 1) / 3]]
}

function processExport(radius) {
    thedenom = []
    qMap(radius)
    var max = getMaxOfSurface(radius)
    recalibrateMax(max)
    expor8()
}

function addMarkers() {
    if (pointLayer) {
        pointLayer.removeFrom(lmap)
    }
    var uniqMapInput = getUniqueMapInput(targetPointRadiiMap)
    var uniqMap = getUniqueMap(uniqMapInput)

    var circleifiedOutput = circleify(uniqMap)
    var circleified = circleifiedOutput["circles"]
    var centers = circleifiedOutput["centers"]
    //var circleified =  circleify(uniqMap)
    var points = []
    for (var i = 0; i < circleified.length; i++) {
        var marker = L.marker([circleified[i]["lat"], circleified[i]["lng"]], {icon:mapIcon, title:circleified[i]["id"]}).bindPopup('<iframe class="resized" src="https://predict.yseq.net/mt-clade-finder/interactive_tree.php?snps=' +  circleified[i]["clade"] + '--" width="560" height="315"></iframe>', {
maxWidth: 560
})
        points.push(marker)
        markers[circleified[i]["id"]] = marker;
        circ[circleified[i]["id"]] = circleified[i];
    }
    starIcon = L.icon({
        iconUrl: 'images/star2.png',
        iconSize:     [64, 44], // size of the icon
    iconAnchor:   [32, 44], // point of the icon which will correspond to marker's location
    popupAnchor:  [0, -54] // point from which the popup should open relative to the iconAnchor
    
     })
    for (var i = 0; i < centers.length; i++) {
        var marker = L.marker([centers[i]["lat"], centers[i]["lng"]], {icon:starIcon})
        points.push(marker)
    }
    
    pointLayer = L.layerGroup(points);
}

function getUniqueMapInput(prm) {
    var pointRadiiKeys = Object.keys(prm)
    var uniqMapInput = []
    for (var i = 0; i < pointRadiiKeys.length; i++) {
        for (var j = 0; j < prm[pointRadiiKeys[i]]; j++) {
            var keysplit = pointRadiiKeys[i].split(",")
            uniqMapInput.push({lat: parseFloat(keysplit[0]),
                lng: parseFloat(keysplit[1]),
                clade:targetPointRadiiIdSubclades[pointRadiiKeys[i]][j]["clade"],
                id:targetPointRadiiIdSubclades[pointRadiiKeys[i]][j]["id"],
                count:1
            })
        }
        
    }
    return uniqMapInput
}

function oneCircle(cLat, cLon, points, radius, offset) {
    var ps = []
    for (var j = 0; j < points.length; j++) {
        var circLat = Math.cos(j * 2 * Math.PI / points.length) * offset * radius
        var circLng = Math.sin(j * 2 * Math.PI / points.length) * offset * radius
        ps.push({lat: cLat + circLat, lng: cLon + circLng, id:points[j]["id"], clade: points[j]["clade"]})
    }
    return ps
}

function getSlices(points) {
    var remainder = points.length;
    var ringCap = 10
    var slices = []
    var lastRingEndRange = 0
    while (remainder > 0) {
        var thisRing = Math.min(remainder, ringCap)
        slices.push({points: points.slice(lastRingEndRange,thisRing), length: ringCap})
        remainder -= thisRing
        ringCap += 10
    }
    return slices
}

function circleify(spotMap) {
    var spotKeys = Object.keys(spotMap)
    var circleified = []
    var offset = 0.01
    var centers = []
    for (var i = 0; i < spotKeys.length; i++) {
        var thisSpot = spotMap[spotKeys[i]]
        var length = thisSpot["points"].length
        if (length == 1) {
            circleified.push({lat: thisSpot["lat"], lng: thisSpot["lng"], id:thisSpot["points"][0]["id"], clade:thisSpot["points"][0]["clade"]})
        } else {
            var slices = getSlices(thisSpot["points"])
            for (var sl = 0; sl < slices.length; sl++) {
                var ps = oneCircle(thisSpot["lat"], thisSpot["lng"], slices[sl]["points"], slices[sl]["length"], offset)            
                for (var j = 0; j < ps.length; j++) {
                    circleified.push(ps[j])
                }
            }
            centers.push({lat: thisSpot["lat"], lng: thisSpot["lng"]})
            
            //for (var j = 0; j < length; j++) {
                //var circLat = Math.cos(j * 2 * Math.PI / length) * offset * length
                //var circLng = Math.sin(j * 2 * Math.PI / length) * offset * length
                //circleified.push({lat: thisSpot["lat"] + circLat, lng: thisSpot["lng"] + circLng, id:thisSpot["points"][j]["id"], clade: thisSpot["points"][j]["clade"]})

            //}
        }
    }
    //return [circleified, centers]
    return {circles:circleified, centers: centers}
}


