/*******************************************************
 * Author: 	Omar Hesham, June 2015.
 * Advanced Real-Time Simulation Lab.
 * Carleton University, Ottawa, Canada.​​
 * License: [TODO] Something opensource
 *
 * Project: 	Online Cell-DEVS Visualizer
 * File: 		model.js
 * Description: The Model component of the Grid object
 * 				initializes using input data (data.js),
 * 				stores, and periodically updates the
 * 				grid with new incoming time frames.
 */

// [TODO] Modularize the entire "grid" object for easy namespace and member privacy
//

/** Not used now; maybe for archiving or speeding up a tight loop */
grid.model.leanData=[	// Entire Data Stream
						[	// Single frame
							[	// Rows
								0	// Cell value
							]
						]
					];
grid.palette = [];
grid.model.data = [];


grid.parseInputAttribute = function(attributeName, input){
	// [TODO] Might need proper Object-oriented parsing instead of a naive string search
	var regexp = new RegExp(attributeName, 'i'); // i: case insensitive

	// Check if the attribute exists in the input file
	if(regexp.test(input)){
		// Find the indices of the attribute value ("...attributeName: <start>value<end>\n...")
		var start = input.indexOf(':', input.search(regexp)+attributeName.length) + 1;
		// Assuming each attribute is on a separate line, end of value is at the linebreak
		var end = input.substr(start).search(/[\n\r]/);
		// [If parsing numbers explicitly:]
		// Find index of end of number: basically any character not (^) a number.
		// Number can be: digit(\d) point(\.) space(\s) -ve(\-) plus(+) exponent(e or E)
		//var end = input.substr(start).search(/[^\d\.\s\-+eE]/);
		return input.substr(start, end);
	}
	else{
		return null;
	}
}

