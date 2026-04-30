const mongoose = require("mongoose");

// Stores the running state of the auto-import loop so it can be resumed
const importStateSchema = mongoose.Schema({
  _id:            { type: String, default: "singleton" },
  source:         { type: String, default: "rawg" },   // which API source
  platform:       { type: String, default: "both" },   // "PC" | "Mobile" | "both"
  lastPage:       { type: Number, default: 1 },
  lastGameIndex:  { type: Number, default: 0 },
  totalImported:  { type: Number, default: 0 },
  isRunning:      { type: Boolean, default: false },
  updatedAt:      { type: Date,    default: Date.now },
});

module.exports = mongoose.model("importstate", importStateSchema);
