const mongoose=require("mongoose");

const allgameSchema=mongoose.Schema({
    name:String,
    image:String,
    description:String,
    category:String,
    trending:String,
    link:String,
    fimage:String,
    video:String,
    othername:[String]
})

module.exports=mongoose.model("allgames",allgameSchema);