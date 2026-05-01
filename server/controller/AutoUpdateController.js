require("dotenv").config();

const axios  = require("axios");
const games  = require("../model/allgamesmodel");
const {
  getFitgirlLink,
  getApkPureLink,
  fetchYouTubeTrailer,
  fetchIGDBImages,
  fetchRAWGData,
  fetchBannerCoverArt,   // ← replaces direct IGDB/RAWG image calls
  buildSearchVariants,
} = require("./helpers");

// ── In-memory state ───────────────────────────────────────────────
let running       = false;
let stopReq       = false;
let currentGame   = { name: "", platform: "", step: "" };

const LOG_MAX = 80;
const liveLog = [];

function pushLog(type, msg) {
  liveLog.push({ ts: new Date().toISOString(), type, msg });
  if (liveLog.length > LOG_MAX) liveLog.shift();
  const icon = type === "error" ? "❌" : type === "warn" ? "⚠️ " : type === "success" ? "✅" : "ℹ️ ";
  console.log(`[AutoUpdate] ${icon} ${msg}`);
}

// ── Stats counters ────────────────────────────────────────────────
let stats = { total: 0, done: 0, linksFixed: 0, imagesFixed: 0, descFixed: 0, errors: 0, deleted: 0 };

// ── What counts as "missing" ──────────────────────────────────────
function needsLink(g)        { return !g.link || g.link.trim().length < 5; }
function needsImage(g)       { return !g.image || g.image.trim().length < 5; }
function needsDescription(g) { return !g.description || g.description.trim().length < 20; }
function needsTrailer(g)     { return !g.trailer?.url && (!g.video || g.video.trim().length < 5); }

// ── Build MongoDB query based on selected fix targets ─────────────
function buildQuery(targets, platform) {
  const or = [];
  if (targets.includes("link"))        or.push({ link:        { $in: [null, ""] } }, { link:        { $exists: false } });
  if (targets.includes("image"))       or.push({ image:       { $in: [null, ""] } }, { image:       { $exists: false } });
  if (targets.includes("description")) or.push({ description: { $in: [null, ""] } }, { $expr: { $lt: [{ $strLenCP: { $ifNull: ["$description", ""] } }, 20] } });
  if (targets.includes("trailer"))     or.push({ "trailer.url": { $in: [null, ""] } }, { "trailer.url": { $exists: false } });

  const q = or.length ? { $or: or } : {};
  if (platform !== "both") q.platform = platform;
  return q;
}

// ── Delete games with no download link ────────────────────────────
async function deleteGamesWithNoLink(platform) {
  const query = { $or: [{ link: { $in: [null, ""] } }, { link: { $exists: false } }] };
  if (platform !== "both") query.platform = platform;

  const toDelete = await games.find(query).select("_id name platform").lean();
  if (!toDelete.length) {
    pushLog("info", "🗑 Delete pass: no games without links found.");
    return 0;
  }

  const ids = toDelete.map(g => g._id);
  await games.deleteMany({ _id: { $in: ids } });

  toDelete.forEach(g =>
    pushLog("warn", `🗑 Deleted [${g.platform}] "${g.name}" — no download link found`)
  );
  pushLog("success", `🗑 Deleted ${toDelete.length} game(s) with no download link.`);
  return toDelete.length;
}

