const mongoose=require("mongoose");

const connectDB= ( async()=>{

    try{
        await mongoose.connect(process.env.Mongoose_URL)
        .then((result)=>{
            console.log("Mongoose Connected")
        })
    }
    catch{
        console.log("Not Connected")
    }

})

module.exports=connectDB;