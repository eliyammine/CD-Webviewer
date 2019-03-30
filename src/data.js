/*******************************************************
 * Author: 	Omar Hesham, June 2015.
 * Advanced Real-Time Simulation Lab.
 * Carleton University, Ottawa, Canada.​​
 * License: [TODO] Something opensource
 *
 * Project: 	Online Cell-DEVS Visualizer
 * File: 		data.js
 * Description: Data input objects used by the View
 * 				(view.js) and Model (model.js) components
 * 				of the main Grid object
 */

inp = {};
inp.logLoaded = false;
inp.logParsed = false;
inp.file = [];
inp.logFile = {};
inp.usefulIndex = {first:-1,last:-1};
inp.chunkSize =      2097152; // 2^21 = 2MB approx.
inp.MAXFILESIZE = 5500000000; // for testing only: 5.5GB

// Process drag'n'dropped files
inp.processDroppedFiles = function(f){
	for (var i=0; i < f.files.length; i++){
		var file = f.files[i]; // process the first (and only?) file
		var m = file.name.match(/.(val$|ma$|pal$|log$)/);

		if (!m) continue;

		var box = document.getElementById(m[1] + "-file").parentNode.children[3];	// statBox div

		if(m[1] == 'log'){
			inp.logFile = file;
			inp.logLoaded = true;

			box.innerHTML = file.name+'<font color=#f7c933><br><b>Ready to parse</b></font>';
		}
		else processFile(box, m[1], file);
		// [TODO] Use internally defined model name, not file name.
		// Store file name (sans extension) as model name.
		if(m[1] == 'ma') grid.model.name = file.name.slice(0, file.name.lastIndexOf('.'));
	}
}

function processFile(box, ext, file) {
	var fId = ext + "-file";

	box.innerHTML = file.name + '<font color=#f7c933><br><b>Processing...</b></font>';	// indicate file started processing

	var fReader = new FileReader();

	fReader.readAsText(file);

	fReader.onloadend = function(){
		inp.file[fId] = fReader.result;

		box.innerHTML = file.name + '<font color=green><br><b>Loaded!!</b></font>'; 	// indicate file loaded
	}
}

/**
 * Note:
 * Chunkify() is for an offline viewer that deals with complete
 * and known files sizes (i.e. not still simulating ala RISE).
 * There are implications here, in the model.js, and in the UI html.
 */
inp.readChunk = function(c,f,fr,s,e){
	c = f.slice(s, e);
	fr.readAsText(c);
}
inp.readChunkObj = function(obj){
	// Same as readChunk() but with a single argument; simpler to call
	obj.chunk = obj.file.slice(obj.start, obj.end);
	obj.fileReader.readAsText(obj.chunk);
}

