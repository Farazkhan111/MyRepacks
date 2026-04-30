const express           = require("express");
const gameController    = require("../controller/Gamecontroller");
const scraperController = require("../controller/ScraperController");
const importController  = require("../controller/ImportController");

const Router = express.Router();

// ── Game CRUD ─────────────────────────────────────────────────────
Router.post("/login",       gameController.Login);
Router.post("/add",         gameController.AddGame);
Router.get("/show",         gameController.Showgames);
Router.post("/tupdate",     gameController.Tupdate);
Router.post("/edit",        gameController.Edit);
Router.post("/gupdate",     gameController.Gupdate);
Router.post("/del",         gameController.Del);
Router.post("/showtrend",   gameController.Showtrend);
Router.get("/collection",   gameController.Collection);
Router.post("/search",      gameController.Search);
Router.post("/gamepage",    gameController.Gamepage);
Router.post("/newcomments", gameController.Newcomments);
Router.post("/comments",    gameController.Allcomments);
Router.post("/cdel",        gameController.Cdel);

// ── NEW: Bulk Delete ──────────────────────────────────────────────
Router.post("/bulk-delete", gameController.BulkDelete);

// ── Scraper ───────────────────────────────────────────────────────
Router.post("/scrape",        scraperController.ScrapeGame);
Router.post("/imagesuggest",  scraperController.ImageSuggest);
Router.post("/descsearch",    scraperController.DescSearch);
Router.post("/trailersearch", scraperController.TrailerSearch);

// ── Import Engine ─────────────────────────────────────────────────
Router.post("/import/start",  importController.StartImport);
Router.post("/import/stop",   importController.StopImport);
Router.get("/import/status",  importController.ImportStatus);
Router.post("/import/reset",  importController.ResetImport);

module.exports = Router;
