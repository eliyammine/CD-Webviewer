var Viz = {};

Viz.Utils = {
	empty : function(id) {
		var elem = grab(id);
		
		while (elem.firstChild) {
			elem.removeChild(elem.firstChild);
		}
	},

	map : function map(array, delegate) {
		var arr = [];
		
		for (var i in array) {
			arr.push(delegate(array[i], i));
		}
		
		return arr;
	}
}

Viz.data = {
	z 			: null,
	track 		: null,
	port 		: null,
	
	stats : {
		max : null,
		mean : null,
		median : null,
		variance : null
	},
	
	Initialize : function(z, port, track) {		
		this.z = z;
		this.port = port;	
		this.track = track;	
		
		this.UpdateTime(0);
		
		var maxT = grid.model.data.length - 1;
		
		this.ApplyTransitions(maxT);
		
		var transitions = this.TransitionAsArray();
		
		this.stats = {
			max : d3.max(transitions, function(d) { return d.value; }),
			mean : d3.mean(transitions, function(d) { return d.value; }),
			median : d3.median(transitions, function(d) { return d.value; }),
			stddev : Math.sqrt(d3.variance(transitions, function(d) { return d.value; }))
		}
		
		this.UpdateTime(0);
	},
	
	UpdateStates : function(fb) {
		this.states = {};
		var layer = fb[this.z];
		
		for (var i = 0; i < this.track.length; i++) {
			var clss = this.track[i];
			
			this.states[clss] = 0;
			
			for (var j=0; j < layer.length; j++){			
				for (var k=0; k < layer[j].length; k++){ 
					var state = layer[j][k][0];
					
					if (clss == state) this.states[clss]++;
					
					else if (Array.isArray(clss) && state > clss[0] && state < clss[1]) this.states[clss]++;					
				}
			}
		}
	},
	
	ResetTransitions : function() {		
		var activity = Array(grid.model.dimX).fill(null);

		for (var i = 0; i < grid.model.dimX; i++) activity[i] = Array(grid.model.dimY).fill(0);
		
		return activity;
	},
	
	ApplyTransitions : function(t) {		
		dir = (t > this.t) ? 1 : -1;
		
		while (this.t != t) {
			for (var j = 0; j < grid.model.data[this.t].cells.length; j++){
				var transit = grid.model.data[this.t].cells[j];
				
				if (transit.position[2] != this.z) continue;
				
				var x = transit.position[0];
				var y = transit.position[1];
				
				this.transitions[x][y] = this.transitions[x][y] + (dir * 1);
			}
			
			this.t = this.t + (dir * 1);
		}
	},
		
	TransitionAsArray : function () {
		var data = [];
		
		for (var x = 0; x < this.transitions.length; x++) {
			for (var y = 0; y < this.transitions.length; y++) {
				data.push({ x:x, y:y, value:this.transitions[x][y] });
			}			
		}
		
		return data;
	},
	
	StatesAsArray : function() {
		if (!this.states) return null;
		
		return Viz.Utils.map(this.track, function(value) { return this.states[value]; }.bind(this));
	},
	
	UpdateTime : function(t, fb) {
		if (t == 0) this.transitions = this.ResetTransitions();
		
		else this.ApplyTransitions(t);
		
		if (fb) this.UpdateStates(fb);
		
		this.t = t;		
	}
}

