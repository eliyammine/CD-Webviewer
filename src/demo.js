/*******************************************************
 * Author: 	Denis Chupin, March 2019
 * Advanced Real-Time Simulation Lab.
 * Carleton University, Ottawa, Canada.​​
 * License: [TODO] Something opensource
 *
 * Project: 	Online Cell-DEVS Visualizer
 * File: 		demo.js
 * Description: The library to handle one-button-click
 *              input of demo files
 */
var demo = window.demo || {};

 //Generalized function to load local file
 demo.loadLocal = function (file) {
   /*var fileReader = new XMLHttpRequest();

   fileReader.addEventListener("error",function FRFailed()
        {   // This will be executed if an error occurs.
            console.log("Error:",this.status);
        });

    fileReader.addEventListener("timeout",function FRTimeOut()
        {   // This will be executed if the reading times out.
            console.log("File reading timed out!");
        });

        fileReader.addEventListener("load",
             function Finished()
             {   // When reading is finished, send data to external function.
                 if ((this.readyState==4)&&(this.status==200 || this.status==0))
                 {
                     RunMe(this.response);
                 }
             },
             false);

         fileReader.open("GET",FileName,true);
         fileReader.overrideMimeType(FileType);
         fileReader.responseType="text";
         fileReader.timeout=10000; // Setting time-out to 10 s.

         fileReader.send(null);*/
         var rawFile = new XMLHttpRequest();
    rawFile.open("GET", file, true);
    rawFile.onreadystatechange = function ()
    {
        if(rawFile.readyState === 4)
        {
            if(rawFile.status === 200 || rawFile.status == 0)
            {
                var allText = rawFile.responseText;
                alert(allText);
            }
        }
    }
    rawFile.send(null);
 }

demo.openFile = function (response) {
  console.log(response);
}
