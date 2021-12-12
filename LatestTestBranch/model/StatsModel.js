const mongoose = require('mongoose')

const StatsSchema = mongoose.Schema({
    win:String,
    
})

module.exports = mongoose.model('Stats',StatsSchema)