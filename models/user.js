const mongoose = require('mongoose');

mongoose.connect(`mongodb://127.0.0.1:27017/LMS`)

const userSchema = mongoose.Schema({
    role: String,
    username: String,
    fathersName: String,
    email: String,
    password: String
})

module.exports = mongoose.model("user",userSchema);