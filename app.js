const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const session = require('express-session');
const app = express();
const axios = require('axios');
const multer = require('multer')
const upload = require('./config/multerconfig')
const QRCode = require('qrcode');
const cors = require("cors");
const {v4: uuidv4} = require('uuid');
const crypto = require('crypto');
const flash = require('connect-flash')

const userModel = require('./models/user');
const bookModel = require('./models/book');
const bookCopyModel = require('./models/bookCopy');
const isLoggedin = require("./middlewares/isLoggedin")
const dotenv = require('dotenv');
dotenv.config();

app.set('view engine', 'ejs');

app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(express.static(path.join(__dirname,'/public')));
app.use(cookieParser())

app.use(session({
    secret: 'shhhhhhhuuuuttt',
    resave: true,
    saveUninitialized: true,
    cookie: { secure: false} 
}));

app.use(flash())

app.use((req,res,next)=>{
    res.locals.success = req.flash('success'),
    res.locals.err = req.flash('err')
    next()
})

app.get('/',function(req,res){
    res.render("index");
})

app.get('/Signup',function(req,res){
    res.render("signup");
})

app.post('/signup',function(req,res){
    let {username,email,password,degree,branch} = req.body;
    bcrypt.genSalt(10,(err,salt)=>{
        bcrypt.hash(password,salt,async(err,hash)=>{
            let createdUser = await userModel.create({
                username,
                email,
                password: hash,
                Degree: degree,
                Branch: branch
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
        if (!user){
            req.flash('err','Email or Password Incorrect !')
            res.redirect('/login')
        }
        else{
            // Compare passwords
                bcrypt.compare(req.body.password, user.password, function (err, result) {
                    if (err) {
                        console.error("Error during password comparison:", err);
                        return res.status(500).send("Internal Server Error");
                    }

                    if (result) {
                        // Generate JWT token
                        let token = jwt.sign({ email: user.email }, "shhhhhhhuuuuttt");
                        res.cookie("token", token);
                        if (user.role === "librarian") {
                            res.redirect('/Librarian');
                        } else {
                            res.redirect('/Member');
                        }
                    } else {
                        req.flash('err','Access Denied !')
                        res.redirect('/login')
                    }
                });
        } 
        
    }catch (error) {
        console.error("Error during login:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Librarian Route
app.get('/Librarian',isLoggedin, async(req, res)=> {
    let memberCount = await userModel.countDocuments({ role: 'member' });
    let bookCount = await bookCopyModel.countDocuments();
    let bookIssued = await bookCopyModel.countDocuments({isIssued: 'true'})
    const dueBooks = await userModel.aggregate([
        {
            $unwind: "$IssuedBook" // Unwind the IssuedBook array
        },
        {
            $match: {
                "IssuedBook.RDate": { $lt: new Date() } // Filter books with return date less than today
            }
        },
        {
            $count: "totalDueBooks" // Count the documents
        }
    ]);
    res.render("librarian",{memberCount,bookCount,bookIssued,dueBooks});
});

// Member Route
app.get('/Member',isLoggedin, async function (req, res) {
    let user = req.user;
 
    if (!user) {
        req.flash('err','Access Denied !')
        res.redirect('/');
    }

    let keyword = user.Branch;
    let number = await bookModel.countDocuments();
    try {
        const response = await axios.post('http://localhost:5000/recommend', { keyword,number }); // Fixed the endpoint
        res.render ("member",{books: response.data,UserInfo: user}); // This will now contain the recommendations
    } catch (error) {
        console.error('Error fetching recommendations:', error);
        return []; // Return an empty array on error
    }
});

app.get('/Login',function(req,res){
    res.render("login");
})

app.get('/logout',function(req,res){
    res.cookie("token","");
    res.redirect("/");
})

app.get('/read',isLoggedin, async(req,res)=>{
    let allUsers = await userModel.find();
    res.render('read',{users: allUsers});
})

app.get('/readA',async(req,res)=>{
    let allUsers = await userModel.find();
    res.render('readAdmin',{users: allUsers});
})

app.get('/deleteUser/:id',isLoggedin,async(req,res)=>{
    let users = await userModel.findOneAndDelete({_id: req.params.id});
    res.redirect('/read');
})

app.get('/deleteUserA/:id',isLoggedin,async(req,res)=>{
    let users = await userModel.findOneAndDelete({_id: req.params.id});
    res.redirect('/readA');
})

app.get('/add',isLoggedin,function(req,res){
    res.render('addBook')
})

app.post('/addBook',isLoggedin,async function(req,res){
    let {image,title,author,ISBN,copies,rackno,desc} = req.body;

    if(!ISBN){
        req.flash('err',"ISBN can't be empty !")
        res.redirect('/add')
    }
    else{
        let createdBook = await bookModel.create({
            image,
            title,
            author,
            ISBN,
            copies,
            rackno,
            desc
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
        req.flash('success',"Book Added to library !")
        res.redirect('/add')
    }           
});

app.get('/showBook',isLoggedin,async function(req,res){
    let allbooks = await bookModel.find();
    res.render('showBook',{books: allbooks})
})

app.post('/issue',isLoggedin,async (req,res)=>{
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
            // req.session.user = user;
            req.session.save(function(err) {
                if (err) {
                    return res.status(500).send('Error saving session');
                }
                req.flash('success','Book Issued !')
                res.redirect('/Librarian');
            });
        }
        else{
            req.flash('err','Book Already Issued');
            res.redirect('/Librarian');
        }
    }
    else{
        req.flash('err','BookId Or UserId Not Correct');
        res.redirect('/Librarian');
    }   
})

app.post('/return',isLoggedin,async (req,res)=>{
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
                let IDate, RDate , ARDate;
                let fine;
                for (let i = 0; i < user.IssuedBook.length; i++) {
                    if(user.IssuedBook[i].Ibook.equals(book._id)){
                        IDate = user.IssuedBook[i].IDate;
                        RDate = user.IssuedBook[i].RDate;
                        ARDate = new Date();
                        user.IssuedBook.splice(i, 1);
                        user.NoOfBook = user.NoOfBook - 1 ;
                        book.bookDetails.copies = book.bookDetails.copies + 1;
                        book.isIssued = false;
                        if(RDate < ARDate){
                            fine = Math.ceil((ARDate- RDate) / (1000 * 60 * 60 * 24));
                            user.Fine += fine*2;
                        } 
                        await book.save();
                        await user.save(); 
                        await book.bookDetails.save();
                        break;
                    }
                }
                req.flash('success','Book returned successfully !')
                res.redirect('/Librarian');
            }
            else{
                req.flash('err','Book Id not correct');
                res.redirect('/Librarian');
            }
        }
        else{
            req.flash('err','Book Is Not Issued to any User!');
            res.redirect('/Librarian');
        }
    }
    else{
        req.flash('err','Book Id not correct');
        res.redirect('/Librarian');
    }
})

app.get('/BQR',isLoggedin,(req,res)=>{
    res.render('bookqrScanner')
})

app.post('/BQR',isLoggedin,async(req,res)=>{
    let Uemail = req.session.EQR;
    let {bookIdd} = req.body;
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
                return res.status(200).json({success: true, message:"Book Issued !"});
            });
        }
        else{
            return res.status(200).json({success: false, message:"Book Already Issued !"});
        }
    }
    else{
        return res.status(200).json({success: false, message:"Incorrect Book Id !"});

    }   
})

app.get('/EQR',isLoggedin,(req,res)=>{
    res.render('qrScanner')
})

app.post('/EQR',isLoggedin,async (req,res)=>{
    const {qrData} = req.body;
    let user = await userModel.findOne({email: qrData});
    if(user){
        req.session.EQR = qrData;
        return res.status(200).json({success: true})
    }
    else{
        return res.status(200).json({success: false})
    }
    res.redirect('/BQR')
})

app.get('/RQR',isLoggedin,(req,res)=>{
    res.render('returnScanner');
})

app.post('/RQR',isLoggedin,async (req,res)=>{
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
                let IDate, RDate , ARDate;
                let fine;
                for (let i = 0; i < user.IssuedBook.length; i++) {
                    if(user.IssuedBook[i].Ibook.equals(book._id)){
                        IDate = user.IssuedBook[i].IDate;
                        RDate = user.IssuedBook[i].RDate;
                        ARDate = new Date();
                        user.IssuedBook.splice(i, 1);
                        user.NoOfBook = user.NoOfBook - 1 ;
                        book.bookDetails.copies = book.bookDetails.copies + 1;
                        book.isIssued = false;
                        if(RDate < ARDate){
                            fine = Math.ceil((ARDate- RDate) / (1000 * 60 * 60 * 24));
                            user.Fine += fine*2;
                        } 
                        await book.save();
                        await user.save(); 
                        await book.bookDetails.save();
                        break;
                    }
                }
                return res.status(200).json({success: true, message:"Book returned successfully !"});

            }
            else{
                return res.status(200).json({success: false, message:"Incorrect Book Id !"});
            }
        }
        else{
            return res.status(200).json({success: false, message:"Book Is Not Issued To Any User !"});
        }
    }
    else{
        return res.status(200).json({success: false, message:"Incorrect Book Id !"});
    }
})

