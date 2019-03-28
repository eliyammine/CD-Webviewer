/*******************************************************
 * Author: 	Omar Hesham, June 2015.
 * Advanced Real-Time Simulation Lab.
 * Carleton University, Ottawa, Canada.​​
 * License: [TODO] Something opensource
 *
 * Project: 	Online Cell-DEVS Visualizer
 * File: 		view.js
 * Description: The View component of the Grid object
 * 				handles the display of the Grid Model
 * 				(model.js) and the associated UI
 * 				commands
 */

// [TODO] Modulize the entire "grid" object for easy namespace and member privacy
//
grid = {};
util = {};
stats = {};
charts = {};
charts.states = null;
charts.transitions = null;
charts.cellsStatesDialog =  null;
charts.statesDialog =  null;
charts.transitionDialog = null;

/** Global grid object {model, view, data} \*/
//model
grid.model = {};
grid.model.name = 'CellDevsModel';	// Model Name (ID)
grid.model.dimX = 1;	// Rows
grid.model.dimY = 1;	// Columns
grid.model.dimZ = 1; 	// Depth
grid.model.frameCount = 0; // start with frame 0
grid.model.updatePacketsPipe = [];

//data for canvas
grid.view = {};
grid.view.viewBuffer = [];	// stores full frame copy of current view frame
grid.view.dataCache = []; // stores periodic snapshots of frames to allow random seeking
grid.view.CACHE_PERIOD = 10;	// Store a cache point once every 10 frames
grid.view.CACHE_ENABLED = true;
grid.view.SHOW_CACHE_ONLY = false;
grid.view.cacheCount = 0;
grid.view.currentTimeFrame = 1;

//canvas
grid.view.div = grab('grid');
grid.view.canvy = grab('canvy');
grid.view.canvyDiv = grab('canvyDiv');

grid.view.barHeight = 20; //pixels
grid.view.barWidth = 15;
grid.view.layoutColumns = 1; // columns of port layers
grid.view.layersNeedUpdate = true;
grid.view.gridOverlayWidth = 1;
grid.view.redrawRequested = true;

SCL = grab('cellScale').value;

//Zoom and tooltip
origin_x=0;
origin_y=0;
zoomStatus = false;
tipStatus = false;
showValuesStatus = false;
showZerosStatus = false;
showFixedPrecision =false;

grid.SelectedCells = [];
fbSel = []

function previousCacheTime(t){	// find most previous cache point to time t
	var	isLastFrame = (t==(grid.model.frameCount-1));
	return isLastFrame ? t : Math.floor(t/grid.view.CACHE_PERIOD)*grid.view.CACHE_PERIOD;}
function nearestCacheTime(t){	// find nearest cache point to time t (upper bounded)
	var	isLastFrame = (t==(grid.model.frameCount-1));
	return Math.min(grid.model.frameCount-1,
		isLastFrame ? t : Math.round(t/grid.view.CACHE_PERIOD)*grid.view.CACHE_PERIOD);
}

grid.loadSimulation = function(){
	if(!inp.logLoaded){
		alert("Please select a simulation log.")
		return;
	}
	grid.pausePlayback();
	grab('BtnParseY').style.background = 'rgba(35,112,77, 0.5)';
	grab('BtnParseY').disabled = true;
	grid.model.data=[];
	inp.parseYChunks();
	// Guess a good zoom scale to start with (at least 1px wider than grid lines)
	SCL = Math.max(Math.round(750/(grid.model.dimX*grab('layoutColumns').value)), 1+grid.view.gridOverlayWidth);
	grab('cellScale').value = SCL;
	// Setup timeline ticks to match cached frames (purely aesthetic feedback)
	//  -- harder than I thought. too much hastle at this point
	//palette edition init
	grab("BtnEditPalette").style.display = "inline-block";
	grab("BtnEditPalette").disabled = false;
	minInputZone();
	document.getElementById("play-controls").style.display = 'block';
	d3.selectAll("#paletteDiv").remove();
}

//For demo load
grab("BtnParseY2").addEventListener("click", function(){
  demo.loadLocal("\demo\TIS_test.pal");
});

function closeLineDialog(){
	var lineBox = grab('lineBox');
	//lineBox.innerHTML = '';
	var lineDialog = grab('lineGraphDialog');
	lineDialog.close();
}
function closeCellsStateDialog(){
	//ar lineBox = grab('lineBox');
	//lineBox.innerHTML = '';
	var cellsStateDialog = grab('cellsStateDialog');
	cellsStateDialog.close();
}
function closeStateFreqDialog(){
	//ar lineBox = grab('lineBox');
	//lineBox.innerHTML = '';
	var stateFreqDialog = grab('stateFreqDialog');
	stateFreqDialog.close();
}

function closeTransitionDialog(){
	//ar lineBox = grab('lineBox');
	//lineBox.innerHTML = '';
	var transitionDialog = grab('transitionDialog');
	transitionDialog.close();
}