inp.parseYChunks = function(){
	if(!inp.logLoaded) return; // if log not yet loaded, exit

	grid.init() // reset grid data and reload input properties

	grid.model.frameBuffer = []; // set a new frameBuffer
	grid.model.lastT = [0,0,0,0];// set initial 'last recorded time'

	//------------------------
	// C. Loop over chunks
	// -----------------------
	// Define variables and constants
	var CHUNK_SIZE = inp.chunkSize;
	var statBox = document.getElementById('log-file').parentNode.children[3]; // statBox div
	var C = {					// Container for a single reader object
		file: inp.logFile,		// File handle (e.g. file.size, file.slice(), etc.)
		fileReader:'',			// FileReader handle (e.g. fileReader.readAsTest(), etc.)
		chunk:'',				// Chunk handle (e.g. chunk.type, chunk.slice(), etc.)
		chunkContent: '',		// Chunk content holder (string)
		chunkCount: 0,			// Count of *useful* chunks (containing y-messages)
		chunkSize:CHUNK_SIZE,	// Setup chunk size (in bytes)
		fileCaret: 0,			// Current file index being processed
		firstYMsgIndex: -1,		// File index of beginning of first y-message
	 	start: 0,				// First byte index of current chunk (init = 0)
	 	end: 0					// Last byte index of current chunk (init = CHUNK_SIZE)
	}

	// Prepare chunk parameters
	C.fileReader = new FileReader();
	C.start = 0;
	C.end = C.start+C.chunkSize;
	// Read the chunk
	inp.readChunkObj(C);
	// Callback after chunk is read (or loaded)
	C.fileReader.onloadend = function(){
		// We have a chunk for sure (we just loaded one)
		C.chunkCount++;
		// Indicate some progress

		// Process the chunk we just read
		C.chunkContent = C.fileReader.result;
		// Only process full lines. Use safeEnd as starting point for next chunk
		var safeEndIndex = C.chunkContent.lastIndexOf('\n');
		// progress %
		var progress = (100*C.end/Math.min(C.file.size, inp.MAXFILESIZE));
		// Loading progress feedback to user
		grab('BtnParseY').style.background = 'linear-gradient(to right, rgb(80,80,75) 0%,rgb(80,80,75)'+
											  progress+'%,rgba(35,112,77, 0.5) '+
											  progress+1+'%, rgba(35,112,77, 0.5)';
		// Check end of file
		if(C.end > C.file.size || C.end > inp.MAXFILESIZE){	// TEST ONLY: limit to 6GB
			grid.parseYMessages(C.chunkContent, safeEndIndex,true);		// signal lastChunk=true
			statBox.innerHTML = C.file.name+'<font color = green><br><b>All parsed!</b></font>';
			inp.logParsed = true;
			grab('BtnParseY').style.background = '';
			grab('BtnParseY').disabled = false;
			grid.modelMain();
			console.log('Finished parsing chunks (100%)');
			//console.log(grid.model.data);
			return;
		}
		else
			grid.parseYMessages(C.chunkContent, safeEndIndex,false); // not lastChunk yet
		// Otherwise, prep for next chunk:
		// 		increment because safeEnd is local to chunk
		// 		if no '\n' detected, then skip to next chunk directly
		C.start += safeEndIndex!=0?safeEndIndex:C.chunkSize;
		C.end = C.start + C.chunkSize;

		// Read next chunk
		inp.readChunkObj(C);
	}
}

// [TODO] Load the RISE settings .xml file
//grid.loadRISExml = function(){}

function switchtoStandard() {
	var standard = grab('Standard');
	var RISE = grab('RISE');

	standard.style.display='block';
	RISE.style.display='none';
}

function switchtoRISE() {
	var standard = grab('Standard');
	var RISE = grab('RISE');

	standard.style.display='none';
	RISE.style.display='block';
}

var model_name;
grid.loadRISExml = function(f) {
	var file = f.files[0];
	var filename = file.name;
	model_name = file.name.split('.').slice(0, -1).join('.');
	url = "http://vs1.sce.carleton.ca:8080/cdpp/sim/workspaces/test/dcdpp/" + model_name;

	var fr = new FileReader();
	fr.readAsText(file,"UTF-8");

	var x = new XMLHttpRequest();
	x.open("PUT",url, true);
	x.setRequestHeader("Authorization", "Basic " + btoa("test:test"));
	x.setRequestHeader('Content-type','text/xml');

	x.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 202) {
			var box_xml = document.getElementById("xml-file").parentNode.children[2];
			box_xml.innerHTML = file.name + '<font color=green><br><b>Loaded!!</b></font>';
		}
		else {
			var box_xml = document.getElementById("xml-file").parentNode.children[2];
			box_xml.innerHTML = "'<font color=red>Failed to Upload, Try Again.";
		}
	}


	x.send(fr.result);
}

