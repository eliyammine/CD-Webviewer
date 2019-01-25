/*******************************************************
 * Author: 	Omar Hesham, June 2015.
 * Advanced Real-Time Simulation Lab.
 * Carleton University, Ottawa, Canada.​​
 * License: [TODO] Something opensource
 *
 * Project: 	Online Cell-DEVS Visualizer
 * File: 		recording.js
 * Description: Handles recording of simulation
 * 			
 */

 
grid.view.isRecording = false;
grid.view.video = {};
grid.view.videoOutput;
grid.view.playbackHandle = 0;
grid.view.playbackDirection = 0; // 0: paused, 1: forwards, 2: backwards
grid.view.FPS = 1000/ grab('framerate').value;


grid.nextFrame = function(){
	if(grid.view.currentTimeFrame<grid.model.frameCount-1){
		grid.view.currentTimeFrame++;
		grid.updateGridView();
	}
	else{
		// Loop back to first frame
		if(grab('loop').checked){
			grid.view.currentTimeFrame = 0;
			grid.updateGridView();
		} else
			grid.pausePlayback();	
	}
}

grid.prevFrame = function(){
	if(grid.view.CACHE_ENABLED){
		if(grid.view.currentTimeFrame>0){
			// Can only rewind to cache points
			grid.view.currentTimeFrame = previousCacheTime(--grid.view.currentTimeFrame);
			grid.updateGridView();
		}
		else{
			if(grab('loop').checked){
				grid.view.currentTimeFrame = grid.model.frameCount-1;
				grid.updateGridView();
			} else
				grid.pausePlayback();
		}
	}
}

grid.rewindPlayback = function(){
	//var previousState = grid.view.playbackDirection;
	grid.pausePlayback();
	grid.view.currentTimeFrame = 0;
	grid.updateGridView();
	//if (previousState == 1) //if we were already 'playing' before rewinding, continue playing
	//	grid.playFrames();
}

grid.lastFrame = function(){
	if(grid.view.CACHE_ENABLED){
		//var previousState = grid.view.playbackDirection;
		grid.pausePlayback();
		grid.view.currentTimeFrame = grid.model.frameCount-1;
		grid.updateGridView();
		//if (previousState == 1) //if we were already 'playing' before rewinding, continue playing
			//grid.playFrames();
	}
}

grid.playFrames = function(){
	// Don't set an interval if already playing forwards (1)
	if(grid.view.playbackDirection != 1){
		grid.pausePlayback();
		grid.view.playbackDirection = 1;
		grid.view.playbackHandle = setInterval(grid.nextFrame, grid.view.FPS);
		// Visual feedback
		grab('BtnPlay').style.backgroundColor='#335536';
		grab('BtnPlay').innerHTML = '<B>I</B> <B>I</B>';
		grab('BtnPlayBw').style.backgroundColor='';
		grab('BtnPlayBw').innerHTML = '&#x25C1;&#x25C1';
	}else{
		grid.pausePlayback();
	}
}

grid.playFramesBackwards = function(){
	// Don't set an interval if already playing backwards (2)
	if(grid.view.playbackDirection != 2){
		grid.pausePlayback(); // for reversing playback direction
		grid.view.playbackDirection = 2;
		grid.view.playbackHandle = setInterval(grid.prevFrame, grid.view.FPS);
		//Visual feedback
		grab('BtnPlayBw').style.backgroundColor='#335536';
		grab('BtnPlayBw').innerHTML='<B>I</B> <B>I</B>';
		grab('BtnPlay').style.backgroundColor='';
		grab('BtnPlay').innerHTML = '&#x25B6;';
	}else{
		grid.pausePlayback();
	}
}

grid.pausePlayback = function(){
	grid.view.playbackDirection = 0;
	clearInterval(grid.view.playbackHandle);
	// Visual feedback
	grab('BtnPlay').style.backgroundColor='';
	grab('BtnPlay').innerHTML = '&#x25B6';
	grab('BtnRecord').style.backgroundColor=''; 
	grab('BtnRecord').innerHTML='<b style="color:#A44A4A">&#x25cf;</b> Record Video';
	grab('BtnPlayBw').style.backgroundColor='';
	grab('BtnPlayBw').innerHTML = '&#x25C1;&#x25C1';
}