grid.setupGrid = function(){
	//Show canvas
	grid.view.canvy.style.display='';
	grid.view.canvyDiv.style.display='';
	// Clear everything to init values
	grid.view.currentTimeFrame = 0;
	grid.pausePlayback() // stop any playing
	//grid.init() // reset grid data and reload input properties

	var gridDiv = grid.view.div;
	var gridData= grid.model;

	// Set max columns
	var cols = grab('layoutColumns');
	cols.max = grid.model.ports.length * gridData.dimZ;
	//cols.value = Math.min(cols.value, cols.max) // clip it if necessary

	// Disable extra 'out' port by default
	var skipOut = 0
	if(grid.model.ports.length>1&&grid.model.ports[grid.model.ports.length-1]=='out')
		skipOut = 1;

	// If only single port in single layer, disable port title bar
	grid.view.barHeight= (grid.model.ports.length == 1 && gridData.dimZ == 1) ? 0 : 20;
	var canvy = grid.view.canvy;

	grid.view.gfx = canvy.getContext('2d');
	var nGrid = gridData.dimZ*(grid.model.ports.length-skipOut);

	canvy.width = (gridData.dimX*SCL+grid.view.barWidth) * grid.view.layoutColumns - grid.view.barWidth;
	canvy.height= (gridData.dimY*SCL+grid.view.barHeight)* Math.ceil(nGrid/grid.view.layoutColumns);


	// Signal that layers need to be redrawn
	grid.view.layersNeedUpdate = true;

	// Renable timeline controls
	grid.toggleUI(true);
	if(showValuesStatus == true) {
		grab('showZeros').disabled = false;
		grab('showFixedPrecision').disabled = false;
	}
	if(grab('showGridOverlay').checked) grid.toggleUI(true, ['gridOverlayColor']);

	// Disable random access and backwards playback if cache is disabled
	if(!grid.view.CACHE_ENABLED) grid.toggleUI(false, ['timelineSeek','BtnPlayBw','BtnStepBw','BtnLastFrame']);

	// Populate "Detected Layers" list and clear it
	var layersList = grab('LayersList'); layersList.innerHTML='';

	for (var z=0; z<gridData.dimZ; z++){
		layersList.innerHTML +=
			"<label><input onclick='grid.toggleLayer(["+z+",-1])' type='checkbox' id='layer"+z+"' checked>Layer"+z+" (x,y,"+z+")</label><br>";

		for (var i=0; i<grid.model.ports.length;i++){
			layersList.innerHTML += "&emsp;&#10149;<label><input onclick='grid.toggleLayer(["+z+","+i+
					"])' type='checkbox' id='Layer"+z+"_Port"+grid.model.ports[i]+"' checked>Port:"+grid.model.ports[i]+"</label>" +
					"&emsp;<label><input onclick='grid.toggleCharts("+z+","+i+")' name='chartRadio' type='radio' id='Layer_"+z+"_Port_"+i+"_Chart'>Charts</label><br>";

			if(i==grid.model.ports.length-1)
				LayersList.innerHTML += "<hr>";	// insert divider after last port in this layer
		}
		// Check weird 'out' port
		if(skipOut)
			grab('Layer'+z+'_Port'+'out').checked = false;

	}
	//******************
	// Finally, initialize the single view frame buffer, ready for rendering (updateGridView).
	// This buffer will eliminate the need to rewind playback every time we change a paramter,
	// while still maintaining the memory efficiency of incremental-only playback.
	var fb 	 = grid.view.viewBuffer;	  // shorthand
	var data = grid.model.data[0].cells;  // shorthand
	for (var z=gridData.dimZ; z-->0;){
		fb[z] = [];
		for (var y=gridData.dimY; y-->0;){
			fb[z][y] = [];
			for (var x=gridData.dimX; x-->0;){
				fb[z][y][x] = [];
			}
		}
	}
}

