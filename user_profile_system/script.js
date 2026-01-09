//variables
const login = document.getElementById("login");
const logout = document.getElementById("logout");




// object of user
let user = {
      name:"saurav",
      age: 19,
      email:"saurav.982216@gmail.com",
      isloggedin :false,
      login:function(){
                if(this.isloggedin){
                     console.log("you are already logged in");
                }else{
                     console.log("login as",this.name);
                }
      }
}

login.addEventListener("click", function(){
     user.login();
})