grid.model.frameBuffer = [];
grid.model.lastT = [];
grid.model.tempCacheFrame = [];
grid.parseYMessages = function(inLog, safeEnd, isLastChunk){
	// Determine the key string used in the log (varies by simulation engine)
	var keyString = '';
	// Test wether log uses "Mensaje" or "0 / L / "
	if(inLog.substring(0,200).indexOf("Mensaje ") >= 0){
		keyString= 'Mensaje ';
	}else{
		// It might be "0 / L / " Lopez type
		if(inLog.substring(0,200).indexOf('0 / L / ') >= 0){
			keyString = '0 / L / ';
		}else{
			window.alert('Could not load the selected log file. Format unsupported.');
			return;
		}
	}

	var lastYindex = inLog.lastIndexOf(keyString+'Y', safeEnd); // last Y-msg index
	// Return if no Y-messages in this chunk
	if(lastYindex == -1) return;
	var caret = 0;	// current character index
	var eof = false; // end of file
	var frameIndex = 0;
	var data 		 = grid.model.data;				//shorthands
	var cache 		 = grid.view.dataCache;
	var cachePeriod  = grid.view.CACHE_PERIOD;
	var cacheEnabled = grid.view.CACHE_ENABLED;


	for (var msgCount=0;!eof;msgCount++){
		// Each Y-message encodes the layer, variable, and/or port it belongs to. Great!
		caret = inLog.indexOf(keyString+'Y', caret);
		if(caret == lastYindex)	eof = true;	// we've reached the last message

		// Take a single Y-msg
		var msg = inLog.substring(caret, inLog.indexOf('\n', caret));
		var msgSplit = msg.split('/');	// msg contents delimited by '/'

		// Which component to update (ignore '-')? (for now, only process component[0])
		if(msg.split('-').join('').indexOf(grid.model.components[0]+'(')==-1){
			caret += msg.length;
			continue;
		}

		// Process Y-messages here or during grid update? [TODO] postpone it till update to detect layers
		var yStart = 0; var yEnd = 0;// character indices within a Y message
		/**
		 * An update packet contains [timestamp, positions, value]
		 * Parse each of those components.
		 */
		var t = [];	// timestamp [hour,minute,second,ms]
			// Find "hour"
			yStart 	= msg.search(/\d/);							// find first digit
			yEnd 	= msg.indexOf(':', yStart);					// find end of number
			t[0] 	= parseInt(msg.substr(yStart, yEnd), 10);	// parse to decimal int
			//Find "minute"
			yStart  = msg.substr(yEnd).search(/\d/) + yEnd;
			yEnd 	= msg.indexOf(':', yStart);
			t[1]	= parseInt(msg.substr(yStart, yEnd), 10);
			//Find "second"
			yStart	= msg.substr(yEnd).search(/\d/) + yEnd;
			yEnd 	= msg.indexOf(':', yStart);
			t[2]	= parseInt(msg.substr(yStart, yEnd), 10);
			//Find "millisecond"
			yStart	= msg.substr(yEnd).search(/\d/) + yEnd;
			yEnd 	= msg.indexOf('/', yStart);
			t[3]	= parseInt(msg.substr(yStart, yEnd), 10);

		var p = [], pSplit;	// position formatted as (y,x,z)
			yStart  = msg.indexOf('(', yEnd)+1;
			yEnd 	= msg.indexOf(')', yStart);
			pSplit	= msg.substring(yStart, yEnd).split(',');
			// Skip this Y-msg if it's the output of the parent coupled model
			if(pSplit.length<2){
				caret += msg.length; continue;
			}
			// Else, parse it as an output of a valid cell position
			  p[1] 	= parseInt(pSplit[0],10); 					 // Y coord
			  p[0] 	= parseInt(pSplit[1],10); 					 // X coord
			  p[2] 	= parseInt(pSplit.length==3?pSplit[2]:0,10); // Z coord

		var port, v, portID;	// port name, value, and index
			if(msgSplit.length != 8){
				// This log is from DCD++
				port 	= 'out';
				portID	= 0;
				yStart	= msg.lastIndexOf('/') + 1;
				yEnd	= msg.length-1;
				v 		= parseFloat(msg.substr(yStart, yEnd));
			}else{
				// This log is from Lopez
				// e.g. "../ out_main / 6.0 /.." becomes port='main', v=6;
				// e.g. "../ out / 6.0 /.." becomes port='out', v=6;
				yStart 	= msgSplit[5].indexOf('out_');
				if(yStart!=-1)
					port = msgSplit[5].substr(yStart+4).trim();
				else if (msgSplit[5].indexOf('out') != -1) {
					yStart = 0;
					port = 'out';
				}
				v 		= parseFloat(msgSplit[6]);
				// Find port ID (index in the grid.model.ports array)
				portID	= grid.model.ports.indexOf(port);
				if(portID == -1 || yStart == -1){
					// Skip if: invalid port name
					//      or: 'out' messages (because we're using Lopez ports)
					caret += msg.length; continue;
				}
			}

		// Directly access the data buffer and push new Y message
		// TODO: make this steaming instead of bulk parsing
		if(util.isEqualArray1D(grid.model.lastT, t)){
			// Push new value to the frame buffer (create cell first if undefined)
			if(!grid.model.frameBuffer[p[2]]) 						  //z
				grid.model.frameBuffer[p[2]] = [];
			if(!grid.model.frameBuffer[p[2]][p[1]])					  //y
				grid.model.frameBuffer[p[2]][p[1]] = [];
			if(!grid.model.frameBuffer[p[2]][p[1]][p[0]])			  //x
				grid.model.frameBuffer[p[2]][p[1]][p[0]] = [];
			grid.model.frameBuffer[p[2]][p[1]][p[0]][portID] = v; 	  //buffer[z][y][x] = v

			// Make a cache copy
			if(cacheEnabled)
				cache[grid.view.cacheCount][p[2]][p[1]][p[0]][portID] = v; 	  //cache[frame][z][y][x] = v
		}
		else{ // Reached end of data for frame oldT. Dump buffer onto new data frame.

			// Create new data time frame (if not frame 0)
			if(!util.isEqualArray1D(grid.model.lastT, [0,0,0,0])){
				frameIndex = data.push({timestamp:grid.model.lastT.slice(),cells:[]}) - 1;
				grid.model.frameCount++;
			}
			else
				frameIndex = 0;

			// Create new cache frame every CACHE_PERIOD frames
			if(cacheEnabled && !(frameIndex%cachePeriod))
				// Deep copy previous cache frame, and post increment counter
				cache.push(JSON.parse(JSON.stringify(cache[grid.view.cacheCount++])));

			// Fill with log data (frame buffer)
			var gridCells = data[frameIndex].cells; // shorthand (avoid dereferencing in tight loop)
			for(var z=0; z<grid.model.dimZ;z++){
				if(grid.model.frameBuffer[z]){				// if layer (z) is part of framebuffer
					for (var y=0; y<grid.model.dimY;y++){
						if(grid.model.frameBuffer[z][y]){	// if row contains cell part of this framebuffer
							for (var x=0; x<grid.model.dimX;x++){
								if(grid.model.frameBuffer[z][y][x]){	// if cell is part of this framebuffer
									var tempArr = [x,y,z];
									gridCells.push({
										position: tempArr.slice(), //takes a copy not reference
										value: grid.model.frameBuffer[z][y][x].slice()
									});
								}
							}
						}
					}
				}
			}

			// Finally,  clear old frame buffer and finish processing that most recent msg
			grid.model.lastT = t.slice();							// set next timestamp
			grid.model.frameBuffer = [];							// clear timeframe
			grid.model.frameBuffer[p[2]] = [];						// clear layer
			grid.model.frameBuffer[p[2]][p[1]] = [];				// clear row
			grid.model.frameBuffer[p[2]][p[1]][p[0]] = [];			// clear cell
			grid.model.frameBuffer[p[2]][p[1]][p[0]][portID] = v; 	// store first value
			if(cacheEnabled)  										// and cache it
				cache[grid.view.cacheCount][p[2]][p[1]][p[0]][portID] = v;
		}

		if(eof && isLastChunk){	// process the very last frameBuffer during the very last chunk
			frameIndex = data.push({timestamp:grid.model.lastT.slice(),cells:[]}) - 1;
			var gridCells = data[frameIndex].cells; // shorthand (avoid dereferencing in tight loop)
			// Fill with log data (frame buffer)
			for(var z=0; z<grid.model.dimZ;z++){
				if(grid.model.frameBuffer[z]){				// if layer (z) is part of framebuffer
					for (var y=0; y<grid.model.dimY;y++){
						if(grid.model.frameBuffer[z][y]){	// if row contains cell part of this framebuffer
							for (var x=0; x<grid.model.dimX;x++){
								if(grid.model.frameBuffer[z][y][x]){	// if cell is part of this framebuffer
									var tempArr = [x,y,z];
									gridCells.push({
										position: tempArr.slice(), //takes a copy not reference
										value: grid.model.frameBuffer[z][y][x].slice()
									});
								}
							}
						}
					}
				}
			}
			grid.model.frameCount++; // we just added our last frame; increment the counter
		}

		// We're done, send caret to next message
		caret += msg.length;

		//if(!(msgCount%16384))	// Every ~1MB issue progress update
		//	console.log('\t'+(100*caret/lastYindex).toFixed(5) + '%');
	}
}
grid.initializeGridDim = function(){

	// Get dimensions from .ma file in base 10 (decimal), and default to 5 if NaN
	grid.model.dimX = function(){
						var x = Math.round(parseFloat(grid.parseInputAttribute('width', inp.file['ma-file']), 10));
						if(x<1) {
							x=1;
							console.error('Dimension X is not a +ve number! Defaulting to 1');
						}
						return x;
					  }();
	grid.model.dimY = function(){
						var x = Math.round(parseFloat(grid.parseInputAttribute('height', inp.file['ma-file']), 10));
						if(x<1) {
							x=1;
							console.error('Dimension Y is not a +ve number! Defaulting to 1');
						}
						return x;
					  }();
	grid.model.dimZ = 1;	// default single layer

	if(!grid.model.dimY || !grid.model.dimX){	// model uses dim() instead of 'width, height'
		var dim = grid.parseInputAttribute('dim', inp.file['ma-file']);
		var dimSplit = dim.substring(dim.indexOf('(')+1).split(','); // e.g. dim:(y,x,z)
		if (dimSplit.length==2){
			grid.model.dimY = parseInt(dimSplit[0],10);	// 10=decimal; yes, Y goes first... -_-`
			grid.model.dimX = parseInt(dimSplit[1],10);
			grid.model.dimZ = 1;
		} else if(dimSplit.length==3){
			grid.model.dimY = parseInt(dimSplit[0],10);
			grid.model.dimX = parseInt(dimSplit[1],10);
			grid.model.dimZ = parseInt(dimSplit[2],10);
		} else
			window.alert(dimSplit.length+"D grids are not supported at the moment. Only 2D and 3D grids are ;(");
	}

	console.log('Grid dimensions: (' + grid.model.dimX + ', '+ grid.model.dimY+','+grid.model.dimZ+')');
}

