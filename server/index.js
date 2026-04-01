const express=require("express");

const dotenv=require("dotenv");

const connectDB=require("./config/db");

const route=require("./router/router");

const cors = require("cors");

const app=express();

app.use(cors());



app.use(express.json());

app.use(express.urlencoded({ extended: false }));

app.use(express.static(__dirname));

dotenv.config();

connectDB();

app.use("/",route);


app.listen(process.env.PORT);
