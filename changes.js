

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