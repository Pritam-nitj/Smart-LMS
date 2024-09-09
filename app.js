const express = require('express');
const app = express();
const path = require('path');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const userModel = require('./models/user');

app.set('view engine', 'ejs');

app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(express.static(path.join(__dirname,'/public')))

app.get('/',function(req,res){
    res.render("index");
})

app.get('/Signup',function(req,res){
    res.render("signup");
})

app.post('/signup',function(req,res){
    let {role,username,fathersName,email,password} = req.body;
    bcrypt.genSalt(10,(err,salt)=>{
        bcrypt.hash(password,salt,async(err,hash)=>{
            let createdUser = await userModel.create({
                role,
                username,
                fathersName,
                email,
                password: hash
            });
            let token = jwt.sign({email},"shhhhhhhuuuuttt");
            res.cookie("token",token);
            if(role === "member") res.redirect("/Member");
            if(role === "admin") res.redirect("/Admin")
            else res.redirect('/Librarian')
        });
    })
})

app.post("/login",async function(req,res){
    let user = await userModel.findOne({email: req.body.email})
    if(!user) return res.send("Email Or Password Incorrect!")

    if(req.body.role != user.role) return res.send("Email or Password Incorrect!")
    
    bcrypt.compare(req.body.password,user.password,function(err,result){
        if(result){
            let token = jwt.sign({email: user.email},"shhhhhhhuuuuttt");
            res.cookie("token",token);
            if(req.body.role ==="member") res.redirect('/Member');
            else if(req.body.role === "admin") res.redirect('/Admin')
            else res.redirect('/Librarian')
        }
        else  res.send("Access Denied!")
    })
})

app.get('/Librarian',function(req,res){
    res.render("librarian")
})

app.get('/Member',function(req,res){
    res.render("member")
})

app.get('/Admin',function(req,res){
    res.render("admin")
})

app.get('/Login',function(req,res){
    res.render("login");
})


app.get('/logout',function(req,res){
    res.cookie("token","");
    res.redirect("/");
})


app.get('/read',async(req,res)=>{
    let allUsers = await userModel.find();
    res.render('read',{users: allUsers});
})

app.get('/deleteUser/:id',async(req,res)=>{
    let users = await userModel.findOneAndDelete({_id: req.params.id});
    res.redirect('/read');
})


app.listen(3000);
