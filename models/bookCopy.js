const mongoose = require('mongoose')

const bookcopySchema = mongoose.Schema({
    LbookId : {
        type: String,
        required : true,
        unique: true
    },
    isIssued: {
        type: Boolean,
        default: false
    },
    bookDetails: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'book',
        required: true
    }
})

module.exports = mongoose.model('bookCopy',bookcopySchema)