// ── Main auto-update loop ─────────────────────────────────────────
async function runAutoUpdate({ targets, platform, batchSize, deleteNoLink }) {
  if (running) return;
  running  = true;
  stopReq  = false;
  liveLog.length = 0;

  const query    = buildQuery(targets, platform);
  const allGames = await games.find(query).select("_id name platform image fimage description link video trailer images").lean();

  stats = { total: allGames.length, done: 0, linksFixed: 0, imagesFixed: 0, descFixed: 0, errors: 0 };
  pushLog("info", `🔍 Found ${allGames.length} games needing updates [targets: ${targets.join(", ")} | platform: ${platform}]`);

  if (!allGames.length) {
    pushLog("success", "Nothing to update — all games are complete!");
    running = false;
    return;
  }

  for (const game of allGames) {
    if (stopReq) break;

    currentGame = { name: game.name, platform: game.platform, step: "starting" };
    const update = {};
    const newImages = [];

    // ── 1. Download / Torrent Link ──────────────────────────────
    if (targets.includes("link") && needsLink(game)) {
      currentGame.step = game.platform === "Mobile" ? "searching APKPure…" : "searching FitGirl…";
      const nameVariants = buildSearchVariants(game.name);
      pushLog("info", `[${game.platform}] "${game.name}" — fetching link… (${nameVariants.length} variant${nameVariants.length > 1 ? "s" : ""} to try)`);
      try {
        const link = game.platform === "Mobile"
          ? await getApkPureLink(game.name)
          : await getFitgirlLink(game.name);
        if (link) {
          update.link = link;
          stats.linksFixed++;
          pushLog("success", `[${game.platform}] "${game.name}" — link ✅ ${link.slice(0, 60)}…`);
        } else {
          pushLog("warn", `[${game.platform}] "${game.name}" — link not found`);
        }
      } catch (e) {
        pushLog("error", `[${game.platform}] "${game.name}" — link error: ${e.message}`);
        stats.errors++;
      }
    }

    if (stopReq) break;

    // ── 2. Images (Banner/Key-art with game name in image) ───────
    if (targets.includes("image") && (needsImage(game) || !game.fimage)) {
      currentGame.step = "fetching banner art…";
      pushLog("info", `[${game.platform}] "${game.name}" — fetching banner cover art…`);
      try {
        // fetchBannerCoverArt tries: SteamGridDB → Steam → IGDB → RAWG
        // All sources prioritise images that contain the game name/logo
        const artData = await fetchBannerCoverArt(game.name, game.platform);

        if (artData?.coverImage) {
          if (!game.image)  update.image  = artData.coverImage;
          if (!game.fimage) update.fimage = artData.heroImage || artData.coverImage;

          // Add screenshots to images array
          (artData.screenshots || []).forEach(url =>
            newImages.push({ type: "screenshot", url, source: artData.source })
          );

          if (!game.image) stats.imagesFixed++;

          const matchInfo = artData.matchedName && artData.matchedName !== game.name
            ? ` → matched "${artData.matchedName}"`
            : "";
          pushLog("success",
            `[${game.platform}] "${game.name}" — banner art ✅ (${artData.source}${matchInfo}) | has game name in image`
          );
        } else {
          // Final fallback: try IGDB/RAWG directly for at least some image
          pushLog("warn", `[${game.platform}] "${game.name}" — no banner art found, trying fallback…`);
          try {
            let fallbackData = null;
            if (game.platform === "Mobile") {
              fallbackData = await fetchIGDBImages(game.name);
              if (fallbackData?.cover) {
                if (!game.image)  update.image  = fallbackData.cover;
                if (!game.fimage) update.fimage = fallbackData.screenshots[0] || fallbackData.cover;
                fallbackData.screenshots.forEach(url => newImages.push({ type: "screenshot", url, source: "igdb" }));
                if (!game.image) stats.imagesFixed++;
                pushLog("info", `[${game.platform}] "${game.name}" — fallback image ✅ (IGDB)`);
              }
            } else {
              fallbackData = await fetchRAWGData(game.name);
              if (fallbackData?.cover) {
                if (!game.image)  update.image  = fallbackData.cover;
                if (!game.fimage) update.fimage = fallbackData.background || fallbackData.cover;
                fallbackData.screenshots.forEach(url => newImages.push({ type: "screenshot", url, source: "rawg" }));
                if (!game.image) stats.imagesFixed++;
                pushLog("info", `[${game.platform}] "${game.name}" — fallback image ✅ (RAWG)`);
              }
            }
            if (!fallbackData?.cover) {
              pushLog("warn", `[${game.platform}] "${game.name}" — no images found anywhere`);
            }
          } catch (fallbackErr) {
            pushLog("error", `[${game.platform}] "${game.name}" — fallback image error: ${fallbackErr.message}`);
          }
        }
      } catch (e) {
        pushLog("error", `[${game.platform}] "${game.name}" — image error: ${e.message}`);
        stats.errors++;
      }
    }

    if (stopReq) break;

    // ── 3. Description ──────────────────────────────────────────
    if (targets.includes("description") && needsDescription(game)) {
      currentGame.step = "fetching description…";
      pushLog("info", `[${game.platform}] "${game.name}" — fetching description…`);
      try {
        let desc = null;
        let descSource = "api";

        if (game.platform === "Mobile") {
          const d = await fetchIGDBImages(game.name);
          desc = d?.summary || null;
        } else {
          const d = await fetchRAWGData(game.name);
          desc = d?.description || null;
        }

        // Claude AI fallback
        if (!desc || desc.trim().length < 20) {
          pushLog("info", `[${game.platform}] "${game.name}" — no description found, generating with AI…`);
          currentGame.step = "generating description with AI…";
          try {
            const platformHint = game.platform === "Mobile" ? "mobile (Android/iOS)" : "PC";
            const aiResp = await axios.post(
              "https://api.anthropic.com/v1/messages",
              {
                model: "claude-sonnet-4-5",
                max_tokens: 500,
                messages: [
                  {
                    role: "user",
                    content:
                      `Write a compelling game description for "${game.name}" (${platformHint} game). ` +
                      `Write 2-3 paragraphs covering: what kind of game it is, its main gameplay mechanics, ` +
                      `setting/story, and what makes it fun or unique. ` +
                      `Write in an engaging, informative tone like a game store page. ` +
                      `Do NOT include any headings, bullet points, or the game name as a title. ` +
                      `Just write the description text directly.`,
                  },
                ],
              },
              {
                headers: {
                  "x-api-key":         process.env.ANTHROPIC_API_KEY,
                  "anthropic-version": "2023-06-01",
                  "Content-Type":      "application/json",
                },
                timeout: 20000,
              }
            );
            const aiText = (aiResp.data?.content || [])
              .filter(b => b.type === "text")
              .map(b => b.text)
              .join("")
              .trim();
            if (aiText && aiText.length >= 20) {
              desc       = aiText;
              descSource = "ai-generated";
            }
          } catch (aiErr) {
            pushLog("warn", `[${game.platform}] "${game.name}" — AI description failed: ${aiErr.message}`);
          }
        }

        if (desc && desc.trim().length >= 20) {
          update.description = desc.trim().slice(0, 2000);
          stats.descFixed++;
          const label = descSource === "ai-generated" ? "description ✅ (AI-generated)" : `description ✅ (${update.description.length} chars)`;
          pushLog("success", `[${game.platform}] "${game.name}" — ${label}`);
        } else {
          pushLog("warn", `[${game.platform}] "${game.name}" — description not found and AI generation failed`);
        }
      } catch (e) {
        pushLog("error", `[${game.platform}] "${game.name}" — description error: ${e.message}`);
        stats.errors++;
      }
    }

    if (stopReq) break;

    // ── 4. Trailer ──────────────────────────────────────────────
    if (targets.includes("trailer") && needsTrailer(game)) {
      currentGame.step = "fetching trailer…";
      pushLog("info", `[${game.platform}] "${game.name}" — fetching trailer…`);
      try {
        const trailer = await fetchYouTubeTrailer(game.name, game.platform);
        if (trailer?.url) {
          update.trailer = trailer;
          update.video   = trailer.url;
          const label = trailer.type === "gameplay" ? "gameplay video (no trailer found)" : "trailer";
          pushLog("success", `[${game.platform}] "${game.name}" — ${label} ✅`);
        } else {
          pushLog("warn", `[${game.platform}] "${game.name}" — no trailer or gameplay video found`);
        }
      } catch (e) {
        pushLog("error", `[${game.platform}] "${game.name}" — trailer error: ${e.message}`);
        stats.errors++;
      }
    }

    // ── Save to DB ──────────────────────────────────────────────
    try {
      if (Object.keys(update).length > 0) {
        await games.updateOne({ _id: game._id }, { $set: update });
      }
      if (newImages.length > 0) {
        const existingUrls = new Set((game.images || []).map(i => i.url));
        const fresh = newImages.filter(i => !existingUrls.has(i.url));
        if (fresh.length) await games.updateOne({ _id: game._id }, { $push: { images: { $each: fresh } } });
      }
    } catch (e) {
      pushLog("error", `"${game.name}" — DB save error: ${e.message}`);
      stats.errors++;
    }

    stats.done++;
    currentGame = { name: "", platform: "", step: "" };

    await new Promise(r => setTimeout(r, 1500));
  }

  running     = false;
  currentGame = { name: "", platform: "", step: "" };
  pushLog(
    stopReq ? "warn" : "success",
    `${stopReq ? "⏹ Stopped" : "✅ Finished"} — ${stats.done}/${stats.total} processed | links:${stats.linksFixed} images:${stats.imagesFixed} desc:${stats.descFixed} errors:${stats.errors}`
  );

  if (!stopReq && deleteNoLink) {
    pushLog("info", "🗑 Running post-update cleanup — deleting games with no download link…");
    const deleted = await deleteGamesWithNoLink(platform);
    stats.deleted = deleted;
  }
}

