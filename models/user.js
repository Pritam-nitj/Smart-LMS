const mongoose = require('mongoose');

mongoose.connect(`mongodb://127.0.0.1:27017/LMS`)

const userSchema = mongoose.Schema({
    role: {
        type: String,
        default: "member"
    },
    username: String,
    fathersName: String,
    email: String,
    password: String,
    NoOfBook: {
        type: Number,
        default: 0
    },
    IssuedBook: [
        {
            Ibook: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "bookCopy"
            },
            IDate: {
                type: Date
            },
            RDate: {
                type: Date
            },
        },
    ],
    contact: Number,
    profilepic: {
        type: String,
        default: ''
    },
    Fine: {
        type: Number,
        default: 0
    },
    Degree: String,
    Branch : String,
    JoinDate: {
        type: Date,
        default : new Date()
    }
})

module.exports = mongoose.model("user",userSchema);