app.get("/report",isLoggedin,async (req,res)=>{
    let IssuedUser = await userModel.find({NoOfBook:{$gt: 0}}).populate({
        path: "IssuedBook.Ibook",
        populate: {
            path: "bookDetails"
        }
    })
    res.render('showReport',{Users: IssuedUser});
})

app.post("/searchBook",isLoggedin,async (req,res)=>{
    let keyword = req.body.key;
    let number = 5;
    try {
        const response = await axios.post('http://localhost:5000/recommend', { keyword,number });
        res.render ("recommend",{books: response.data}); 
    } catch (error) {
        console.error('Error fetching recommendations:', error);
        return []; 
    }
})

app.get('/profile',isLoggedin,async(req,res)=>{
    let user = req.user;
    let email = user.email;
    const qrCodeData = await QRCode.toDataURL(email);
    user = await userModel.findOne({email: email}).populate({
        path: "IssuedBook.Ibook",
        populate: {
            path: "bookDetails",
        }
    });
    if (!user) {
        return res.status(403).send("Access Denied. Please login.");
    }
    res.render("profile", { UserInfo: user, QR: qrCodeData });
})

app.get('/editProfile',isLoggedin,(req,res)=>{
    res.render('editProfile');
})

app.post("/upload",isLoggedin,upload.single("image"),async (req,res)=>{
    let user = await userModel.findOne({email: req.user.email})
    user.profilepic = req.file.filename;
    await user.save();
    res.redirect("profile");
})

