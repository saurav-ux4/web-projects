

const playBtn= document.getElementById("btnPlay");
const pauseBtn= document.getElementById("btnPause");
const music = document.getElementById("song");
const previous = document.getElementById("pre");
const next = document.getElementById("next");
const thumbnail = document.querySelector(".thumbnail");
const Images = document.getElementById("image");


 let songs = [ "song1.mp3",
               "song2.mp3",
               "song3.mp3",
               "song4.mp3"    
        ];
 let currentIndex= 0;

 let images = [ "song1.jpg",
                "song2.jpg",
                "song3.jpg",
                "song4.jpg",
 ];

 let currentImage = 0;






//play
playBtn.addEventListener("click", function(){
  Images.src=images[currentImage];
  music.src=songs[currentIndex];
  

 
  
     music.play();
 

});


//pause
pauseBtn.addEventListener("click", function(){
  
   if( music.paused == true){
      music.play();
   }else {
      music.pause();
   }
   
});


//previous
previous.addEventListener("click", function(){
        //for songs
        music.src=songs[currentIndex ];
        currentIndex--;
          music.play();


        //for images
         Images.src=images[currentImage];
         currentImage--;

      
        
            if(currentIndex < 0 ){
         currentIndex= songs.length-1;
         currentImage=images.length-1;
  }

  

   
})




//next
next.addEventListener("click", function(){
   //for song
   music.src= songs[currentIndex] ;
   music.play();
   
   
   Images.src=images[currentImage]
   currentImage++
   currentIndex++;
  


  if(currentIndex > songs.length -1){
     currentIndex=0;
     currentImage=0;
  }
  
  
})

 