grid.initializeGridGlobalValue = function(){
	// Initial global value is 0 by default (|| 0)
	grid.model.initGlobalValue = parseFloat(grid.parseInputAttribute('initialvalue', inp.file['ma-file'])) || 0;
	console.log('Global intiial value: '+grid.model.initGlobalValue);
}
grid.initialRowValues = [];
grid.initializeGridRowValues= function(){
	var caret=0; // current character index or counter
	var rowCaret = 0;
	grid.initialRowValues = [];
	while (true){
		// Look for initial
		var row = grid.parseInputAttribute('initialrowvalue', inp.file['ma-file'].substr(rowCaret))
		if (!row) // now row initialization data found
			return;
		caret = row.indexOf(':') + 1;
		var rowID = parseInt(row.substr(caret), 10);
		caret = row.search(/\d\s/) + 1;
		caret += row.substr(caret).search(/\s\d/) + 1;
		var rowValues = row.substr(caret).split('');
		grid.initialRowValues.push({rowID:rowID, rowValues:rowValues.slice()});
		console.log('Row ' + rowID +': '+rowValues);
		// Prep for next initialrowvalue
		if (grid.initialRowValues.length == 1) //first line would trigger twice without this
			rowCaret = inp.file['ma-file'].indexOf('initialrowvalue', rowCaret);
		rowCaret = inp.file['ma-file'].indexOf('initialrowvalue', rowCaret+16);
	}
}

