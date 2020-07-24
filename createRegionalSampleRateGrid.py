# -*- coding: utf-8 -*-
"""
Created on Fri Jul 17 16:58:31 2020

@author: hunte
"""

import sys
sys.path.insert(0, 'C:\\Users\\hunte\\.spyder-py3\\')
import pandas as pd
import math

europeBounds = {'minLat':-56, 'maxLat':75.0, 'minLon':-180.0, 'maxLon':180.0}
geomFile = "simplifiedGeomsWorld.txt"
countryAreasFile = "countryAreas2018.csv"
augmentAreasFile = "augmentedAreas.csv"
countryRegionsFile = "countryRegions.txt"
projects = ["allYFull"]

rows = 200
cols = 200
stDev = 100
rowScalarProjectOffsets = {}
rowProjectOffsets = {}

mapsOutputDir = "maps_" + str(rows) + "x" + str(cols)


countrySpecificityFile = "C:\\PhyloGeographer\\HeatMaps\\countrySpecificity.csv"
regionSpecificityFile = "C:\\PhyloGeographer\\HeatMaps\\regionSpecificity.csv"
countryRadiiFile = "country_radii.csv"

pointDataFile = "pointData.csv"


countryRegionGeocodesFile = "iso3166-2.tsv"
countryGeocodesFile = "iso3166-country.tsv"



countryRegions = pd.read_csv(countryRegionGeocodesFile, sep='\t')
codeLookup = {}

codes = countryRegions["code"]
lats = countryRegions["lat"]
lngs = countryRegions["lng"]

for i in range(len(codes)):
    codeLookup[codes[i]] = [lats[i],lngs[i]]

countryOnly = pd.read_csv(countryGeocodesFile, sep='\t')
codes = countryOnly["code"]
lats = countryOnly["lat"]
lngs = countryOnly["lng"]

for i in range(len(codes)):
    codeLookup[codes[i]] = [lats[i],lngs[i]]

def parseCountries(fil):
    countries = {}
    k = pd.read_csv(fil)
    codes = k["code"]
    counts = k["count"]
    
    for i in range(len(codes)):
        countries[codes[i]] = counts[i]
    return countries

countryLevel = parseCountries(countrySpecificityFile)

def augmentAreas(areas, fil):
    k = pd.read_csv(fil)
    codes = k["code"]
    augAreas = k["area"]
    for i in range(len(codes)):
        areas[codes[i]] = augAreas[i]
    return areas

def parseAreas(fil):
    areas = {}
    k = pd.read_csv(fil)
    codes = k["Country Code"]
    theareas = k["2018"]
    for i in range(len(codes)):
        areas[codes[i]] = theareas[i]
    return areas
areas = parseAreas(countryAreasFile)

def getCountryPositionsAndAreas(countryLevel, areas):
    countryPositionAndAreaSqrt = {}
    for country in countryLevel:
        if country not in areas:
            print(country + " not in file")
        else:
            pos = codeLookup[country]
            countryPositionAndAreaSqrt[country] = {"lat":pos[0], "lng":pos[1], "count": countryLevel[country], "SQRTarea":math.sqrt(areas[country])}
    return countryPositionAndAreaSqrt

augmentAreas(areas, augmentAreasFile)

countryPosAndArea = getCountryPositionsAndAreas(countryLevel, areas)

def writeOutCountryAreaRadius(countryAreaRadius, countryRadiiFile):
    with open(countryRadiiFile, "w") as w:
        w.write("geocode,radius\n")
        for country in countryAreaRadius:
            w.write(country + "," + str(round(getStDev(countryAreaRadius[country]["SQRTarea"])/100,2)) + "\n")
    w.close()
    
writeOutCountryAreaRadius(countryPosAndArea, countryRadiiFile)

def getRegionPositions(fil):
    regionCounts = parseCountries(regionSpecificityFile)
    regionPositions = {}
    for code in regionCounts:
        pos = codeLookup[code]
        regionPositions[code] = {"lat":pos[0], "lng":pos[1], "count": regionCounts[code]}
        
    return regionPositions

regionPositions = getRegionPositions(regionSpecificityFile)




from PhyloGeographerCommon.GridOps import GridOps

pgInstance = GridOps(europeBounds, rows, cols, countryRegionsFile, geomFile,"C:\\PhyloGeographer\\preprocessing\\data\\geometries")

def getStDev(sqrtArea):
    stDev = max(100, sqrtArea)
    return min(1000, stDev)
    
def getCountryWeights(countryObj):
    col, row = pgInstance.latLonToIndex(countryObj["lat"],countryObj["lng"])
    
    stDev = getStDev(countryObj["SQRTarea"])
    weights = pgInstance.turnRowIntoGridWeightsZScore(row, stDev)
    return weights, math.floor(row), math.floor(col)


def addCountries(countries):
    for country in countries:
        print(country)
        count = countries[country]["count"]
        weights, row, col = getCountryWeights(countries[country])
        theScalar = np.multiply(weights, count)
        addGridRowOffset(theScalar, col, "allYFull")