grid.updateGridView = function(){
	var data 			= grid.model.data,		// shorthand
		ports 			= grid.model.ports,
		precision 		= grab('precision').value,
		fixedPrecision 	= showFixedPrecision,
		canvy 			= grid.view.canvy,
		barH 			= grid.view.barHeight,
		barW 			= grid.view.barWidth,
		cols 			= grid.view.layoutColumns,
		gfx 			= grid.view.gfx,
		vDisplay		= showValuesStatus,
		zeroDisplay 	= showZerosStatus,
		fb 				= grid.view.viewBuffer,
		dc 				= grid.view.dataCache

	if (!data.length) return;		// if there's no data, return

	gfx.font = (0.7*SCL)+'px Arial';
	gfx.textAlign = 'center';
	// Loop over every layer to render it
	var t = grid.view.currentTimeFrame;
	var p = grid.palette; // shorthand: p[i]=[//pair [//range [start, end], // color [R,G,B]]]
	var v, cell;
	var gridOverlayColor = grab('gridOverlayColor').value || 'rgb(120,120,130)';

	var layerWidth  = SCL*grid.model.dimX,	// not including port layer padding (barW)
		layerHeight = SCL*grid.model.dimY;	// not including port title (barH)

	// Clear entire grid if layers need update
	if(grid.view.layersNeedUpdate){
		// Transparent pixels break Whammy encoder
		// Use canvas div bg color instead
		gfx.fillStyle = window.getComputedStyle(canvyDiv).getPropertyValue('background-color');
		gfx.fillRect(origin_x,origin_y,canvy.width,canvy.height);
	}

	// Is this frame cached? (i.e. last or multiple of caching period)
	var	isLastFrame 	= (t==(grid.model.frameCount-1));
	var	frameIsCached 	= isLastFrame || !(t%grid.view.CACHE_PERIOD);
	grid.view.redrawRequested=grid.view.redrawRequested||frameIsCached; //request full frame render
	var cacheID 		= isLastFrame ? dc.length-1: Math.floor(t/grid.view.CACHE_PERIOD);
	var cacheEnabled 	= grid.view.CACHE_ENABLED;
	var showCacheOnly 	= grid.view.SHOW_CACHE_ONLY;

	// Fill the single-frame view buffer (fb[z][y][x]=cell[x][y][z].value)
	if(frameIsCached) // grab directly from cache if available
		grid.view.viewBuffer = JSON.parse(JSON.stringify(dc[cacheID]))
	else{
		for (var i=0; i<data[t].cells.length; i++){
			var ps  = data[t].cells[i].position.slice();
			var val = data[t].cells[i].value.slice();
			// Only update ports that are defined (!null) in this time frame
			// (otherwise keep previous frame values; exactly what we want)
			for(var portato=0; portato<ports.length;portato++)
				if( val[portato] != null)
					fb[ps[2]][ps[1]][ps[0]][portato]= val[portato];
		}
	}

	for (var layer=0, column=-1,row=-1; layer < grid.model.dimZ; layer++){	// for each layer (2D slice of a 3D grid)
		//row=-1; // start "newline" every layer? comment if not desirable
		for (var portID=0, port=-1 ; portID<ports.length; portID++){	// for each port
			var isShowPort = grab('Layer'+layer+'_Port'+ports[portID]);
			if(!isShowPort.checked || isShowPort.disabled)
				continue;	// if port is unchecked or disabled, skip to next port

			// Increment displayed ports counter
			port++;
			// Increment column id (modulo user-specified layoutColumns)
			column++; column %= cols;
			// New row only if returned to column 0
			if(column==0) row++;

			// Anchor (top-left corner of current port layer)
			var layerPosX = column*(layerWidth+barW),
				layerPosY = barH+row*(layerHeight+barH);

			// Redraw layer title bars
			if(grid.view.layersNeedUpdate){
				// Clear entire port layer
				//gfx.clearRect(layerPosX, layerPosY-barH,layerPosX+layerWidth+barW,layerPosY+layerHeight);
				// Clear current bar
				gfx.shadowBlur=0;
				gfx.fillStyle = 'rgb(40,40,40)';
				gfx.fillRect(layerPosX, layerPosY-barH,layerPosX+layerWidth,layerPosY);
				// Render port title bar
				gfx.font = 'normal '+barH*0.6+'px monospace';
				gfx.textAlign = 'left';
				gfx.fillStyle = 'rgb(190,190,190)';
				gfx.fillText('\u25BC Layer:'+layer+' [Port:'+ports[portID]+']',layerPosX,layerPosY-barH*0.25);
			}

			// **** If redraw requested, render entire buffer(not just incremental update in this frame)
			if(grid.view.redrawRequested){
				// remove the request, we're about to process the last port of its last layer
				if(layer==grid.model.dimZ-1 && portID==ports.length-1)
					grid.view.redrawRequested = false;
				for (var y=grid.model.dimY; y-->0;){
					for (var x=grid.model.dimX; x-->0;){
						if(cacheEnabled && (frameIsCached || showCacheOnly))
							v = dc[cacheID][layer][y][x][portID];	// use cache
						else
							v = fb[layer][y][x][portID];			// use framebuffer
						gfx.shadowColor = 'rgba(0,0,0,0)';
						gfx.shadowBlur = 0;

						// Find palette color p[i]=[[begin,end],[r,g,b]]
						gfx.fillStyle = '#9696A0'; // start with default
						for(var c=p.length;c-->0;){
							if(v>= p[c][0][0] && v<p[c][0][1]){
								gfx.fillStyle = 'rgb('+p[c][1][0]+','+p[c][1][1]+','+p[c][1][2]+')';
								break;
							}
						}

						// Draw the grid cell [TODO] Replace rect with image pixels
						var posX = layerPosX + SCL*x,
							posY = layerPosY + SCL*y;
						gfx.fillRect(posX,posY, SCL,SCL);

						// Render the values (text)
						gfx.fillStyle = 'white';
						gfx.shadowColor = 'black';
						gfx.shadowOffsetX = 0;
						gfx.shadowOffsetY = 1;
						gfx.shadowBlur = 3.5;
						gfx.textAlign = 'center';
						// Get value to certain decimal places
						var vP = v.toFixed(precision);
						if(!fixedPrecision)	// truncate trailing 0s
							vP = parseFloat(vP).toString();
						// Adjust font size to fit value into cell
						gfx.font = (SCL*2/(vP.toString().length+2))+'px monospace';
						if(vDisplay){
							if(v==0)
								gfx.fillText((zeroDisplay ? vP:''),(SCL/2)+posX,(SCL/1.3)+posY, SCL) ;
							else
								// because Math.trunc() not yet supported by chrome, we do this:
								//gfx.fillText((v<0 ? Math.ceil(v) : Math.floor(v)),(SCL/2)+posX,(SCL/1.3)+posY);
								gfx.fillText(vP,(SCL/2)+posX,(SCL/1.3)+posY, SCL);
						}
					}
				}
			}
			else if(!showCacheOnly) {	// *** render incremental only (skip if only showing cache)
				for(var i=0; i < data[t].cells.length; i++){
					cell = data[t].cells[i];						// shorthand
					if(cell.position[2]!=layer) continue;			// wrong layer
					if(cell.value[portID]==null) continue;  		// wrong port
					var x = cell.position[0], y = cell.position[1];
					v = fb[layer][y][x][portID];					// use framebuffer
					gfx.shadowColor = 'rgba(0,0,0,0)';
					gfx.shadowBlur = 0;

					// Find palette color p[i]=[[begin,end],[r,g,b]]
					gfx.fillStyle = '#9696A0'; // start with default
					for(var c=p.length;c-->0;){
						if(v>= p[c][0][0] && v<=p[c][0][1]){
							gfx.fillStyle = 'rgb('+p[c][1][0]+','+p[c][1][1]+','+p[c][1][2]+')';
							break;
						}
					}

					// Draw the grid cell
					var posX = layerPosX + SCL*x,
						posY = layerPosY + SCL*y;
					gfx.fillRect(posX,posY, SCL,SCL);

					// Render the values (text)
					gfx.fillStyle = 'white';
					gfx.shadowColor = 'black';
					gfx.shadowOffsetX = 0;
					gfx.shadowOffsetY = 1;
					gfx.shadowBlur = 3.5;
					gfx.textAlign = 'center';
					// Get value to certain decimal places
					var vP = v.toFixed(precision);
					if(!fixedPrecision)	// truncate trailing 0s
						vP = parseFloat(vP).toString();
					// Adjust font size to fit value into cell
					gfx.font = (SCL*2/(vP.toString().length+2))+'px monospace';
					if(vDisplay){
						if(v==0)
							gfx.fillText((zeroDisplay ? 0:''),(SCL/2)+posX,(SCL/1.3)+posY, SCL) ;
						else
							gfx.fillText(vP,(SCL/2)+posX,(SCL/1.3)+posY, SCL);
					}
				}
			}

			// Draw Grid Overlay
			if(grab('showGridOverlay').checked){
				gfx.shadowColor = 'rgba(0,0,0,0)';
				gfx.shadowBlur = 0;
				gfx.strokeStyle = gridOverlayColor;
				gfx.lineWidth = grid.view.gridOverlayWidth;
				// horizontal grid lines
				for(var y=grid.model.dimY+1; y-->0;){
					// See this for why 0.5: http://goo.gl/EpuqLl
					gfx.beginPath();
					gfx.moveTo(layerPosX,layerPosY+y*SCL+(y!=grid.model.dimY?0.5:-0.5));
					gfx.lineTo(layerPosX+layerWidth, layerPosY+y*SCL+(y!=grid.model.dimY?0.5:-0.5));
					gfx.closePath();
					gfx.stroke();
				}
				// vertical grid lines
				for(var x=grid.model.dimX+1; x-->0;){
					gfx.beginPath();
					gfx.moveTo(layerPosX+x*SCL+(x!=grid.model.dimX?0.5:-0.5), layerPosY);
					gfx.lineTo(layerPosX+x*SCL+(x!=grid.model.dimX?0.5:-0.5), layerPosY+layerHeight);
					gfx.closePath();
					gfx.stroke();
				}
			}
		}
	}
	// Layer layout and title bars have been updated
	grid.view.layersNeedUpdate = false;
	grid.updateTimelineView();
	grid.updateCharts(grid.view.currentTimeFrame, grid.view.viewBuffer,canvas.selected);
	drawOutline();
}

