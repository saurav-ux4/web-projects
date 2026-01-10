//variables
const login = document.getElementById("login");
const logout = document.getElementById("logout");
const para1 = document.getElementById("para1");





// object of user
let user = {
      name:"saurav",
      age: 19,
      email:"saurav.982216@gmail.com",
      isloggedin :false,
      login:function(){
                if(this.isloggedin){
                   para1.textContent =  "you are already logged in";
                 
                }else{
                  para1.textContent =  "you are successfully logged in";
                  this.isloggedin=true;
                }
        },

       logout: function(){
         if(this.isloggedin){
           para1.textContent="you are logged out";
            this.isloggedin=false;
                 
          }else{
            
                para1.textContent="you are already logged out";
                 
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
})