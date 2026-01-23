

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

 

 let isPlaying =false;
Images.src=images[currentIndex];
music.src=songs[currentIndex];
 music.pause();

//play
playBtn.addEventListener("click", function(){
 
   musicPlayer.play();

});




//previous
previous.addEventListener("click", function(){
   
        musicPlayer.pre();

})



//next
next.addEventListener("click", function(){
 
       musicPlayer.next();

  
})

 


//prototype

let musicPlayer = {
        pre : function(){
                    currentIndex--;
                    if(currentIndex < 0 ){
                         currentIndex= songs.length-1;
                         currentIndex=images.length-1;

                         music.src=songs[songs.length-1 ];
                         Images.src=images[songs.length-1 ];
                         music.play();
       

                    }else{
         
                        music.src=songs[currentIndex ];
                        Images.src=images[currentIndex ];
         
                        music.play();
                        currentIndex--;

                                 }
                       },

       play : function(){
              
                    if(isPlaying){
                        music.pause();
                        isPlaying = false; 

                   }else{
           
                        music.play();
                        isPlaying = true; 

         }
 
       },


       next : function(){
                   if(currentIndex >= songs.length-1 ){
                      currentIndex=0;
    
    
                      music.src= songs[currentIndex];
                      Images.src=images[currentIndex]
                      music.play();
    

     
                  }else{
   
                      currentIndex++
                      music.src= songs[currentIndex];
                      Images.src=images[currentIndex]
                      music.play();
                   }   
                          }
 } 