//Detected layers
grid.updateLayersView = function(){
	var ports = grid.model.ports;	// shorthand

	// Signal that layers layout & titles need to be redrawn
	grid.view.layersNeedUpdate = true;

	// Count total of visible layers
	var portsDisplayed = 0;
	for (var z=0; z<grid.model.dimZ; z++ ) // for each layer
		for (var i=ports.length;i-->0;)	// for each port
			portsDisplayed += (!grab('Layer'+z+'_Port'+ports[i]).checked ||
								grab('Layer'+z+'_Port'+ports[i]).disabled)  ? 0:1;

	// Reset canvas
	grid.view.canvy.width  = (grid.model.dimX*SCL+grid.view.barWidth) *
							 grid.view.layoutColumns - grid.view.barWidth;
	grid.view.canvy.height = (grid.model.dimY*SCL+grid.view.barHeight)*
							 Math.ceil(portsDisplayed/grid.view.layoutColumns);

	grid.view.redrawRequested = true;
	grid.updateGridView();
}

grid.toggleLayer = function(ID){
	var ports = grid.model.ports;	// shorthand

	var layer = grab('layer'+ID[0]),
		port  = grab('Layer'+ID[0]+'_Port'+ports[ID[1]]);

	if(ID[1] == -1){
		// Toggle entire layer with all its ports
		for (var i=ports.length;i-->0;)
			grab('Layer'+ID[0]+'_Port'+ports[i]).disabled = !layer.checked;
		// Redraw  layers on what just happened
		grid.updateLayersView();
	}else{
		// Redraw layers based on what just happened
		grid.updateLayersView();
	}
}

grid.updateLayoutColumns = function(){
	grid.view.layoutColumns = grab('layoutColumns').value;
	grid.view.layersNeedUpdate = true;
	grid.updateLayersView();
}


grid.toggleGridOverlay = function(){
	// Only the view settings changed, but the frame data
	// remains the same. Just request a redraw.
	grid.view.redrawRequested = true;
	grid.updateGridView();
	grab('gridOverlayColor').disabled = !grab('showGridOverlay').checked;
	drawOutline();
}

grid.updateGridOverlayColor = function(){
	// Redraw the frame using the new colors
	grid.updateGridView();
}

grid.updateTimelineView = function(){
	var seek = grab('timelineSeek');	// shorthand
	seek.max = grid.model.frameCount-1;
	seek.value = this.view.currentTimeFrame;
	if(seek.value == seek.max) {// force slider to refresh
		seek.stepDown(1); seek.stepUp(1);
	}else{
		seek.stepUp(1); seek.stepDown(1);
	}

	if(grid.model.data.length){
		var t = this.model.data[this.view.currentTimeFrame].timestamp; //shorthand
		grab('timelineStatus').innerHTML = 'Frame: ' + this.view.currentTimeFrame +
				'&emsp;&emsp; Time: ' + util.padInt2(t[0]) +':'+ util.padInt2(t[1]) + ':' +
				 					 	util.padInt2(t[2]) +':'+ util.padInt3(t[3]);
	}
	// [TODO] Timestamp arithmetic & display
	// (although this is just a viewer and should obey sim data source)
}

grid.updateFPS = function(){
	grid.view.FPS = 1000/grab('framerate').value;
	if(grid.view.playbackDirection){  // If playing, pause and reset it for new FPS
		var i = grid.view.playbackDirection;
		grid.pausePlayback();
		if(i<2)	grid.playFrames();
		else grid.playFramesBackwards();
	}
}

//Canvas values toggle
grid.toggleValueDisplay = function(){
	var showValues = grab('showValuesButton');

	if(showValues.style.backgroundColor=='red') {
		showValues.style.backgroundColor='green';
		showValuesStatus = true;
		grab('showZeros').disabled = !showValuesStatus;
		grab('showFixedPrecision').disabled = !showValuesStatus;
	}
	else {
		showValues.style.backgroundColor='red';
		showValuesStatus = false;
		grab('showZeros').disabled = !showValuesStatus;
		grab('showFixedPrecision').disabled = !showValuesStatus;
	}
	grid.view.redrawRequested = true;
	grid.updateGridView();
}

grid.toggleZeroDisplay = function(){
	var showZeros = grab('showZeros');

	if(showZeros.style.backgroundColor=='red') {
		showZeros.style.backgroundColor='green';
		showZerosStatus = true;
	}
	else {
		showZeros.style.backgroundColor='red';
		showZerosStatus = false;
	}

	grid.view.redrawRequested = true;
	grid.updateGridView();
}