Viz.charting = {
	BuildTransitionsChart : function(pNode, type, margin) {	
		var chart = this.BuildChart(pNode, type, margin);
		
		// Title Preparation
		this.AddTitle(chart, "Transition Chart");
		
		this.AddTooltip(chart);
		
		// Gradient preparation
		var buckets = 9;
		var colors = ["#ffffcc","#ffeda0","#fed976","#feb24c","#fd8d3c","#fc4e2a","#e31a1c","#bd0026","#800026"]; 
		
		var cW = chart.size.w / grid.model.dimX;
		var lW = chart.size.w / buckets;
		
		chart.size.h = cW * grid.model.dimY;
		chart.svg.attr("height", chart.size.h + margin[1] + margin[3]);
		
		var gradient = d3.scaleQuantile()
						 .domain([0, buckets, Viz.data.stats.max])
						 .range(colors);
		
		// Building the legend, add a square for each gradient value	
		var g = chart.g.selectAll(".legend")
					   .data(gradient.range())
					   .enter().append("g")
					   .attr("class", "legend");

	    g.append("rect")
		 .attr("x", (d, i) => lW * i)
		 .attr("y", chart.size.h + 20)
		 .attr("width", lW)
		 .attr("height", 15)
		 .style("fill", (d, i) => d);

		chart.g.append("text")
		 .attr("class", "text")
		 .text("0")
		 .attr("width", lW)
		 .attr("x", 0)
		 .attr("y", chart.size.h + 17);

		chart.g.append("text")
		 .attr("class", "text")
		 // .text(d3.max(data, (d) => d.value))
		 .text(Viz.data.stats.max)
		 .attr("width", lW)
		 .attr("x", (buckets - 1) * lW)
		 .attr("y", chart.size.h + 17);
		
		// cells 
		var data = Viz.data.TransitionAsArray();
		
		var cells = chart.g.selectAll(".heat").data(data);

		cells.enter().append("rect")
					 .attr("x", (d) => (d.x) * cW)
					 .attr("y", (d) => (d.y) * cW)
					 .attr("class", "heat")
					 .attr("width", cW)
					 .attr("height", cW);

		var cells = chart.g.selectAll(".heat")
						   .on("mouseover", onHeatMouseOver)
						   .on("mouseout", onHeatMouseOut);
		
		chart.Update = function(heat) {		
			chart.g.selectAll(".heat").data(heat)
				   .style("fill", (d) => gradient(d.value));
		}		
		
		function UpdateTooltip() {
			var cell = d3.event.target;
			
			var d = chart.cell.data()[0];
			var text = "x : " + d.x + "<br>y : " + d.y + "<br>value: " + d.value;
			
			bbox = cell.getBoundingClientRect();
			
			chart.tooltip.html(text)
						 .style("left", d3.event.pageX + 5 + "px")
						 .style("top", d3.event.pageY - 55 + "px");
		}
		
		function onHeatMouseOver(d, i, cells) {
			chart.cell = d3.select(cells[i]);
			
			UpdateTooltip();
			
			chart.tooltip.style("opacity", .9);
		}
		
		function onHeatMouseOut() { 
			chart.tooltip.style("opacity", 0);
		}
		
		return chart;
	},
	
	BuildStatesChart : function(pNode, type, margin){
		var chart = this.BuildChart(pNode, type, margin);
	
		// Title Preparation
		this.AddTitle(chart, "State Frequency Chart");
		
		// Y axis preparation
		chart.y = d3.scaleLinear().rangeRound([chart.size.h, 0]);
		
		chart.y.domain([0, grid.model.dimX * grid.model.dimY]);
		
		chart.yaxis = chart.g.append("g")
						     .attr("class", "axis axis--y")
						     .call(d3.axisLeft(chart.y))
		
		var t = chart.g.append("text")
					   .text("Frequency");
		
		var bbox = t.node().getBoundingClientRect();
		
		t.attr("class", "text")
		 .attr("transform", "rotate(-90)")
		 .attr("text-anchor", "end")
		 .attr("y", (-1) * bbox.width + 5);
		
		// X axis preparation		
		chart.x = d3.scaleBand().rangeRound([0, chart.size.w]).padding(0.1);
		
		chart.x.domain(Viz.data.track);
		
		var axis = d3.axisBottom(chart.x);
		
		chart.xaxis = chart.g.append("g")
						     .attr("class", "axis axis--x")
						     .attr("transform", "translate(0," + chart.size.h + ")")
						     .call(axis);

		var t = chart.g.append("text")
					   .text("State");
					  
		t.attr("class", "text")
		 .attr("x", chart.size.w - 15)
		 .attr("text-anchor", "end")
		 .attr("y", chart.size.h + 40)
		
		this.AddTooltip(chart);
		
		// Refresh data bars, remove old, regenerate
		chart.g.selectAll(".bar")
			 .data(Viz.data.track)
			 .enter().append("rect")
			 .attr("class", "bar")
			 .attr("x", function(d) { return chart.x(d); })
			 .attr("width", chart.x.bandwidth())
			 .style("fill", function(d, i) { return grid.getColor(d); })
			 .style("stroke", d3.color("rgb(107,107,107)"));	
		
		chart.g.selectAll(".bar")
			   .on("mouseover", onBarMouseOver)
			   .on("mouseout", onBarMouseOut);

		chart.Update = function(states) {
			if (this.bar) UpdateTooltip();
			
			// refresh data bars, remove old, regenerate
			this.g.selectAll(".bar")
				.data(states)
				.attr("y", function(d) { return this.y(d); }.bind(this))
				.attr("height", function(d) { return this.size.h - this.y(d); }.bind(this))
		}
		
		function UpdateTooltip() {
			if (!chart.tooltip) return;
		
			var bbox1 = chart.tooltip.node().getBoundingClientRect();
			var bbox2 = chart.bar.node().getBoundingClientRect();
			
			chart.tooltip.html(chart.bar.data()[0]);
			
			chart.tooltip.style("left", (bbox2.left + bbox2.width / 2 - bbox1.width / 2 + 3) + "px");
			
			chart.tooltip.style("top", (bbox2.top + document.documentElement.scrollTop - 25) + "px");
		}
		
		function onBarMouseOver(d, i, bars) {
			chart.bar = d3.select(bars[i]);
			
			UpdateTooltip();
			
			chart.tooltip.style("opacity", .9);
		}
		
		function onBarMouseOut() { 
			chart.tooltip.style("opacity", 0);
		}
		
		return chart;
	},
	
	BuildChart : function(pNode, type, margin) {
		var classes = ["chart-container"];
		
		if (type) classes.push(type);
		
		var div = d3.select(pNode).append("div").attr("class", classes.join(" "));
		var div = div.append("div").attr("class", "chart");
		
		var chart = {
			svg : div.append("svg").attr("class", "chart-svg")
		};
		
		chart.svg.attr("width", div.node().clientWidth).attr("height", div.node().clientHeight);
		
		chart.size = {
			w : chart.svg.node().width.animVal.value - margin[0] - margin[2],
			h : chart.svg.node().height.animVal.value - margin[1] - margin[3]
		}
				
		chart.g = chart.svg.append("g")
					   .attr("transform", "translate(" + margin[0] + "," + margin[1] + ")");
					   
	    return chart;
	},
	
	AddTitle : function(chart, title) {
		var t = chart.g.append("text")
					   .text(title);
		
		var bbox = t.node().getBoundingClientRect();
		
		t.attr("class", "text title")
		 .attr("x", chart.size.w / 2 - bbox.width / 2)
		 .attr("y", -20)
	},
	
	AddTooltip : function(chart) {
		chart.tooltip = d3.select("body")
					      .append("div")
					      .attr("class", "tooltip")
					      .style("opacity", 0);
	}
}

