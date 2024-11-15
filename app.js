const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const session = require('express-session');
const app = express();

const userModel = require('./models/user');
const bookModel = require('./models/book');
const bookCopyModel = require('./models/bookCopy');


app.set('view engine', 'ejs');

app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(express.static(path.join(__dirname,'/public')));
app.use(session({
    secret: '',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } 
  }));

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
            let token = jwt.sign({email},"");
            res.cookie("token",token);
            res.redirect("/login")
        });
    })
})

// Login Route
app.post("/login", async function (req, res, next) {
    try {
        let user = await userModel.findOne({ email: req.body.email }).populate({
            path: "IssuedBook.Ibook",
            populate: {
                path: "bookDetails"
            }
        });

        // Check if user exists
        if (!user) return res.send("Email or Password Incorrect!");

        // Compare passwords
        bcrypt.compare(req.body.password, user.password, function (err, result) {
            if (err) {
                console.error("Error during password comparison:", err);
                return res.status(500).send("Internal Server Error");
            }

            if (result) {
                // Generate JWT token
                let token = jwt.sign({ email: user.email }, "");
                res.cookie("token", token);

                // Check user role and set session
                req.session.user = user;
                req.session.save(function (err) {
                    if (err) return next(err);

                    if (user.role === "librarian") {
                        res.redirect('/Librarian');
                    } else if (user.role === "admin") {
                        res.render("admin");
                    } else {
                        res.redirect('/Member');
                    }
                });
            } else {
                res.send("Access Denied!");
            }
        });
    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Librarian Route
app.get('/Librarian', function (req, res) {
    let user = req.session.user;
    if (!user) {
        return res.status(403).send("Access Denied. Please login.");
    }
    res.render("librarian", { LibInfo: user });
});

// Member Route
app.get('/Member', function (req, res) {
    let user = req.session.user;
    if (!user) {
        return res.status(403).send("Access Denied. Please login.");
    }
    res.render("member", { UserInfo: user });
});

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
    res.redirect('/showBook')         
});

app.get('/showBook',async function(req,res){
    let allbooks = await bookModel.find();
    res.render('showBook',{books: allbooks})
})

app.post('/issue',async (req,res)=>{
    let {Uemail,bookIdd} = req.body;
    let user = await userModel.findOne({email: Uemail}).populate({
        path: "IssuedBook.Ibook",
        populate: {
            path: "bookDetails"
        }
    });
    let book = await bookCopyModel.findOne({LbookId: bookIdd}).populate("bookDetails")
    if(book && user){
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
            req.session.user = user;
            req.session.save(function(err) {
                if (err) {
                    return res.status(500).send('Error saving session');
                }
                res.redirect('/Librarian');
            });
        }
        else{
            return res.send("Book Already Issued");
        }
    }
    else{
        return res.send("BookId Or UserId Not Correct");
    }   
})

app.post('/return',async (req,res)=>{
    const {bookID} = req.body;
    let book = await bookCopyModel.findOne({LbookId: bookID}).populate("bookDetails")
    if(book){
        if(book.isIssued){
            let user = await userModel.findOne({IssuedBook: {$elemMatch:{Ibook: book._id}}}).populate({
                path: "IssuedBook.Ibook",
                populate: {
                    path: "bookDetails"
                }
            });
            if(user){
                for (let i = 0; i < user.IssuedBook.length; i++) {
                    if(user.IssuedBook[i].Ibook.equals(book._id)){
                        user.IssuedBook.splice(i, 1);
                        user.NoOfBook = user.NoOfBook - 1 ;
                        book.bookDetails.copies = book.bookDetails.copies + 1;
                        book.isIssued = false;
                        await book.save();
                        await user.save(); 
                        await book.bookDetails.save();
                        break;
                    }
                }
                req.session.user = user;
                req.session.save(function(err) {
                    if (err) {
                        return res.status(500).send('Error saving session');
                    }
                    res.redirect('/Librarian');
                });
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

app.get("/report",async (req,res)=>{
    let IssuedUser = await userModel.find({NoOfBook:{$gt: 0}}).populate({
        path: "IssuedBook.Ibook",
        populate: {
            path: "bookDetails"
        }
    })
    res.render('showReport',{Users: IssuedUser});
})

app.listen(3000);
