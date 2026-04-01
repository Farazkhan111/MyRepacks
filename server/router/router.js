const express=require("express");
// const Controller=require("../controller/usercontroller");
const gameController=require("../controller/Gamecontroller")
const Router=express.Router();

Router.post("/login",gameController.Login);
Router.post("/add",gameController.AddGame);
Router.get('/show',gameController.Showgames);
Router.post('/tupdate',gameController.Tupdate);
Router.post('/edit',gameController.Edit);
Router.post('/gupdate',gameController.Gupdate);
Router.post('/del',gameController.Del);
Router.post('/showtrend',gameController.Showtrend);
Router.get('/collection',gameController.Collection);
Router.post('/search',gameController.Search);
Router.post("/gamepage",gameController.Gamepage);
Router.post("/newcomments",gameController.Newcomments);
Router.post("/comments",gameController.Allcomments);
Router.post("/cdel",gameController.Cdel);

module.exports=Router;