Viz.stats = {
	Build : function(pNode, data) {
		var classes = ["chart-container"];
		
		var div = d3.select(pNode).append("div").attr("class", classes.join(" "));

		var stats = {
			root : div.append("div").attr("class", "chart stats")
		}
		
		stats.time = stats.root.append("div").attr("class", "time title");
		
		var div = stats.root.append("div")
						    .attr("class", "states")
		
		div.append("span").attr("class", "title").html("States at current time :");
		
		var div = div.append("div").attr("class", "results");
		
		var data = Viz.Utils.map(data.track, function(d) { return { state:d, frequency:0 }; });
		
		stats.states = div.selectAll(".label")
					      .data(data)
					      .enter()
					      .append("div")
					      .attr("class", "label")
					      .html(d => d.state + " : " + d.frequency)
						  .nodes();
		
		var div = stats.root.append("div")
						    .attr("class", "transitions")
					 
		stats.transitions = div.append("div")
							   .attr("class", "transitions")
							   .append("span")
							   .attr("class", "title")
							   .html("Transitions Statistics:")
							   .append("div")
							   .attr("class", "results");
		
		addrow("Max: ", "label medium", Viz.data.stats.max);
		addrow("Mean: ", "label medium", Viz.data.stats.mean.toFixed(3));
		addrow("Median: ", "label medium", Viz.data.stats.median);
		addrow("Std. Dev: ", "label medium", Viz.data.stats.stddev.toFixed(3));

		function addrow(label, css, value) {
			var div = stats.transitions.append("div").attr("class", "row");
			
			div.append("div").attr("class", css).html(label);
			
			div.append("div").html(value);
		}
		
		stats.Update = function(t, states) {
			this.time.html("Current time frame : " + t);
		
			var aData = Viz.Utils.map(states, function(d, i) { return { state:+i, frequency:d }; });
			var count = 0;
			
			for (var i = 0; i < aData.length; i++) {
				count += aData[i].frequency;
			}
		
			for (var i = 0; i < aData.length; i++) {
				var percentage = ((aData[i].frequency/count)*(10000/100)).toFixed(2);
				if (count ==0) percentage = 0..toFixed(2);
				this.states[i].innerHTML = aData[i].state + " : " + aData[i].frequency + "  (" + percentage + "%)";
			}
		}
		return stats;
	}
};