grid.loadRISEzip = function(f) {
	var file = f.files[0];
	var filename = file.name;
	model_name = file.name.split('.').slice(0, -1).join('.');
	if (filename.split('.').pop() == 'zip') {
		JSZip.loadAsync(file).then(function (f) {
			Object.keys(f.files).forEach(function (filename) {
				f.files[filename].async('string').then(function (fileData) {
					filename_ext = filename.split('.').pop();
					if (filename_ext == "ma") {
						var box = document.getElementById(filename_ext + "-file").parentNode.children[3];
						var model_file = new File([fileData], filename, {
							type: "text/plain",
						});
						grid.model.name = file.name.slice(0, file.name.lastIndexOf('.'));
						processFile(box, "ma", model_file);
						//Model File
					}
					else if (filename_ext == "val") {
						//value file
						var box = document.getElementById(filename_ext + "-file").parentNode.children[3];
						var value_file = new File([fileData], filename, {
							type: "text/plain",
						});
						processFile(box, "val", value_file);
					}
					else if (filename_ext == "pal") {
						//pallete file
						var box = document.getElementById(filename_ext + "-file").parentNode.children[3];
						var pallete_file = new File([fileData], filename, {
							type: "text/plain",
						});
						processFile(box, "pal", pallete_file);
					}
				})
			})
		})
    }


	var url = "http://vs1.sce.carleton.ca:8080/cdpp/sim/workspaces/test/dcdpp/" + model_name+ "?zdir=" + model_name;

	var fr = new FileReader();
	fr.readAsArrayBuffer(file);

	var x = new XMLHttpRequest();
	x.open("POST",url, true);
	x.setRequestHeader("Authorization", "Basic " + btoa("test:test"));
	x.overrideMimeType("application/octet-stream");
	x.setRequestHeader('Content-type','application/zip');


	x.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 202) {
			var box_zip = document.getElementById("zip-file").parentNode.children[2];
			box_zip.innerHTML = file.name + '<font color=green><br><b>Loaded!!</b></font>';
		}
		else {
			var box_zip = document.getElementById("zip-file").parentNode.children[2];
			box_zip.innerHTML = "'<font color=red>Failed to Upload. Try Again";
		}
	}
	x.send(fr.result);
}

function startSimulate() {
	url = "http://vs1.sce.carleton.ca:8080/cdpp/sim/workspaces/test/dcdpp/" + model_name + "/simulation";

	var x = new XMLHttpRequest();


	x.open("PUT",url,true);
	x.setRequestHeader("Authorization", "Basic " + btoa("test:test"));
	grab('Simulate').innerHTML = "Simulation Pending";
	grab('Simulate').style.background = '#f7c933';
	x.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 202) {
			getSimulationLog();
			grab('Simulate').innerHTML = "Simulation Complete. Run Simulation";
			grab('Simulate').style.background = 'green';
			grab('Simulate').disabled = false;
			grab('Simulate').onclick=function() {
				grid.loadSimulation()
				switchtoStandard();
			};
		}
	}
	x.send("START_SIMULATION");
}

function getSimulationLog() {
	url = "http://vs1.sce.carleton.ca:8080/cdpp/sim/workspaces/test/dcdpp/" + model_name + "/results";

	var x = new XMLHttpRequest();
	x.open("GET", url, true);
	x.setRequestHeader("Authorization", "Basic " + btoa("test:test"));
	x.responseType = "blob";

	x.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 202) {

		}
		else {
			var box = document.getElementById("log-file").parentNode.children[3];
			box.innerHTML = "'<font color=red>Failed to Download.";
		}
	}


	x.onload = function() {
		blob = x.response;
		file = new File([blob],"log.zip");

		JSZip.loadAsync(file).then(function (f) {
			Object.keys(f.files).forEach(function (filename) {
				f.files[filename].async('string').then(function (fileData) {
					filename_ext = filename.split('.').pop();
					if (filename_ext == "log") {
						var log_file = new File([fileData], filename, {
							type: "text/plain",
						});
						inp.logFile = log_file;
						inp.logLoaded = true;
						var box = document.getElementById("log-file").parentNode.children[3];
						box.innerHTML = file.name+'<font color=#f7c933><br><b>Ready to parse</b></font>';
					}
				})
			})
		})
	}
	x.send();
}
