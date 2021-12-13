const mongoose = require('mongoose')

const UserSchema = mongoose.Schema({
    name:String,
    username: String,
    password: String,
    wins: Number

})

module.exports = mongoose.model('Users',UserSchema)