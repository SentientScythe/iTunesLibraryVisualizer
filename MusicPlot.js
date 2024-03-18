var data = []; //array of all song objects
var headers = []; //array of header Strings

//default page title
var title = d3.select("#title");
var tArray = [title.text()];
var delimiter = " -> ";

// order of vis generation
var hierarchy = ["Genre", "Artist", "Album"];
hierarchy.push("Name"); // "Name" MUST be the last string in the array
var nameIndex = hierarchy.length - 1;

//contains values for bubbles
var valueMatrix = [];
for(h1 in hierarchy) {
	valueMatrix.push([])
	for(h2 in hierarchy) {
		if(h1 == h2) {
			break;
		}
		valueMatrix[h1].push([]);
	}
}

//for filtering bubbles
var owners = [];
for(h1 in hierarchy) {
	owners.push([])
	for(h2 in hierarchy) {
		if(h1 == h2) {
			break;
		}
		owners[h1].push([]);
	}
}

//play/skip ratios
var ratios = [];
for(h in hierarchy) {
	ratios.push([]);
}

var index = 0; //initial hierarchy index

//get size of svg element
var rect = document.getElementById("chart").getBoundingClientRect();
var width = rect.width;
var height = rect.height;

//selected element
var active = d3.select(null);

//size back arrow and register listener
var arrowHeight = d3.select("#arrow")[0][0].height.baseVal.value;
d3.select("#arrow")
	.attr("width", arrowHeight)
	.on("click", back);

//create layout
var bubble = d3.layout.pack()
	.sort(null)
	.size([width, height])
	.padding(22.5);

//create zoom behaviour
var panZoom = d3.behavior.zoom()
	.scaleExtent([1, Infinity]);

//create svg selection and initiate stop function
var svg = d3.select("#chart")
	.on("click", stopped, true)
	.on("dblclick", stopped, true);

//create rect listener
svg.append("rect")
	.attr("width", width)
	.attr("height", height)
	.attr("class", "overlay")
	.on("click", reset);

//array of g selections for each layer
//initialized with first g
var gArray = [];

//initiate zooming and display default view
//MUST be on svg for proper function
svg.call(panZoom)
	.on("dblclick.zoom", null); //disable double click to zoom

//bubble colours
var colour = d3.scale.linear()
	.domain([0, 1])
	.range(["#e9a3c9", "#a1d76a"]);

//scale for normalizing plays/skips
var normalizer = d3.scale.linear().range([0, 1]);

//load data and perform initial functions
d3.csv("iTunesLibrary.csv",
	function(error, csv) {
		if (error) {
			console.log("Error loading iTunesLibrary.csv", error);
			return;
		} else {
			data = csv;
			formatData();
			createVis();
			return;
		}
});

//create dynamic data structures
function formatData() {
	//create array of headers
	headers = d3.keys(data[0]);
	
	//create count objects and play/skip ratios
	for(var song in data) {

		//create array of song properties in order of hierarchy
		var songProperties = [];
		for(h in hierarchy) {
			songProperties.push(data[song][hierarchy[h]]);
		}

		//create owners
		for(hInner in hierarchy) {
			for(hOuter in hierarchy) {
				if(hOuter == hInner) {
					break;
				}
				var p = songProperties[hOuter];
				var p2 = songProperties[hInner];
				if(owners[hInner][hOuter][p] == undefined) {
					owners[hInner][hOuter][p] = [p2];
				} else {
					if(owners[hInner][hOuter][p].every(function(a){return a != p2})) {
						owners[hInner][hOuter][p].push(p2);
					}
				}
			}
		}

		//create play/skip ratios
		var plays = +data[song].Plays;
		var skips = +data[song].Skips;
		
		for(p in songProperties) {
			if(ratios[p][songProperties[p]] == undefined) {
				ratios[p][songProperties[p]] = plays - skips;
			} else {
				ratios[p][songProperties[p]] += plays - skips;
			}
		}
	}

	//normalize ratios
	for(a in ratios) {
		var max = d3.max(d3.values(ratios[a]));
		var min = d3.min(d3.values(ratios[a]));
		normalizer.domain([min, max]);
		for(p in ratios[a]) {
			ratios[a][p] = normalizer(ratios[a][p]);
		}
	}
	
	//create value matrix
	for(hInner in hierarchy) {
		for(hOuter in hierarchy){
			if(hOuter == hInner) {
				break;
			}
			for(a in owners[hInner][hOuter]) {
				var r = ratios[hOuter][a];
				var v = owners[hInner][hOuter][a].length;
				valueMatrix[hInner][hOuter].push({name: a, className: a.toLowerCase(), value: v, ratio: r});
			}
		}
	}
}