grid.recordFrames = function(){
	// Return if not in Desktop Chrome
	if(!(window.chrome && !window.opera) || /(android)/i.test(navigator.userAgent)){
		window.alert("Sorry, video recording is only supported on Desktop Chrome ;(");
		return;
	}
	if (grid.model.frameCount == 0) return;
	
	if(!grid.view.isRecording){
		//Create new video object (fps, quality [0-1])
		grid.view.video = new Whammy.Video(1000/grid.view.FPS, 1/*0+grab('vidQual').value*/); 
		grab('videoLink').style.display = 'none';
		grab('videoDownloadLink').style.display = 'none';
		grab('videoViewLink').style.display = 'none';
		grid.pausePlayback();
		grid.view.playbackDirection = 1;
		grid.view.playbackHandle = setInterval(grid.recordNextFrame,grid.view.FPS);
		grid.view.isRecording = true;
		// Visual feedback
		grab('BtnRecord').style.backgroundColor='#683535';
		grab('BtnRecord').innerHTML = '&#x25A0; Stop Recording';		

		// Disable timeline controls that might affect this
		grid.toggleUI(false);
							
	}
	else{
		// Stop recording here. Compile the whole video.
		grid.view.isRecording = false;
		grid.pausePlayback();
		grid.view.video.output = grid.view.video.compile();
		var vidURL = URL.createObjectURL(grid.view.video.output);
		grab('videoLink').style.display = 'inline';
		grab('videoDownloadLink').style.display = 'inline';
		grab('videoViewLink').style.display = 'inline';
		grab('videoDownloadLink').href = vidURL;
		grab('videoDownloadLink').download = grid.model.name+'.webm';
		grab('videoViewLink').onclick = function(){
			var watch = window.open(vidURL,"_blank","width="+grid.view.canvy.width+",height="+grid.view.canvy.height);
			return; 
		}

		// renable the timeline buttons
		grid.toggleUI(true);
		// Disable random access and backwards playback if cache is disabled
		if(!grid.view.CACHE_ENABLED)
			grid.toggleUI(false, ['timelineSeek','BtnPlayBw','BtnStepBw','BtnLastFrame']);
	}
}

grid.recordNextFrame = function(){
	if(grid.view.currentTimeFrame<grid.model.frameCount-1){
		// Record this image frame
		grid.view.video.add(grid.view.gfx);
		grid.view.currentTimeFrame++;
		grid.updateGridView();
		return;
	}
	else if(grid.view.currentTimeFrame==grid.model.frameCount-1){
		// Add last frame
		grid.view.video.add(grid.view.gfx);
	}

	// End of timeline. Compile the whole video.
	// Stop recording here. Compile the whole video.
	// Stop recording here. Compile the whole video.
	grid.view.isRecording = false;
	grid.pausePlayback();
	grid.view.video.output = grid.view.video.compile();
	var vidURL = URL.createObjectURL(grid.view.video.output);
	grab('videoLink').style.display = 'inline';
	grab('videoDownloadLink').style.display = 'inline';
	grab('videoViewLink').style.display = 'inline';
	grab('videoDownloadLink').href = vidURL;
	grab('videoDownloadLink').download = grid.model.name+'.webm';
	grab('videoViewLink').onclick = function(){
		var watch = window.open(vidURL,"_blank","width="+grid.view.canvy.width+",height="+grid.view.canvy.height);
		return; 
	}
	

	// renable the timeline buttons
	grid.toggleUI(true);
	// Disable random access and backwards playback if cache is disabled
	if(!grid.view.CACHE_ENABLED)
		grid.toggleUI(false, ['timelineSeek','BtnPlayBw','BtnStepBw','BtnLastFrame']);
}

grid.seekTimeline = function(){
	if(grid.view.CACHE_ENABLED){
		// Record playback direction
		var i = grid.view.playbackDirection;
		// Pause and seek along user input
		grid.pausePlayback();
		// Jump to the nearest cache point and update the view
		grid.view.currentTimeFrame = nearestCacheTime(grab('timelineSeek').value);
		grid.updateGridView();
		if(i){  // If timeline was playing before user started seeking, continue playback
			if(i<2)	grid.playFrames();
			else grid.playFramesBackwards();
		}
	}
}

grid.toggleLoop = function(){
	// If standing at last frame, assume user intends to play right away
	if(grab('loop').checked && grid.view.currentTimeFrame==grid.model.frameCount-1)
		grid.playFrames();
}

// Sticky the timeline controls
grid.stickyControls = function(){
	var	headerTop = grab('header').clientHeight,
		headerLeft= grab('header').clientWidth,
		scrollTop = window.pageYOffset,
		scrollLeft= window.pageXOffset,
		controls  = grab('stickyDiv');
	/* (window.pageYOffset !== undefined) ?
	 window.pageYOffset : (document.documentElement 
	 || document.body.parentNode || document.body).scrollTop;*/
	if(scrollTop-headerTop > 0){
		controls.style.top = (scrollTop-headerTop)+'px';
		controls.style.boxShadow = '0px 3px 5px #222';
	}
	else{
		controls.style.top = 0;
		controls.style.boxShadow = 'none';
	}
	controls.style.left = scrollLeft +'px';
}
window.onscroll = grid.stickyControls; 