grid.toggleFixedPrecision = function(){
	// Only the view settings changed, but the frame data
	// remains the same. Just request a redraw.

	var fixedPrecision = grab('showFixedPrecision');

	if (fixedPrecision.style.backgroundColor=='red') {
		fixedPrecision.style.backgroundColor='green';
		showFixedPrecision = true;
	}
	else {
		fixedPrecision.style.backgroundColor='red';
		showFixedPrecision = false;
	}

	grid.view.redrawRequested = true;
	grid.updateGridView();
}

grid.updatePrecision = function(){
	// Only the view settings changed, but the frame data
	// remains the same. Just request a redraw.
	grid.view.redrawRequested = true;
	grid.updateGridView();
}

grid.reCSSGrid = function(that){
	if(inp.logParsed){
		if(SCL>that.value)
			window.scrollTo(
				window.pageXOffset-(grid.model.dimX*grid.view.layoutColumns),
				window.pageYOffset
			);
		SCL = that.value;
		grid.view.layersNeedUpdate = true;
		grid.updateLayersView();
	}
}

util.randInt = function(max){return Math.round(max*Math.random())+1; /* +1 to avoid 0*/}

util.padInt2 = function(num){	// from 'Robin' on StackOverflow
	if(num <= 99)
		num = ("0"+num).slice(-2);
	return num;
}

util.padInt3 = function(num){	// from 'Robin' on StackOverflow
	if(num <= 999)
		num = ("00"+num).slice(-3);
	return num;
}

grid.initialView = function(){
	// Initialization after page and scritps load, but before any user interaction
	grid.toggleUI(false);

	// Record useragent string (for browser-specific customizations)
	document.documentElement.setAttribute('data-UA', navigator.userAgent);
}

//Toggle for any html element
grid.toggleUI = function(isEnabled, list){
	if (list == null) {
			var list = ['precision','BtnRecord','BtnPlay', 'timelineSeek',
						  'loop', 'BtnRewind','BtnPlayBw','BtnStepBw',
						  'BtnStepFw','BtnLastFrame','showGridOverlay', 'layoutColumns'];
	}
	else {
		var list = list;
	}

	for(var i=list.length;i-->0;)
		grab(list[i]).disabled = !isEnabled;
}
grid.initialView();

// View main
grid.viewMain = function(){
	grid.statesList();
	grid.setupGrid();
	grid.setupCharts();
	grid.updateGridView();
}

// Bruno's Stuff
grid.getColor = function(value) {
	for (var i = 0; i < grid.palette.length; i++) {
		var mmax = grid.palette[i][0];

		if (value < mmax[0] || value >= mmax[1]) continue;

		return d3.color("rgb(" + grid.palette[i][1].join(",") + ")");
	}

	return d3.color("rgb(255,255,255)");
}

grid.setupCharts = function() {
	var radio = grab('Layer_0_Port_0_Chart');

	if (radio) radio.checked = true;

	grid.toggleCharts(0, 0);
}

grid.toggleCharts = function(z, port) {
	Viz.Utils.empty("chartsDiv");

	var track = JSON.parse("[" + grab('chart_states').value.replace(/\s/g, '').split(",") + "]");

	Viz.data.Initialize(z, port, track);
	if(grab('showStateFreq').checked) charts.states = Viz.charting.BuildStatesChart(grab('chartsDiv'), "state", [70, 40, 20, 50]);
	if(grab('showTransitions').checked) charts.transitions = Viz.charting.BuildTransitionsChart(grab('chartsDiv'), "activity", [50, 50, 50, 50]);
	if(grab('showStats').checked) stats = Viz.stats.Build(grab('chartsDiv'), Viz.data);

	charts.cellsState = Viz.charting.BuildCellsStateChart(grab('chartsDiv'), "cellsState", [50, 50, 50, 50]);

	//Configuring charts for dialog box
	var lineDialog = grab('cellsStateDialog');
	lineDialog.showModal();
	charts.cellsStatesDialog = Viz.charting.BuildCellsStateChart(grab('graphBox'), "dialogCellsState", [50, 50, 50, 50]);
	lineDialog.close()

	//Configuring charts for state frequency dialog box
	var stateFreqDialog = grab('stateFreqDialog');
	stateFreqDialog.showModal();
	charts.statesDialog = Viz.charting.BuildStatesChart(grab('stateFreqBox'), "dialogStateFreq", [70, 40, 20, 50]);
	stateFreqDialog.close()

	//Configuring charts for the Transitions dialog box
	var transitionDialog = grab('transitionDialog');
	transitionDialog.showModal();
	charts.transitionDialog = Viz.charting.BuildTransitionsChart(grab('transitionBox'), "dialogTransition", [50, 50, 50, 50]);
	transitionDialog.close()

	grid.updateGridView();
}

grid.updateCharts = function(t, fb,selected) {
	Viz.data.UpdateTime(t, fb, selected);

	if(grab('showStateFreq').checked) charts.states.Update(Viz.data.StatesAsArray());
	charts.statesDialog.Update(Viz.data.StatesAsArray());

	if(grab('showTransitions').checked) charts.transitions.Update(Viz.data.TransitionAsArray());
    charts.transitionDialog.Update(Viz.data.TransitionAsArray());

	charts.cellsState.Update(Viz.data.CellsStateAsArray(selected));
	charts.cellsStatesDialog.Update(Viz.data.CellsStateAsArray(canvas.selected));

	if(grab('showStats').checked) stats.Update(Viz.data.t, Viz.data.states);
}
function getMousePos(canvas, event) {
	var rect = canvas.getBoundingClientRect();
	return {
		x: Math.round(event.clientX - rect.left),
		y: Math.round(event.clientY - rect.top)
	};
}

var canvas = grid.view.canvy;
canvas.selected = [];