grid.initialStValues = [];
grid.initializeGridStvalues = function(){
	var f = inp.file['val-file'];	//shorthand
	var caret = 0;

	// Exit if no stvalues file loaded (can insert UI feedback here)
	if(!f) return;

	f+="\nc";

	// Otherwise clear any existing data and start filling new ones
	grid.initialStValues = [];

	// load palette data from file['pal-file']
	var lines = f.split(/\n/);
	// Type A: [rangeBegin;rangeEnd] R G B
	for (var i = 0; i<lines.length; i++){
		var line = lines[i]; //shorthand

	// for each line:
	//while(caret < f.length){
		//var line = f.substring(caret, f.indexOf('\n', caret));
		//caret += line.length+1;
		if(line.length < 4) continue;// probably empty line
		if((line.indexOf('(')==-1)||
		   (line.indexOf(')')==-1)||
		   (line.indexOf('=')==-1))
			continue;	// invalid line

		// Each line looks like this: (y,x,z)=value
		// value
		var v = parseFloat(line.substr(line.indexOf('=')+1));

		// 2D or 3D?
		line = line.substring(line.indexOf('(')+1, line.indexOf(')'));
		lineSplit = line.split(',');
		// Y coord
		var y = parseInt(lineSplit[0],10);
		// X coord
		var x = parseInt(lineSplit[1],10);
		// Z coord
		var z = parseInt(lineSplit.length==3?lineSplit[2]:0,10);

		// Send to temporary holder, before combined in initializeGridData
		grid.initialStValues.push({position:[x,y,z], value:v});
	}
}

grid.model.ports = [];
grid.initializeGridPorts = function(){
	// Reset
	grid.model.ports = []; // start with the default port 'out'
	// Read list of ports from model .ma file
	var portString = grid.parseInputAttribute('neighborports', inp.file['ma-file']);
	if (portString){
		// If ports detected, let's split them by whitespace (regex: \s)
		var tempPorts = portString.split(/\s/);
		// Get rid of empty strings
		for(var i=0;i<tempPorts.length;i++)
			if(tempPorts[i]) //("" is false)
				grid.model.ports.push(tempPorts[i].toLowerCase());
	}
	// end with the default port 'out'
	grid.model.ports.push('out');
	console.log('Ports: ' + grid.model.ports);
}

