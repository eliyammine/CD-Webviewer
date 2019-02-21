

function showStats(){
	
var stat = document.getElementsByClassName('changeStats');	
	if(stat[0].style.display == '' || stat[0].style.display == 'none'){
        stat[0].style.display = 'inline-block';		
   }
   else {	
        stat[0].style.display = 'none';
		
   }
}