canvas.addEventListener('mousemove', function(event) {
	var fb = grid.view.viewBuffer;
	if (tipStatus) {
		var ToolTip = grab('tip');
		ToolTip.innerHTML='';
		ToolTip.style.visibility = "visible";

	    var mousePos = getMousePos(canvas, event);
		var value = getCellValue(mousePos);
		var cellX = value.cellX,
			cellY = value.cellY,
			layer = value.layer,
			portID = value.portID
    //Legend name changes
    var state = fb[layer][cellY][cellX][portID];
    var stateName = grid.getLegend(state);
		var message = 'Pos(X, Y, Z): (' + cellX +',' + cellY +','+layer+')<br>';
		message += 'State: ' + state +'<br>';
    message += stateName === "-" ? "" : "Name: " + stateName + "<br>";
		message += 'Transitions:' + Viz.data.transitions[cellX][cellY];
		ToolTip.innerHTML += message;
		ToolTip.style.left=(event.pageX)-85 + 'px';
		ToolTip.style.top=(event.pageY)+23 + 'px';
	}
}, false);



function minInputZone(){
	grab('inputzone').style.display = 'none';
	grab('min-button-window-input').innerHTML += '<button onclick="maxInputZone()">Input Files</button>'
}



function maxInputZone(){
	grab('inputzone').style.display = 'block';
	grab('min-button-window-input').innerHTML = '';
}

function minStatsZone(){
	grab('chartsDiv').style.display = 'none';
	grab('min-button-window-stats').innerHTML += '<button onclick="maxStatsZone()">Loaded Statistics</button>';
}


function maxStatsZone(){
	grab('chartsDiv').style.display = 'inline-table';
	grab('min-button-window-stats').innerHTML = '';
}

function minCanvasZone(){
	grab('canvyDiv').style.display = 'none';
	grab('min-button-window-canvas').innerHTML += '<button onclick="maxCanvasZone()">Loaded Canvas</button>'
}

function maxCanvasZone(){
	grab('canvyDiv').style.display = 'inline-table';
	grab('min-button-window-canvas').innerHTML = '';
}

function minimizeStateFreqChart(){
	grab('statechart-div').style.display = 'none';
	grab('btn-max-stateFreqState').style.display = 'none';
	grab('btn-statefreq').style.display = 'none';
	grab('min-button-window-statesChart').innerHTML += '<button onclick="maxStateFreqChart()">State Frequency Chart</button>'

	if(grab('activitychart-div').style.display == "none"  && grab('cellschart-div').style.display == "none" )
		grab('chartsDiv').style.display = 'none';
}
function minimizeCellStateChart(){
	grab('cellschart-div').style.display = 'none';
	grab('btn-max-cellsState').style.display = 'none';
	grab('btn-min-cellsState').style.display = 'none';
	grab('min-button-window-cellsChart').innerHTML += '<button onclick="maxCellStateChart()">Cells State Chart</button>'

	if(grab('activitychart-div').style.display == "none"  && grab('statechart-div').style.display == "none" )
		grab('chartsDiv').style.display = 'none';
}
function minimizeTransitionChart(){
	grab('activitychart-div').style.display = 'none';
	grab('btn-activity').style.display = 'none';
	grab('btn-max-transition').style.display = 'none';
	grab('min-button-window-transitionChart').innerHTML += '<button onclick="maxTransitionChart()">Transition Chart</button>';

	if(grab('cellschart-div').style.display == "none"  && grab('statechart-div').style.display == "none" )
		grab('chartsDiv').style.display = 'none';
}

function maxStateFreqChart(){
	grab('chartsDiv').style.display = 'inline-table';
	grab('statechart-div').style.display = 'block';
	grab('btn-max-stateFreqState').style.display = 'inline';
	grab('btn-statefreq').style.display = 'inline';
	grab('min-button-window-statesChart').innerHTML = '';
}

function maxCellStateChart(){
	grab('chartsDiv').style.display = 'inline-table';
	grab('cellschart-div').style.display = 'block';
	grab('btn-max-cellsState').style.display = 'inline';
	grab('btn-min-cellsState').style.display = 'inline';
	grab('min-button-window-cellsChart').innerHTML = '';
}
function maxTransitionChart(){
	grab('chartsDiv').style.display = 'inline-table';
	grab('activitychart-div').style.display = 'block';
	grab('btn-max-transition').style.display = 'inline';
	grab('btn-activity').style.display = 'inline';
	grab('min-button-window-transitionChart').innerHTML = '';
}

function getCellValue (mousePos) {
		var portID = 0;
		var layer =0;

		var height = Math.round((canvy.height)/(grid.model.dimY*grid.model.dimZ));
		var width = Math.round((canvy.width)/(grid.model.dimX));

		var cellX=Math.round((mousePos.x-20)/width);
		var cellY=Math.round((mousePos.y-18)/height);


		if ((cellY> grid.model.dimY-1) && (grid.model.ports.length > 0)) {
			cellY=Math.round((mousePos.y+15)/height);
			cellY=cellY - grid.model.dimY -1;
			layer +=1;
		}

		if (cellY > grid.model.dimY-1) cellY=grid.model.dimY-1;
		if (cellX > grid.model.dimX-1) cellX=grid.model.dimX-1;
		if (cellX == -1) cellX =0;
		if (cellY == -1) cellY =0;

		return {
			cellX: cellX,
			cellY: cellY,
			layer: layer,
			portID: portID
		};
}

canvas.addEventListener('mouseout', function(event) {
	var ToolTip = grab('tip');
	ToolTip.style.visibility = "hidden";
}, false);

function toggleTip() {
	var tipButton = grab("tipButton");
	if (tipButton.style.backgroundColor=='red') {
		tipButton.style.backgroundColor='green';
		tipStatus=true;
	}
	else {
		tipButton.style.backgroundColor='red';
		tipStatus=false;
	}
};


canvas.addEventListener('mousemove', showZoom, false);
canvas.addEventListener('mouseover', showZoom, false);
function showZoom(event) {
	if (zoomStatus) {
		var zoom=grab("zoom");
		var zoomCtx=zoom.getContext("2d");
		var mousePos = getMousePos(canvas, event);

		zoomCtx.fillStyle = "white";
		zoomCtx.fillRect(0,0, zoom.width, zoom.height);
		zoomCtx.drawImage(canvas, mousePos.x-40, mousePos.y-40, 400, 400,0,0, zoom.width*2, zoom.height*2);
		zoom.style.top = event.pageY + 10 + "px"
		zoom.style.left = event.pageX + 40 + "px"
		zoom.style.display = "block";
	}
}

