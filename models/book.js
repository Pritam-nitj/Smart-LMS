const mongoose = require('mongoose')

const bookSchema = mongoose.Schema({
    image: String,
    title: String,
    author: String,
    ISBN: String
})

module.exports = mongoose.model('book',bookSchema);