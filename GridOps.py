# -*- coding: utf-8 -*-
"""
Created on Sat Jun 16 16:45:43 2018

@author: hunte
"""
from shapely.geometry import Point
from shapely.geometry import Polygon
import os
import pickle
import pandas as pd
import numpy as np
import math

class GridOps:
    def __init__(self, bounds, cols, rows, countryRegionsFile, geometriesFile, validityAndBordersDir):
        self.bounds = bounds
        self.cols = cols
        self.rows = rows
        self.cellWidth = (bounds["maxLon"] - bounds["minLon"]) / cols
        self.cellHeight = (bounds["maxLat"] - bounds["minLat"]) / rows
        self.countryRegionsFile = countryRegionsFile
        self.geometriesFile = geometriesFile
        self.validityAndBordersDir = validityAndBordersDir
        
    def latLonToIndex(self, lat, lon):
        c = (lon - self.bounds["minLon"]) / self.cellWidth
        r = (lat - self.bounds["minLat"]) / self.cellHeight
        return [c, r]
    def getColor(self, frq, colorLimits, colorSteps, defaultColor=(255, 255, 255, 1)):
        colors = len(colorLimits)
        i = colors - 1
        while (frq < colorLimits[i] and i >= 0):
            i = i - 1
        if i == -1:
            return defaultColor
        else:
            return colorSteps[i]
        
    def cornersInside(self, row, col, geoms):
        left = self.bounds["minLon"] + col * self.cellWidth
        bot = self.bounds["minLat"] + row * self.cellHeight
        top = bot + self.cellHeight
        right = left + self.cellWidth
        points = [Point((left, top)), Point((left, bot)), Point((right, top)), Point((right, bot))]
        ps = 0
        for i in range(4):
            if any(countryGeom.contains(points[i]) for countryGeom in geoms):
                ps += 1
        return ps
    
    def assignBorders(self, countryName, borderPoints, countryRegions, geometries, rowMin, rowMax, colMin, colMax):
        countryGeoms = []
        if countryName in countryRegions:
            for countryRegion in countryRegions[countryName]:
                countryGeoms.append(geometries[countryRegion])
        if countryName in geometries:
            countryGeoms.append(geometries[countryName])
        row = rowMin
        while (row < rowMax):
            col = colMin
            centerLat = self.bounds["minLat"] + (float(row) + 0.5) * self.cellHeight        
            while (col < colMax):
                if borderPoints[col, row] == False:
                    thisPoint = Point((self.bounds["minLon"] + (float(col) + 0.5) * self.cellWidth, centerLat))
                    cornersIn = self.cornersInside(row, col, countryGeoms)
                    if any(countryGeom.contains(thisPoint) for countryGeom in countryGeoms):                        
                        if cornersIn < 4:
                            borderPoints[col, row] = True
                    else:
                        if cornersIn > 0:
                            borderPoints[col, row] = True
        
                col = col + 1      
            row = row + 1    
            
    def turnCountryIntoGridWeights(self, countryName, countryRegions, geometries, validity): 
        countryGeoms = []
        if countryName in countryRegions:
            for countryRegion in countryRegions[countryName]:
                countryGeoms.append(geometries[countryRegion])
        if countryName in geometries:
            for gname in [g for g in geometries if countryName in g]:
                countryGeoms.append(geometries[gname])
        minLon,minLat,maxLon,maxLat = countryGeoms[0].bounds
        for geom in countryGeoms:
            b = geom.bounds
            minLon = min(minLon,b[0])
            minLat = min(minLat,b[1])
            maxLon = max(maxLon,b[2])
            maxLat = max(maxLat,b[3]) 
        (colMin,rowMin) = self.latLonToIndex(minLat,minLon)
        (colMax,rowMax) = self.latLonToIndex(maxLat,maxLon)
        rowMin = max(int(rowMin),0)
        rowMax = min(int(rowMax) + 1,self.rows)
        colMin = max(int(colMin),0)
        colMax = min(int(colMax) + 1,self.cols)
        #print(rowMin,rowMax,colMin,colMax)
        row = rowMin
        while (row < rowMax):
            col = colMin
            centerLat = self.bounds["minLat"] + (float(row) + 0.5) * self.cellHeight
            while (col < colMax):
                if validity[col][row] == False:
                    thisPoint = Point((self.bounds["minLon"] + (float(col) + 0.5) * self.cellWidth, centerLat))            
                    if any(countryGeom.contains(thisPoint) for countryGeom in countryGeoms):        
                        validity[col][row] = True                
                col = col + 1      
            row = row + 1
        return rowMin, rowMax, colMin, colMax
               
    def loadGeometries(self, geometries, countryRegions):
        minCharsLine = 4

        with open(self.geometriesFile, "r", encoding='utf-8-sig') as lines: 
            wasEqualsEOLError = False
            parsePointsNow = False
            for line in lines:
                print ([line[0:20]])
                #print ([line[-1:]])
                #print ('equals slash n', line[-1:] == '\n')
                if len(line) > minCharsLine:
                    if wasEqualsEOLError:
                        pointsSplit = line.split(" ")
                        parsePointsNow = True
                    else:
                        countrySplit = line.split("=")
                        countryName = countrySplit[0]
                        print("parsing",countryName)
                        if len(countrySplit) > 0 and len(countrySplit[1]) > 9:
                            pointsSplit = countrySplit[1].split(" ")
                            parsePointsNow = True
                        else:
                            wasEqualsEOLError = True
                            parsePointsNow = False
                    if parsePointsNow:
                        print(pointsSplit)
                        polyPoints = []
                        for pSplit in pointsSplit:
                            lonLatSplit = pSplit.split(",")
                            #if countryName == "Sri Lanka4":
                                #print(lonLatSplit)
                            if len(lonLatSplit)>1:
                                polyPoints.append((float(lonLatSplit[0]), float(lonLatSplit[1])))
                            
                        polygon = Polygon(polyPoints)   
                        geometries[countryName] = polygon#self.simplifyGeometry(polygon, 5)
                        wasEqualsEOLError = False
                else:
                    print([line], ' less than ', minCharsLine)
                    
        with open(self.countryRegionsFile, "r", encoding='utf-8-sig') as lines:    
            for line in lines:                        
                countryRegionSplit = line.split("=")
                countryName = countryRegionSplit[0]
                countryRegions[countryName] = countryRegionSplit[1][0:len(countryRegionSplit[1])-1].split(",")
        #self.writeSimplified(geometries)
        
    def validityFileName(self):
        return self.validityAndBordersDir + "\\validity_lat_" + str(int(self.bounds["minLat"])) + "_" + str(int(self.bounds["maxLat"])) + "_lon_" + str(int(self.bounds["minLon"])) + "_" + str(int(self.bounds["maxLon"])) + "_rowscols_" + str(self.rows) + "x" + str(self.cols) + ".csv" #"C:\\PhyloGeographer\\preprocessing\\data\\geometries
    
    def borderFileName(self):
        return self.validityAndBordersDir + "\\borders_lat_" + str(int(self.bounds["minLat"])) + "_" + str(int(self.bounds["maxLat"])) + "_lon_" + str(int(self.bounds["minLon"])) + "_" + str(int(self.bounds["maxLon"])) + "_rowscols_" + str(self.rows) + "x" + str(self.cols) + ".pkl"

    def readOrComputeValidity(self):
        if os.path.isfile(self.validityFileName()):
            worldValidity = np.zeros((self.cols, self.rows),dtype="bool")  
            validityCSV = pd.read_csv(self.validityFileName())
            for col in validityCSV.columns:
                colInt = int(col)            
                for row in range(len(validityCSV["0"])):                
                    if (validityCSV[col][row] == 1):
                        worldValidity[colInt][row] = True        
            borderFile = open(self.borderFileName(), "rb")
            
            borderPoints = pickle.load(borderFile)['border']
            return (borderPoints, worldValidity)
        else:
            worldValidity = np.zeros((self.cols, self.rows),dtype="bool")  
            geometries = {}
            countryRegions = {}
            self.loadGeometries(geometries, countryRegions)
            writeArray = np.zeros((self.rows, self.cols),dtype="int64")        
            borderPoints = np.zeros((self.rows, self.cols),dtype="bool") 
            for regionName in geometries:        
                print("computing validity for", regionName)
                rowMin, rowMax, colMin, colMax = self.turnCountryIntoGridWeights(regionName, countryRegions, geometries, worldValidity)
                self.assignBorders(regionName, borderPoints, countryRegions, geometries, rowMin, rowMax, colMin, colMax)            

            for col in range(self.cols):
                for row in range(self.rows):
                    if worldValidity[col][row] == True:
                        writeArray[row][col] = 1
            print(worldValidity)
            with open(self.validityFileName(), 'w') as file_handler:            
                file_handler.write(','.join(map(str, range(self.cols))) + "\n")
                for index in range(self.rows):                
                    file_handler.write(','.join(map(str, writeArray[index])) + "\n")
            file_handler.close()
            borderFile = open(self.borderFileName(), "wb")
            borderOut = {}
            borderOut['border'] = borderPoints
            pickle.dump(borderOut, borderFile)
            return (borderPoints, worldValidity)
    
    def writeGridFloats(self, grid, filename):
        borderFile = open(filename + "_" + str(self.rows) + "x" + str(self.cols) + ".pkl", "wb")
        borderOut = {}
        borderOut['grid'] = grid
        pickle.dump(borderOut, borderFile)
        
    def readGridFloatsPickle(self, filename):
        borderFile = open(filename + "_" + str(self.rows) + "x" + str(self.cols) + ".pkl", "rb")
        return pickle.load(borderFile)['grid']
    def readGridFloats(self, filename):
        filename + "_" + str(self.rows) + "x" + str(self.cols) + ".pkl"
        gridCSV = pd.read_csv(filename)
        grid = np.zeros((self.cols,self.rows),dtype="float16")
        for col in self.cols:
            for row in self.rows:
                grid[col][row] = gridCSV[col][row]
        return grid

    def turnRowIntoGridWeightsZScore(self, signalRow, stdev):
        weightedCells = np.zeros((self.cols,self.rows))
        row = 0
        stdev2 = stdev * stdev
        min1halfoverstdev2 = -1/2/stdev2
        lat = self.bounds["minLat"] + (float(signalRow) + 0.5) * self.cellHeight
        lon = self.bounds["minLon"] + 0.5 * self.cellWidth
        while (row < self.rows):
            col = 0
            centerLat = self.bounds["minLat"] + (float(row) + 0.5) * self.cellHeight
            yDisplacementKm = (centerLat - lat) * 111.321
            yDisp2 = yDisplacementKm * yDisplacementKm
            latOfMidpoint = (centerLat + lat) / 2
            cosineMidpoint = math.cos(math.radians(latOfMidpoint))
            while (col < self.cols):
                centerLon = self.bounds["minLon"] + (float(col) + 0.5) * self.cellWidth
                xDisplacementKm = (centerLon - lon) * cosineMidpoint * 111.321
                xDisp2 = xDisplacementKm * xDisplacementKm
                dist2 = yDisp2 + xDisp2
                #dist = math.sqrt(dist2)
                #if (dist != 0):            
                thisWeight = math.pow(math.e, dist2 * min1halfoverstdev2) / stdev# / dist
                #else:
                #    adjDist2 = (cellWidth * cellWidth / 32 * cosineMidpoint * cosineMidpoint) * 111.321 * 111.321
                #    theMax = math.pow(math.e, adjDist2 * min1halfoverstdev2) * coef / math.sqrt(adjDist2)
                #    thisWeight = theMax
                weightedCells[col][row] = thisWeight       
                col = col + 1
            row = row + 1
            
        return weightedCells
    
    def simplifyGeometry(self, geometry, km):
        originalVertices = len(geometry.boundary.coords)
        geometry = geometry.simplify(km / 111.321)
        newVertices = len(geometry.boundary.coords)
        print(originalVertices, 'vertices simplified to', newVertices)
        return geometry
    
    def geomToString(self, country, geom, decimals):
        coords = str(geom)[10:-2].split(", ")
        simplPointStrings = []
        for coord in coords:
            point = coord.split(" ")
            pointlat = round(float(point[0]),decimals)
            pointlon = round(float(point[1]),decimals)
            simplPointStrings.append(",".join([str(pointlat), str(pointlon)]))
        return country + "=" + " ".join(simplPointStrings)

    def writeSimplified(self, geometries):
        with open("simplifiedGeoms", 'w') as file_handler:
            for geometry in geometries:
                file_handler.write(self.geomToString(geometry, geometries[geometry], 2) + "\n")
        file_handler.close()