canvas.addEventListener('click', function(event){
		var mousePos = getMousePos(canvas, event);

		var portID = 0;
		var layer =0;
		var fb = grid.view.viewBuffer;

		var height = canvy.height / grid.model.dimY;
		var width = canvy.width / grid.model.dimX;

		var cellX = Math.round((mousePos.x-20)/width);
		var cellY = Math.round((mousePos.y-18)/height);
		var cellZ = portID;

		this.selected.push({x:cellX, y:cellY, z:cellZ});
		selectCell(event);
		return;

		if ((cellY> grid.model.dimY-1) && (grid.model.ports.length > 0)) {
			cellY=Math.round((mousePos.y+15)/height);
			cellY=cellY - grid.model.dimY -1;
			layer++;
		}

		if (cellY > grid.model.dimY-1) cellY=grid.model.dimY-1;
		if (cellX > grid.model.dimX-1) cellX=grid.model.dimX-1;
		if (cellX == -1) cellX =0;
		if (cellY == -1) cellY =0;

		var boxX = grab('posX');
		var boxY = grab('posY');
		var statesBox = grab('states-box');
		var transitions = grab('transitions');
		var lineBox = grab('lineBox');

		lineBox.innerHTML += '<svg id="line-graph"></svg>';

		boxX.innerHTML = 'position X: ' + cellX;
		boxY.innerHTML = 'position Y: ' + cellY;
		statesBox.innerHTML = 'states: ' + fb[layer][cellY][cellX][portID];
		transitions.innerHTML = 'transitions: ' + Viz.data.transitions[cellX][cellY];


		var timeline = Array.apply(null, {length: 9}).map(Number.call, Number);
		var data = [];
	    for (var i in timeline) {
    	  var randomnumber = Math.floor(Math.random() * (4 - 0 + 1));
	      data.push(
	         {
	            time: i, // timeframe
	            value: randomnumber // states
	         });
   		}

		var svgWidth = 600, svgHeight = 400;
	    var margin = { top: 20, right: 20, bottom: 30, left: 50 };
	    var width = svgWidth - margin.left - margin.right;
	    var height = svgHeight - margin.top - margin.bottom;



   		var svg = d3.select('#line-graph').attr("width", svgWidth).attr("height", svgHeight);
   		var g = svg.append("g")
				   .attr("transform",
				      "translate(" + margin.left + "," + margin.top + ")"
				   );

		var x = d3.scaleLinear().rangeRound([0, width]);
		var y = d3.scaleLinear().rangeRound([height, 0]);
		var line = d3.line()
					   .x(function(d) { return x(d.time)})
					   .y(function(d) { return y(d.value)})
	    x.domain(d3.extent(data, function(d) { return d.time }));
	    y.domain(d3.extent(data, function(d) { return d.value }));

		g.append("g")
		   .attr("transform", "translate(0," + height + ")")
		   .call(d3.axisBottom(x))
		   .select(".domain")
		   .remove();


		g.append("g")
		   .call(d3.axisLeft(y))
		   .append("text")
		   .attr("fill", "#000")
		   .attr("transform", "rotate(-90)")
		   .attr("y", 6)
		   .attr("dy", "0.71em")
		   .attr("text-anchor", "end")
		   .text("States (#)");

		g.append("path")
			.datum(data)
			.attr("fill", "none")
			.attr("stroke", "steelblue")
			.attr("stroke-linejoin", "round")
			.attr("stroke-linecap", "round")
			.attr("stroke-width", 1.5)
			.attr("d", line);

		g.append("text")
            .attr("text-anchor", "middle")  // this makes it easy to centre the text as the transform is applied to the anchor
            .attr("transform", "translate("+ (width/2) +","+(height-(50/3))+")")  // centre below axis
            .text("Timeline (10 frames per unit)");
		var lineDialog = grab('lineGraphDialog');
		lineDialog.showModal();


}, false);

function selectCell(event) {
	var mousePos = getMousePos(canvas,event);
	var value = getCellValue(mousePos);
	var cellX = value.cellX,
		cellY = value.cellY,
		layer = value.layer
	var ctx = canvas.getContext("2d");
	ctx.strokeStyle = grab('gridOverlayColor').value || 'rgb(120,120,130)';
	ctx.lineWidth = 5;
	if (grid.SelectedCells.length == 0) {
		grid.SelectedCells.push(new cell(cellX, cellY, layer));
		ctx.strokeRect((ctx.lineWidth/2)+SCL*cellX, (ctx.lineWidth/2)+cellY*SCL, SCL-ctx.lineWidth, SCL-ctx.lineWidth);
	}
	else {
		var found = false;
		for (var i=grid.SelectedCells.length-1; i>=0; i--) {
			if ((grid.SelectedCells[i].x == cellX) && (grid.SelectedCells[i].y == cellY) && (grid.SelectedCells[i].z == layer)) {
				found = true;
				grid.SelectedCells.splice(i,1);
				grid.updateGridView();
			}
		}
		if (!found) {
			grid.SelectedCells.push(new cell(cellX, cellY, layer));
			ctx.strokeRect((ctx.lineWidth/2)+SCL*cellX, (ctx.lineWidth/2)+cellY*SCL, SCL-ctx.lineWidth, SCL-ctx.lineWidth);
		}
	}
	grab('StatsOverlay').style.display = "none";
}

function cell(x,y,z) {
	this.x = x;
	this.y = y;
	this.z = z;
}

