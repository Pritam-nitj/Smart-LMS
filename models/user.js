const mongoose = require('mongoose');

mongoose.connect(`mongodb://127.0.0.1:27017/LMS`)

const userSchema = mongoose.Schema({
    role: String,
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
                ref: "book"
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
    picture: String
})

module.exports = mongoose.model("user",userSchema);