//create a new visualization in a container
function createVis() {
	//current category to be rendered
	var category;
	if(nameIndex == index) {
		category = [];
		a = owners[nameIndex][index - 1][tArray[index]];
		for(song in a) {
			var r = ratios[nameIndex][a[song]];
			category.push({name: a[song], className: a[song].toLowerCase(), value: 1, ratio: r});
		}
	} else {
		category = valueMatrix[nameIndex][index];
	}
	
	//append new g for vis
	gArray.push(svg.append("g"));

	//set translate and scale 
	//begin zoom listener
	panZoom.translate([0, 0])
		.scale(1)
		.on("zoom", zoom);
	
	//update height and width
	updateSize();
	
	var nodes;

	if(index == 0) { //draw default
		nodes = bubble.nodes({children:category})
			.filter(function(d){return !d.children;});
	} else if(index == nameIndex) {
		var nb = d3.layout.pack()
			.size([width, height])
			.padding(75);
		nodes = nb.nodes({children:category})
			.filter(function(d){return !d.children;});
	} else { //must filter out the selection
		nodes = bubble.nodes({children:category.filter(function(d) {
			var test = d.name;
			return owners[index][index - 1][active.datum().name].some(function(d) {
				return d == test;
			});
		})})
			.filter(function(d){return !d.children;});
	}

	gArray[index].selectAll("circle")
		.data(nodes)
		.enter()
		.append("circle")
		.on("click", oneClick)
		.on("dblclick", twoClick)
		.attr("r", function(d){return d3.round(d.r, 2);})
		.attr("cx", function(){return width / 2;})
		.attr("cy", function(){return height / 2;})
		.attr("fill", "#242424")
		.attr("stroke", "#242424")
		.transition()
		.duration(750)
		.attr("cx", function(d){return d3.round(d.x, 2);})
		.attr("cy", function(d){return d3.round(d.y, 2);})
		.attr("fill", function(d){return colour(d.ratio);})
		.attr("stroke", function(d){return colour(d.ratio);});

	gArray[index].selectAll("text")
		.data(nodes)
		.enter()
		.append("text")
		.attr("fill", "#242424")
		.attr("x", function(){return width / 2;})
		.attr("y", function(){return height / 2;})
		.attr("lengthAdjust", "spacingAndGlyphs")
		.text(function(d) {
			if(d.name == "") {
				return "Unknown " + hierarchy[index];
			}
			return d.name;
		})
		.attr("font-size", function(d){
			var scale = d3.scale.linear()
				.domain([1, d3.min([width, height])])
				.range([0.5, 8]);
			return scale(d.r) + "vmin";
		})
		.transition()
		.duration(800)
		.attr("fill", "#f7f7f7")
		.attr("x", function(d){return d3.round(d.x, 2);})
		.attr("y", function(d){return d3.round(d.y, 2);});
}

//update width and height variables
function updateSize() {
	rect = document.getElementById("chart").getBoundingClientRect();
	width = rect.width;
	height = rect.height;
}