// ── Controllers ───────────────────────────────────────────────────

exports.StartAutoUpdate = async (req, res) => {
  if (running) return res.json({ success: false, message: "Auto-update already running" });
  const deleteNoLink = req.body.deleteNoLink === true;
  const targets   = Array.isArray(req.body.targets) && req.body.targets.length
    ? req.body.targets
    : ["link", "image", "description", "trailer"];
  const platform  = req.body.platform || "both";
  const batchSize = Number(req.body.batchSize) || 50;

  runAutoUpdate({ targets, platform, batchSize, deleteNoLink }).catch(err => {
    console.error("[AutoUpdate] Fatal:", err.message);
    running = false;
  });

  res.json({ success: true, message: "Auto-update started", targets, platform, deleteNoLink });
};

exports.StopAutoUpdate = (req, res) => {
  stopReq = true;
  res.json({ success: true, message: "Stop requested" });
};

exports.AutoUpdateStatus = (req, res) => {
  res.json({
    success:     true,
    isRunning:   running,
    currentGame,
    stats:       { ...stats },
    log:         [...liveLog],
  });
};

exports.AutoUpdatePreview = async (req, res) => {
  try {
    const targets  = Array.isArray(req.body.targets) ? req.body.targets : ["link","image","description","trailer"];
    const platform = req.body.platform || "both";
    const query    = buildQuery(targets, platform);
    const count    = await games.countDocuments(query);

    const detail = {};
    const pFilter = platform !== "both" ? { platform } : {};
    detail.noLink    = await games.countDocuments({ ...pFilter, $or: [{ link: { $in: [null,""] } }, { link: { $exists: false } }] });
    detail.noImage   = await games.countDocuments({ ...pFilter, $or: [{ image: { $in: [null,""] } }, { image: { $exists: false } }] });
    detail.noDesc    = await games.countDocuments({ ...pFilter, $or: [{ description: { $in: [null,""] } }, { $expr: { $lt: [{ $strLenCP: { $ifNull: ["$description",""] } }, 20] } }] });
    detail.noTrailer = await games.countDocuments({ ...pFilter, $or: [{ "trailer.url": { $in: [null,""] } }, { "trailer.url": { $exists: false } }] });

    res.json({ success: true, count, detail });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};