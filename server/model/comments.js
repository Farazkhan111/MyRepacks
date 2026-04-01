const { text } = require("express")
const mongoose=require("mongoose")

const Comments=mongoose.Schema({
    gameid:String,
    uname:String,
    ncom:String,
    postdate:{type:Date, default:Date.now}
});

module.exports=mongoose.model("Comments",Comments);