function drawOutline() {
	ctx = canvas.getContext("2d");
	ctx.lineWidth = 5;
	for (var i=grid.SelectedCells.length-1; i>=0; i--) {
		ctx.strokeStyle = grab('gridOverlayColor').value || 'rgb(120,120,130)';
		ctx.strokeRect((ctx.lineWidth/2)+SCL*grid.SelectedCells[i].x, (ctx.lineWidth/2)+grid.SelectedCells[i].y*SCL, SCL-ctx.lineWidth, SCL-ctx.lineWidth);
	}
}

function clearSelectedCells() {
	grid.SelectedCells = [];
	if (grid.view.playbackDirection != 1) {
		grid.playFrames();
	}
	grab('StatsOverlay').style.display = "none";
	grid.updateGridView();
}



grid.view.canvyDiv.addEventListener("mouseout", function(){
    zoom.style.display = "none";
});
function toggleZoom() {
	var zoomButton = grab("zoomButton");
	if (zoomButton.style.backgroundColor=='red') {
		zoomButton.style.backgroundColor='green';
		zoomStatus=true;
	}
	else {
		zoomButton.style.backgroundColor='red';
		zoomStatus=false;
	}
};

function grab(id)	{return document.getElementById(id);}

grid.showPalette = function() {
		d3.select("#BtnEditPalette").attr("disabled","true").
		style("display","none");
		var box = d3.select("#paletteDiv")._groups[0][0] === null ?
		 d3.select("#chartControls").append("div")
		.attr("id","paletteDiv")
		.style("height","150px").style("width","250px")
		.style("background-color","#2E2E31").
    style("overflow-y","scroll") :
		d3.select("#paletteDiv");
		var table = box.append("table");
		for (var i=0; i<grid.palette.length;i++){
				var row = table.append("tr");
				row.append("td").style("padding-left","10px")
				.append("label").attr("for","colorWell_"+i)
				.text("("+grid.palette[i][0][0]+"; "+grid.palette[i][0][1]+")");
				var color = "#";
				for (var col of grid.palette[i][1]){
						let c = col>0 ? col.toString(16) : "00";
						color += c;
				}
				row.append("td").style("padding-left","10px")
				.append("input").attr("type","color")
				.attr("value", color)
				.attr("id","colorWell_"+i);
        row.append("td").style("padding-left","10px")
        .append("input").attr("type","text")
        .style("width","80px")
        .attr("maxlength","20")
        .attr("value",grid.palette[i][2])
        .attr("id","stateName_"+i);
      }
		table.selectAll("input[type=color]").on("change",grid.changePalette);
    table.selectAll("input[type=text]").on("change",grid.changeLegend);
}

grid.changePalette = function(event) {
		let id = d3.event.target.id.split("_")[1];
		let val = d3.event.target.value;
		for (var i = 0; i< grid.palette[id][1].length;i++){
				grid.palette[id][1][i] = parseInt (val.substring(1+i*2,3+2*i),16);
				console.log("RGB "+i+": "+grid.palette[id][1][i]);
		}
}

grid.changeLegend = function(event) {
  let id = d3.event.target.id.split("_")[1];
  d3.event.target.value += d3.event.target.value === ""? "-": "";
  let val = d3.event.target.value;
  grid.palette[id][2] = val;
}

grid.getLegend = function(value) {
  for (var i = 0; i < grid.palette.length; i++) {
    var mmax = grid.palette[i][0];
    if (value < mmax[0] || value >= mmax[1]) continue;
    return grid.palette[i][2];
  }
  return "-";
}

grid.statesList = function() {
	states=grab('chart_states');
	track = "";
	for (var i=0; i<grid.palette.length;i++){
			if  (track.indexOf(grid.palette[i][0][0]) ==-1) track+= grid.palette[i][0][0] +',';
			if  (track.indexOf(grid.palette[i][0][1]) ==-1) track+= grid.palette[i][0][1] + ',';
	}
	track=track.substring(0,track.length-1);
	states.value = track;
}

document.getElementById('basic-view-button').addEventListener('click', function(){
    if (this.checked) {
        document.getElementById('advanced-view').style.display ='block';
    }
	else {
        document.getElementById('advanced-view').style.display ='none';
       }
    });

function showStats(){
    var lineDialog = grab('lineGraphDialog');
	lineDialog.showModal();
	var canvas = grid.view.canvy;
	var pos = canvas.getBoundingClientRect();
    var div = d3.select("#lineGraphDialog");
	//div.attr('width',600);
	div.attr('left',pos.left + 200);
	div.attr('top',pos.top - 200);



   var stat = document.getElementsByClassName('changeStats');
	if(stat[0].style.display == '' || stat[0].style.display == 'none'){
        stat[0].style.display = 'inline-block';
   }
   else {
        stat[0].style.display = 'none';

   }
}


function maximizeCellsState(){
    var lineDialog = grab('cellsStateDialog');
	lineDialog.showModal();
	var canvas = grid.view.canvy;
	var pos = canvas.getBoundingClientRect();
    var div = d3.select("#cellsStateDialog");
	//div.attr('width',600);
	div.attr('left',pos.left + 200);
	div.attr('top',pos.top - 200);

	//charts.cellsStatesDialog = Viz.charting.BuildCellsStateChart(grab('graphBox'), "cellsState", [50, 50, 50, 50]);
	//charts.cellsStatesDialog.Update(Viz.data.CellsStateAsArray(canvas.selected));
}

function maximizeStateFreqDialog(){
    var stateFreqDialog = grab('stateFreqDialog');
	stateFreqDialog.showModal();
	var canvas = grid.view.canvy;
	var pos = canvas.getBoundingClientRect();
    var div = d3.select("#stateFreqDialog");
	//div.attr('width',600);
	div.attr('left',pos.left + 200);
	div.attr('top',pos.top - 200);

}


function maximizeTransitionDialog(){
    var transitionDialog = grab('transitionDialog');
	transitionDialog.showModal();
	var canvas = grid.view.canvy;
	var pos = canvas.getBoundingClientRect();
    var div = d3.select("#transitionDialog");
	//div.attr('width',600);
	div.attr('left',pos.left + 200);
	div.attr('top',pos.top - 200);

}
