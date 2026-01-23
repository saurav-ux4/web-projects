//variables
const login = document.getElementById("login");
const logout = document.getElementById("logout");
const para1 = document.getElementById("para1");
const profile = document.getElementById("profile");
const profilelog = document.getElementById("prolog");





// object of user
let user = {
                profile:  {   name:"saurav",
                              age: 19,
                              email:"saurav.982216@gmail.com",
                              isloggedin :false},

      login:function(){
                if(this.profile.isloggedin){
                   para1.textContent =  "you are already logged in";
                 
                }else{
                  para1.textContent =  "you are successfully logged in";
                  this.profile.isloggedin=true;
                }
        },

       logout: function(){
         if(this.profile.isloggedin){
           para1.textContent="you are logged out";
            this.profile.isloggedin=false;
                 
          }else{
            
                para1.textContent="you are already logged out";
                 
            }

            },

       getProfile: function(){
           profilelog.innerHTML = "";
            if(this.profile.isloggedin==true){
                    
               for(let key in this.profile){
                     profilelog.innerHTML += key + ":" + this.profile[key]+ "<br>";
               }
               }else{
                     profilelog.textContent= "you are logged out";
               }
            }
       
 
      

         }
       


//login
login.addEventListener("click", function(){
     user.login();
});


//logout
logout.addEventListener("click", function(){
     user.logout();
});

//profile
profile.addEventListener("click", function(){
    
        user.getProfile();
       
});