//single click event
function oneClick(d) {
	//update active bubble
	active.classed("active", false);
	active = d3.select(this).classed("active", true);

	//calculate pan and zoom for focus
	updateSize();//update width and height
	var scale = 0.1 / Math.min(active.attr("r") * 2 / width, active.attr("r") * 2 / height);
	if(scale < 1) {
		scale = 1;
	}
	var translate = [width / 2 - scale * active.attr("cx"), height / 2 - scale * active.attr("cy")];
	
	manualZoom(translate, scale);

	//gather data with active.datum()
	var name = active.datum().name;
	var infoSVG = d3.select("#info");

	//reset text elements 
	infoSVG.selectAll("text")
		.remove();

	infoSVG.selectAll("text")
		.data(hierarchy)
		.enter()
		.append("text")
		.attr("class", "info")
		.attr("x", "200%")
		.attr("y", function(d, i){
			var n = (i + 1) * 100 / 6;
			return  n.toString() + "%";
		})
		.text(function(d, i){
			if(d == "Name") {
				d = "Song";
			}
			if(index == i) {
				if(name == "") {
					return  d + ": Unknown";
				}
				return d + ": " + name;
			} else if(index < i){
				var records;
				for(r in valueMatrix[i][index]) {
					if(valueMatrix[i][index][r].name == name) {
						records = valueMatrix[i][index][r].value;
						break;
					}
				}
				return d + "s: " + records;
			} else {
				var o = "";
				for(r in owners[index][i]) {
					if(owners[index][i][r].indexOf(name) != -1) {
						if(o != "") {
							o += ", ";
						}
						o += r;
					}
				}
				return d + "(s): " + o;
			}
		})
		.transition()
		.duration(500)
		.delay(function(d, i){return i * 250;})
		.attr("x", "2.5%");
		
	infoSVG.append("text")
		.attr("class", "info")
		.attr("x", "200%")
		.attr("y", function(){
			var y = (hierarchy.length + 1) * 100 / 6;
			return y.toString() + "%";
		})
		.text("Play / Skip ratio (0-1): " + d3.round(ratios[index][active.datum().name], 2))
		.transition()
		.duration(500)
		.delay(function(){return hierarchy.length * 250;})
		.attr("x", "2.5%");
}

function twoClick(d) {
	if(nameIndex == index) {
		return;
	}
	//update active
	active.classed("active", false);
	active = d3.select(this).classed("active", true);
	
	//update width and height
	updateSize();
	
	//calculate scale and translation to center the circle
	var scale = 15 / Math.min(active.attr("r") * 2 / width, active.attr("r") * 2 / height);
	var translate = [width / 2 - scale * active.attr("cx"), height / 2 - scale * active.attr("cy")];
	
	manualZoom(translate, scale);

	//find text of active circle
	var activeText = gArray[index].selectAll("text")
		.attr("display", "none") //hide all active text
		.filter(function(d){return d3.round(d.x, 2) == active.attr("cx") && d3.round(d.y, 2) == active.attr("cy")});

	//store text of active circle
	tArray.push(activeText.text());
	
	//append text to title
	if(index == 0) {
		title.text(tArray[index + 1])
	} else if(index > 1) {
		var arrowIndex = title.text().indexOf(delimiter);
		if(arrowIndex != -1) {
			var i = arrowIndex + delimiter.length;
			var l = title.text().length;
			title.text(title.text().substring(i, l) + delimiter + tArray[index + 1]);
		}
	} else {
		title.text(title.text() + delimiter + tArray[index + 1]);
	}

	//remove fill of active circle
	active.transition()
		.duration(750)
		.attr("fill", "#242424");

	//stop further click events
	gArray[index].selectAll("circle")
		.classed("inactive", true)
		.on("click", null)
		.on("dblclick", null);
	
	index += 1;
	createVis();
}

function reset() {
	//zoom out
	manualZoom([0, 0], 1);
}

function back() {
	//reset active selection
	active.classed("active", false);
	active = d3.select(null);
	
	//remove tags in footer
	d3.select("#info")
		.selectAll("text")
		.remove();

	//remove previous layer and decrement index
	if(index > 0) {
		gArray[index].remove();
		gArray.pop();
		tArray.pop();
		index -= 1;
	}

	//reset title
	var arrowIndex = title.text().lastIndexOf(delimiter);
	if(index == 0) {
		title.text(tArray[0])
	} else if(index > 1){
		title.text(tArray[index - 1] + delimiter + title.text().substring(0, arrowIndex	));
	} else {
		title.text(title.text().substring(0, arrowIndex	));
	}

	//refill the bubble
	gArray[index].selectAll("circle")
		.transition()
		.attr("fill", function(){return d3.select(this).attr("stroke");});

	//re-add click events to old objects
	gArray[index].selectAll("circle")
		.classed("inactive", null)
		.on("click", oneClick)
		.on("dblclick", twoClick);

	//stop hiding text of previous active object 
	gArray[index].selectAll("text")
		.transition()
		.duration(1500)
		.attr("display", null);

	//zoom out
	manualZoom([0, 0], 1);
}

//zooming function
function zoom() {
	gArray[index].attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
}

function manualZoom(translate, scale) {
	panZoom.translate(translate);
	panZoom.scale(scale);
	gArray[index].transition()
		.duration(1250)
		.attr("transform", "translate(" + translate + ")scale(" + scale + ")");
}

function stopped() {
  if (d3.event.defaultPrevented) d3.event.stopPropagation();
}