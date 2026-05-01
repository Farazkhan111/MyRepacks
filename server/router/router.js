const express              = require("express");
const gameController       = require("../controller/Gamecontroller");
const scraperController    = require("../controller/ScraperController");
const importController     = require("../controller/ImportController");
const autoUpdateController = require("../controller/AutoUpdateController");
const fitgirlCtrl = require("../controller/fitgirlImport");

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

// ── Auto Update Engine ────────────────────────────────────────────
Router.post("/autoupdate/start",   autoUpdateController.StartAutoUpdate);
Router.post("/autoupdate/stop",    autoUpdateController.StopAutoUpdate);
Router.get("/autoupdate/status",   autoUpdateController.AutoUpdateStatus);
Router.post("/autoupdate/preview", autoUpdateController.AutoUpdatePreview);

Router.post("/import/fitgirl/start",  fitgirlCtrl.StartFitgirlImport);
Router.post("/import/fitgirl/stop",   fitgirlCtrl.StopFitgirlImport);
Router.get ("/import/fitgirl/status", fitgirlCtrl.FitgirlImportStatus);
Router.post("/import/fitgirl/reset",  fitgirlCtrl.ResetFitgirlImport);

module.exports = Router;
