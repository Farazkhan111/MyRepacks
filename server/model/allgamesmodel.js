const mongoose = require("mongoose");

const allgameSchema = mongoose.Schema({
  name:           String,
  image:          String, // icon image
  description:    String,
  category:       String,
  platform:       { type: String, enum: ["PC", "Mobile"], default: "PC" },
  trending:       String,
  link:           String,
  fimage:         String, // cover image
  video:          String,
  othername:      [String],

  // ── NEW IMPORT FIELDS ──────────────────────────────────────────
  genre:          String,
  developer:      String,
  publisher:      String,
  releaseDate:    String,
  rating:         Number,
  platforms:      [String],

  trailer: {
    url:    String,
    embed:  String,
  },

  images: [
    {
      type:   { type: String },   // "cover" | "background" | "screenshot"
      url:    String,
      source: String,
    }
  ],

  importSource:   String,   // "rawg" | "igdb" | "manual" | "playstore" | "playstore_paid"
  externalId:     String,   // ID from source API (for duplicate detection)
  lastImportedAt: Date,

  // ── Paid game fields ────────────────────────────────────────────
  isPaid:         { type: Boolean, default: false },
  price:          String,   // e.g. "$4.99"

}, { timestamps: true }); // auto-adds createdAt + updatedAt

module.exports = mongoose.model("allgames", allgameSchema);