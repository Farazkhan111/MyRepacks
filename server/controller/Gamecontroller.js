const mongoose = require("mongoose");
const admin    = require("../model/adminmodel");
const games    = require("../model/allgamesmodel");
const comments = require("../model/comments");

exports.Login = async (req, res) => {
  try {
    const admin1 = await admin.findOne({ username: req.body.username });
    if (admin1) {
      if (admin1.password === req.body.password) {
        res.send(admin1);
      } else {
        res.send("PassNot");
      }
    } else {
      res.send("UserNot");
    }
  } catch (err) {
    console.log(err);
  }
};

exports.AddGame = async (req, res) => {
  try {
    const newgame = await games({
      name:        req.body.gname,
      image:       req.body.gimage,
      othername:   req.body.othername,
      description: req.body.gdes,
      category:    req.body.gcat,
      platform:    req.body.gplatform || "PC",
      trending:    req.body.gtrend,
      link:        req.body.glink,
      fimage:      req.body.gfimage,
      video:       req.body.gvideo,
    });
    newgame.save();
    res.send(newgame);
  } catch (err) {
    console.log(err);
  }
};

exports.Showgames = async (req, res) => {
  const result = await games.find();
  res.send(result);
};

exports.Tupdate = async (req, res) => {
  try {
    await games.updateOne({ _id: req.body.i }, { $set: { trending: req.body.trending } });
    res.send("Update");
  } catch (err) {
    console.log(err);
  }
};

exports.Edit = async (req, res) => {
  try {
    const game = await games.findOne({ _id: req.body.id });
    res.send(game);
  } catch (err) {
    console.log(err);
  }
};

exports.Gupdate = async (req, res) => {
  try {
    await games.updateOne(
      { _id: req.body.id },
      {
        $set: {
          name:        req.body.gname,
          image:       req.body.gimage,
          othername:   req.body.othername,
          description: req.body.gdes,
          category:    req.body.gcat,
          platform:    req.body.gplatform || "PC",
          trending:    req.body.gtrend,
          link:        req.body.glink,
          fimage:      req.body.gfimage,
          video:       req.body.gvideo,
        },
      }
    );
    res.send("Update");
  } catch (err) {
    console.log(err);
  }
};

exports.Del = async (req, res) => {
  try {
    await games.deleteOne({ _id: req.body.id });
    res.send("Deleted");
  } catch (err) {
    console.log(err);
  }
};

// ── NEW: Bulk Delete ──────────────────────────────────────────────
exports.BulkDelete = async (req, res) => {
  try {
    const { ids } = req.body;  // array of _id strings
    if (!Array.isArray(ids) || ids.length === 0)
      return res.status(400).json({ success: false, error: "ids array required" });

    const result = await games.deleteMany({ _id: { $in: ids } });
    res.json({ success: true, deleted: result.deletedCount });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.Showtrend = async (req, res) => {
  const result = await games.find();
  res.send(result);
};

exports.Collection = async (req, res) => {
  const result = await games.find();
  res.send(result);
};

exports.Search = async (req, res) => {
  const result = await games.find();
  res.send(result);
};

exports.Gamepage = async (req, res) => {
  const game = await games.findOne({ _id: req.body.idd });
  res.send(game);
};

exports.Allcomments = async (req, res) => {
  try {
    const allComments = await comments.find({ gameid: req.body.idd });
    res.json(allComments && allComments.length > 0 ? allComments : []);
  } catch (error) {
    console.error(error);
    res.status(500).json([]);
  }
};

exports.Newcomments = async (req, res) => {
  try {
    const comment = new comments({
      gameid:   req.body.idd,
      uname:    req.body.name,
      ncom:     req.body.text,
      postdate: new Date(),
    });
    await comment.save();
    res.send("done");
  } catch (err) {
    console.log(err);
    res.status(400).send(err.message);
  }
};

exports.Cdel = async (req, res) => {
  await comments.deleteOne({ _id: req.body.id });
  res.send("Done del");
};