grid.model.components = [];
grid.initializeGridComponents = function(){
	// Reset
	grid.model.components = []; // start with the default port 'out'
	// Read list of ports from model .ma file
	var componentString = grid.parseInputAttribute('components', inp.file['ma-file']);
	if (componentString){
		// If ports detected, let's split them by whitespace (regex: \s)
		var tempPonent = componentString.split(/\s/);
		// Get rid of empty strings
		for(var i=0;i<tempPonent.length;i++)
			if(tempPonent[i]) //("" is false)
				grid.model.components.push(tempPonent[i].toLowerCase());
	}
	else // .ma file doesn't define components
		grid.model.components.push('')
	// end with the default port 'out'
	console.log('Components: ' + grid.model.components);
}


grid.initializeGridData = function(){
	// Reset frame count
	grid.model.frameCount = 0;

	// Create a single frame at time 0, with empty cells
	grid.model.data = 	[	// Entire data stream
							{	// Single frame at a certain timestamp
								timestamp: [0,0,0,0], // time = 00:00:00:000
								cells: []	// array of cell objects {position, values[#ports]}
							}
						];

	// Initialize first frame (time=0) which is data[0]
	var v = grid.model.initGlobalValue; // shorthand for tight loop
	var ports = grid.model.ports; //shorthand
	// create Initial ports array, and fill it with 0's
	var initialPorts = []; for (var i=ports.length;i-->0;) initialPorts.push(0);

	// CACHE prep
	var cacheEnabled = grid.view.CACHE_ENABLED;//shorthand for tight loop
	if(cacheEnabled){
		grid.view.dataCache=[[]]; 	// reset the cache for first frame (frame 0)
		grid.view.cacheCount = 0;
		for(var z=0; z<grid.model.dimZ;z++){
			grid.view.dataCache[0][z] = [];	// initialize empty layer cache
			for (var y=0; y<grid.model.dimY;y++)
				grid.view.dataCache[0][z][y] = [];	// initialize empty row cache
		}
	}
	var cache = grid.view.dataCache;

	// INITIALIZE ALL THE CELLS! (frame0)
	var found = false;
	for(var z = grid.model.dimZ; z-->0;){
		for(var y = grid.model.dimY; y-->0;){
			found = false;	// reset flag for every row
			var j;
			// check if this is a pre-intialized row
			for (var i=grid.initialRowValues.length;i-->0;){
				if(y == grid.initialRowValues[i].rowID && z==0){
					// Match found (applicable only to first)
					found = true;
					j = i;
					break;
				}
			}
			if(!found){	// initilalize row regularly, using global initial value v (first port only)
				for (var x = grid.model.dimX; x-->0;){
					var vPorts = initialPorts.slice(); // copy initial empty ports vector
					vPorts[0] = v;	// initialize first port only
					grid.model.data[0].cells.push({position:[x,y,z],value:vPorts.slice()});
					if(cacheEnabled) cache[0][z][y][x] = vPorts.slice();	// cache copy
				}
			}
			else{	// use initialized row
				for (var x = grid.model.dimX; x-->0;){
					var vPorts = initialPorts.slice(); // copy initial empty ports vector
					vPorts[0] = parseFloat(grid.initialRowValues[j].rowValues[x]);	// initialize first port only
					grid.model.data[0].cells.push({position:[x,y,z],value:vPorts.slice()});
					if(cacheEnabled) cache[0][z][y][x] = vPorts.slice(); // cache copy
				}
			}
		}
	}

	// Overwrite any with st values file (.val)
	var data = grid.model.data;	// shorthand
	var initValues = grid.initialStValues;
	for(var i=0; i<initValues.length; i++){
		var ps = initValues[i].position;
		var vPorts = initialPorts.slice(); // copy initial empty ports vector
		vPorts[0] = initValues[i].value;
		data[0].cells.push({position: initValues[i].position.slice(),
						    value: 	  vPorts.slice() });
		if(cacheEnabled) cache[0][ps[2]][ps[1]][ps[0]] = vPorts.slice(); // cache copy
	}

	// We just created a new frame (frame #0)
	grid.model.frameCount++;
}