app.post("/editProfile",isLoggedin,async(req,res)=>{
    let user = await userModel.findOne({email: req.user.email})
    user.Degree = req.body.degree;
    user.Branch = req.body.branch;
    await user.save();
    res.redirect("profile");
})

app.get("/about",(req,res)=>{
    res.render('about');
})

app.get("/terms",(req,res)=>{
    res.render('terms');
})

const MERCHANT_KEY = process.env.MERCHANT_KEY  // salt key
const MERCHANT_ID = process.env.MERCHANT_ID

const MERCHANT_BASE_URL = process.env.MERCHANT_BASE_URL
const MERCHANT_STATUS_URL = process.env.MERCHANT_STATUS_URL

const redirectUrl = "http://localhost:3000/status"

// const successUrl = "http://localhost:3000/payment-success"
// const failureUrl = "http://localhost:3000/payment-failure"

app.post("/create-order",isLoggedin, async(req,res)=>{
    const orderId = uuidv4()
    let user = req.user;
    let email = user.email;
    let fine = user.Fine*100;

    const paymentPayload = {
        merchantId: MERCHANT_ID,
        merchantUserId: email,
        amount: fine,
        merchantTransactionId: orderId,
        redirectUrl: `${redirectUrl}/?id=${orderId}`,
        redirectMode: "POST",
        paymentInstrument: {
            type: 'PAY_PAGE'
        }
    }
    
    const payload = Buffer.from(JSON.stringify(paymentPayload)).toString('base64')
    const keyIndex = 1
    const string = payload + '/pg/v1/pay' + MERCHANT_KEY
    const sha256 = crypto.createHash('sha256').update(string).digest('hex')
    const checksum = sha256 + '###' + keyIndex

    const option = {
        method: 'POST',
        url: MERCHANT_BASE_URL,
        headers: {
            accept: 'application/json',
            'Content-Type': 'application/json',
            'X-VERIFY': checksum
        },
        data: {
            request: payload
        }
    }
    try{
        const response = await axios.request(option);
        res.status(200).json({msg: "Success", url:response.data.data.instrumentResponse.redirectInfo.url})

    } catch(error){
        console.log("error in payment",error);
        res.status(500).json({error: 'Failed to initiate payment'})
    }
})

app.post('/status',isLoggedin,async(req,res)=>{
    const merchantTransactionId = req.query.id;
    const keyIndex = 1
    const string =`/pg/v1/status/${MERCHANT_ID}/${merchantTransactionId}` + MERCHANT_KEY
    const sha256 = crypto.createHash('sha256').update(string).digest('hex')
    const checksum = sha256 + '###' + keyIndex

    const option = {
        method: 'GET',
        url: `${MERCHANT_STATUS_URL}/${MERCHANT_ID}/${merchantTransactionId}`,
        headers: {
            accept: 'application/json',
            'Content-Type': 'application/json',
            'X-VERIFY': checksum,
            'X-MERCHANT-ID': MERCHANT_ID
        },
    }
    axios.request(option).then(async (response)=>{
        if(response.data.success){
            let user = req.user;
            user.Fine -= ((Number(JSON.parse(response.data.data.amount)))/100)
            await user.save();
            res.redirect('/profile');
        }else{
            return res.send("Payment Failed")
        }
    })
})

app.listen(3000)