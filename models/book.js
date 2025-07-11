const mongoose = require('mongoose')

const bookSchema = mongoose.Schema({
    image: String,
    title: {
        type : String,
        required : true
    },
    author: {
        type: String,
        required: true
    },
    ISBN: {
        type : String,
        required: true,
        unique: true
    },
    copies: Number ,
    rackno: String,
    desc : String
})

module.exports = mongoose.model('book',bookSchema);