def addRegions(regions):
    for region in regions:
        regionObj = regions[region]
        print(region)
        count = regionObj["count"]
        col, row = pgInstance.latLonToIndex(regionObj["lat"],regionObj["lng"])
        weights = pgInstance.turnRowIntoGridWeightsZScore(row, 100)  
        theScalar = np.multiply(weights, count)
        col = math.floor(col)
        row = math.floor(row)
        addGridRowOffset(theScalar, col, "allYFull")
    
def parseKitsCSV(fil):    
    kits = []
    print(fil)
    k = pd.read_csv(fil)
    
    lat = k["latitude"]
    lon = k["longitude"]
    
    for i in range(len(lat)):
        kits.append(pgInstance.latLonToIndex(lat[i],lon[i]))
    return kits


def collapseToScalars(arr):
    thearr = {}
    for elem in arr:
        if elem not in thearr:
            thearr[elem] = 1
        else:
            thearr[elem] = thearr[elem] + 1
    return thearr

def turnScalarsToMapOfColArray(scalarz):
    colArrayMap = {}
    for col in scalarz:
        count = scalarz[col]
        if count not in colArrayMap:
            colArrayMap[count] = [col]
        else:
            colArrayMap[count].append(col)
    return colArrayMap



import numpy as np

allTotes = np.zeros((cols,rows))
grids = {}
for proj in projects:
    grids[proj] = np.zeros((cols,rows))

from PIL import Image, ImageDraw
white = (255, 255, 255)
black = (0,0,0)
water = (0,213,255)
zeroCoverage = (97,87,59)

#colorLimitsAbs = [1, 2, 4, 8, 16, 32]
colorLimitsFreqsX3 = [.001,.003,.01,.03,.1,.3]
colorLimitsFreqsX2 = [.015625,.03125,.0625,.125,.25,.5]
colorLimitsFreqs = colorLimitsFreqsX2
#colorLimits = [10, 20, 40, 80, 160, 320]
colorStepsFreqs = [(254,240,217,1),(253,212,158,1),(253,187,132,1),(252,141,89,1),(227,74,51,1),(179,0,0,1)]
colorLimitsAbs = [.32, .64, 1.28, 2.56]
colorStepsAbs = [(254,229,217,1),(252,174,145,1),(251,106,74,1),(203,24,29,1)]
        

def addGridRowOffset(grid, offset, proj):
    row = 0
    while row < rows:
        col = 0
        while col < cols:
            allTotes[col][row] = allTotes[col][row] + grid[abs(col - offset)][row]
            grids[proj][col][row] = grids[proj][col][row] + grid[abs(col - offset)][row]
            col = col + 1
        row = row + 1

def turnFreqMapToBitmapAbsAll(name, freqMap, cLimits, cSteps):
    image = Image.new("RGB", (cols, rows), water)
    draw = ImageDraw.Draw(image)
    
    for col in range(cols):
        for row in range(rows):

            freq = freqMap[col][row]
 
            if worldValidity[col][row] == True:
                draw.point([col, rows - row - 1], pgInstance.getColor(freq, cLimits, cSteps, zeroCoverage))        
    
    for row in range(rows):
        therow = rows - row - 1
        for col in range(cols):
            if borderPoints[col, row]:
                draw.point([col, therow], black)
    #sanitizedSignalName = signal.replace('/','-')
    image.save(mapsOutputDir + "\\" + name + ".png")

def turnFreqMapToBitmapRelHaplo(name, freqMap, cLimits, cSteps, allTotes, cutoff):
    image = Image.new("RGB", (cols, rows), water)
    draw = ImageDraw.Draw(image)
    
    for col in range(cols):
        for row in range(rows):

            freq = freqMap[col][row]
 
            if worldValidity[col][row] == True:
                if allTotes[col][row] >= cutoff:    
                    draw.point([col, rows - row - 1], pgInstance.getColor(freq, cLimits, cSteps))
                else:
                    draw.point([col, rows - row - 1], zeroCoverage)
    
    for row in range(rows):
        therow = rows - row - 1
        for col in range(cols):
            if borderPoints[col, row]:
                draw.point([col, therow], black)
    #sanitizedSignalName = signal.replace('/','-')
    image.save(mapsOutputDir + "\\" + name + ".png")
    
(borderPoints, worldValidity) = pgInstance.readOrComputeValidity()

addRegions(regionPositions)
addCountries(countryPosAndArea)
print(np.sum(allTotes))
import shutil
import os

shutil.rmtree(mapsOutputDir, ignore_errors=True)
os.mkdir(mapsOutputDir)
turnFreqMapToBitmapAbsAll("absolute_world_coverage", allTotes, colorLimitsAbs, colorStepsAbs)

def writeGridFloatsCondensedCSV(grid, fil):
    with open(fil, "w") as w:
        for r in grid:
            rounded = [str(max(0.01, round(v,2))) for v in r]
            w.write(",".join(rounded) + "\n")
    w.close()
            

pgInstance.writeGridFloats(allTotes, "all_coverage")
np.seterr(divide='ignore', invalid='ignore')

for grid in grids:
   turnFreqMapToBitmapRelHaplo(grid + "_frequency", np.divide(grids[grid], allTotes), colorLimitsFreqs, colorStepsFreqs, allTotes, colorLimitsAbs[0])
    
writeGridFloatsCondensedCSV(allTotes, "sample_weights_test.csv")