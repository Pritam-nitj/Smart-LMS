const express = require('express');
const app = express();
const path = require('path');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const userModel = require('./models/user');
const bookModel = require('./models/book');
const bookCopyModel = require('./models/bookCopy');


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
            res.redirect("/login")
        });
    })
})

app.post("/login",async function(req,res){
    let user = await userModel.findOne({email: req.body.email}).populate({
        path: "IssuedBook.Ibook",
        populate: {
            path: "bookDetails"
        }
    })
    if(!user) return res.send("Email Or Password Incorrect!")

    if(req.body.role != user.role) return res.send("Email or Password Incorrect!")
    
    bcrypt.compare(req.body.password,user.password,function(err,result){
        if(result){
            let token = jwt.sign({email: user.email},"shhhhhhhuuuuttt");
            res.cookie("token",token);
            if(req.body.role === "librarian"){
                res.render("librarian")
            } 
            else if(req.body.role === "admin"){
                res.render("admin")
            } 
            else{
                res.render("member",{UserInfo: user});
            } 
        }
        else{
            res.send("Access Denied!")
        }    
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
app.get('/readA',async(req,res)=>{
    let allUsers = await userModel.find();
    res.render('readAdmin',{users: allUsers});
})

app.get('/deleteUser/:id',async(req,res)=>{
    let users = await userModel.findOneAndDelete({_id: req.params.id});
    res.redirect('/read');
})

app.get('/deleteUserA/:id',async(req,res)=>{
    let users = await userModel.findOneAndDelete({_id: req.params.id});
    res.redirect('/readA');
})

app.get('/add',function(req,res){
    res.render('addBook')
})

app.post('/addBook',async function(req,res){
let {image,title,author,ISBN,copies} = req.body;
    let createdBook = await bookModel.create({
        image,
        title,
        author,
        ISBN,
        copies
    });
    const savedBook = await createdBook.save();
    let bookCopies = []
    for(let i = 1;i<=copies;i++){
        let LbookId = `${ISBN}-C${i}`
        let bookCopy = await bookCopyModel.create({
            LbookId: LbookId,
            bookDetails: savedBook._id,
            isIssued: false
        })
    }
    res.redirect('/add')         
});

app.get('/showBook',async function(req,res){
    let allbooks = await bookModel.find();
    res.render('showBook',{books: allbooks})
})

app.post('/issue',async (req,res)=>{
    let {Uemail,bookIdd} = req.body;
    let user = await userModel.findOne({email: Uemail});
    let book = await bookCopyModel.findOne({LbookId: bookIdd}).populate("bookDetails")
    if(book){
        if(!book.isIssued && book.bookDetails.copies>0){
            let issueDate = new Date();
            let returnDate = new Date();
            returnDate.setDate(returnDate.getDate()+14);

            user.IssuedBook.push({
                Ibook: book._id,
                IDate: issueDate,
                RDate: returnDate
            });
            user.NoOfBook = user.NoOfBook + 1;
            book.bookDetails.copies = book.bookDetails.copies - 1;
            book.isIssued = true;
            await book.bookDetails.save();
            await book.save();
            await user.save();
            return res.redirect("/Librarian");
        }
        else{
            return res.send("Book Already Issued");
        }
    }
    else{
        return res.send("BookId Not Correct");
    }   
})

app.post('/return',async (req,res)=>{
    const {bookID} = req.body;
    let book = await bookCopyModel.findOne({LbookId: bookID}).populate("bookDetails")
    if(book){
        if(book.isIssued){
            let user = await userModel.findOne({IssuedBook: {$elemMatch:{Ibook: book._id}}});
            if(user){
                for (let i = 0; i < user.IssuedBook.length; i++) {
                    if (user.IssuedBook[i].Ibook.equals(book._id)){
                        user.IssuedBook.splice(i, 1);
                        user.NoOfBook = user.NoOfBook - 1 ;
                        book.bookDetails.copies = book.bookDetails.copies + 1;
                        await user.save(); 
                        await book.bookDetails.save();
                        break;
                    }
                }
                return res.redirect("/Librarian");
            }
            else{
                return res.send("BookId Not Correct");
            }
        }
        else{
            return res.send("Book Is Not Issued!");
        }
    }
    else{
        return res.send("BookId Not Correct");
    }
})

app.listen(3000);