grid.initializePalette = function(){
	// Exit if the palette isn't properly loaded (can insert UI feedback here)
	if(!inp.file['pal-file']){
		//
		window.alert("No Color Palette file was chosen. Using default palette instead: [-100;100] 160 160 180");
		// Announce we couldn't load a palette file; load default
		document.getElementById('pal-file').parentNode.children[3].innerHTML = '<b>No pal loaded!<br>Using default.</b>';
		inp.file['pal-file'] = "[-100;100] 160 160 180\n";
		lines = inp.file['pal-file'].split(/\n/);
	}

	// load palette data from file['pal-file']
	var lines = inp.file['pal-file'].split(/\n/);
	grid.palette = [];	// [i] = //pair [//range [start, end], // color [R,G,B]]


	// Parse the palette file
	if(lines[0].indexOf('[') != -1){
		// Type A: [rangeBegin;rangeEnd] R G B
		for (var i = 0; i<lines.length; i++){
			var L = lines[i]; //shorthand
			if(L.length < 7) continue; // skip it it's probably an empty line
			var begin = parseFloat(L.substr(1));
			var end   = parseFloat(L.substr(L.indexOf(';')+1));
			var rgbLine = L.substr(L.indexOf(']')+2).trim();
			var rgb = rgbLine.split(' ');
			for(var j=rgb.length;j-->0;) 				// clean empty elements
				if(rgb[j].trim()=="")
					rgb.splice(j, 1);
			var r = parseInt(.95*parseInt(rgb[0],10));	// Parse as decimal int
			var g = parseInt(.95*parseInt(rgb[1],10));	// Parse as decimal int
			var b = parseInt(.95*parseInt(rgb[2],10));	// Parse as decimal int
			grid.palette.push([[begin,end],[r,g,b],"-"]);	// Save to palette
		}
	}
	else{
		// Type B (VALIDSAVEFILE: lists R,G,B then lists ranges)
		var paletteRanges = [];
		var paletteColors =[];
		for(var i = lines.length; i-->0;){
			// check number of components per line
			var components = lines[i].split(',');
			if(components.length == 2) {	// this line is a value range [start, end]
				// Use parseFloat to ensure we're processing in decimal not oct
				paletteRanges.push([parseFloat(components[0]), parseFloat(components[1])]);
			}
			else if (components.length == 3){ //this line is a palette element [R,G,B]
				// Use parseInt(#, 10) to ensure we're processing in decimal not oct
				paletteColors.push([parseInt(.95*parseInt(components[0],10)),
									parseInt(.95*parseInt(components[1],10)),
									parseInt(.95*parseInt(components[2],10))]);
			}
		}
		console.log(paletteColors);
		// populate grid palette object
		for (var i=paletteRanges.length; i-->0;){
			grid.palette.push([paletteRanges[i], paletteColors[i] || [0,0,0],"-"]); // default to RGB=[0,0,0]
		}
	}
}

// Element-wise comparison between two 1D arrays.
util.isEqualArray1D = function(arrayA, arrayB){
	if (!arrayA || !arrayB || (arrayA.length != arrayB.length))
		return false;
	for(var i=arrayA.length;i-->0;){
		if (arrayA[i] != arrayB[i])
			return false;
	}
	return true;
}

grid.flushPacketsPipe = function(){
	grid.model.updatePacketsPipe = [];
}

grid.init = function(){
	/** Grid Initializations */
	// All about the first frame (t=0)
	grid.initializeGridDim();
	grid.initializeGridGlobalValue();
	grid.initializeGridRowValues();
	grid.initializeGridStvalues();
	grid.initializeGridComponents();
	grid.initializeGridPorts();
	grid.initializeGridData();
	grid.initializePalette();
}

// Model main
grid.modelMain = function(){
	if(!inp.file['ma-file']){
		alert("Please select or drag'n'drop a model first");
		return;
	}
	setTimeout(grid.viewMain(), 500);
}
