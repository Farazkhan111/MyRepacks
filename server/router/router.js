const express = require("express");
const gameController = require("../controller/Gamecontroller");
const scraperController = require("../controller/ScraperController");
const Router = express.Router();

// ── Existing routes ──────────────────────────────────────────────
Router.post("/login", gameController.Login);
Router.post("/add", gameController.AddGame);
Router.get('/show', gameController.Showgames);
Router.post('/tupdate', gameController.Tupdate);
Router.post('/edit', gameController.Edit);
Router.post('/gupdate', gameController.Gupdate);
Router.post('/del', gameController.Del);
Router.post('/showtrend', gameController.Showtrend);
Router.get('/collection', gameController.Collection);
Router.post('/search', gameController.Search);
Router.post("/gamepage", gameController.Gamepage);
Router.post("/newcomments", gameController.Newcomments);
Router.post("/comments", gameController.Allcomments);
Router.post("/cdel", gameController.Cdel);

// ── New scraper routes ───────────────────────────────────────────
Router.post("/scrape", scraperController.ScrapeGame);
Router.post("/imagesuggest", scraperController.ImageSuggest);

module.exports = Router;
