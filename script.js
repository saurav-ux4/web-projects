//variables
const login = document.getElementById("login");
const logout = document.getElementById("logout");
const para1 = document.getElementById("para1");
const para2 = document.getElementById("para2");




// object of user
let user = {
      name:"saurav",
      age: 19,
      email:"saurav.982216@gmail.com",
      isloggedin :false,
      login:function(){
                if(this.isloggedin){
                   para1.textContent =  "logged in";
                   this.isloggedin==true;
                }else{
                 this.isloggedin==false;
                }
        },

       logout: function(){
         if(this.isloggedin){
            para2.textContent="logged out";
                 this.isloggedin==false;
          }else{
            cd  web project    
            this.isloggedin==true;
                 
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