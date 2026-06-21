require("dotenv").config();

const axios  = require("axios");
const games  = require("../model/allgamesmodel");
const {
  getFitgirlLink,
  getApkPureLink,
  fetchYouTubeTrailer,
  fetchIGDBImages,
  fetchRAWGData,
  fetchBannerCoverArt,
  buildSearchVariants,
  fetchGameAliases,    // ← collects all known alternative search names
  checkImageUrl,       // ← tests if a stored URL is still alive
  fetchApkPureIcon,    // ← fetches hotlink-safe icon from APKPure CDN
  isJunkScreenshotUrl, // ← detects torrent-stats.info style widget images
} = require("./helpers");

// ── In-memory state ───────────────────────────────────────────────
let running     = false;
let stopReq     = false;
let currentGame = { name: "", platform: "", step: "" };

const LOG_MAX = 80;
const liveLog = [];

function pushLog(type, msg) {
  liveLog.push({ ts: new Date().toISOString(), type, msg });
  if (liveLog.length > LOG_MAX) liveLog.shift();
  const icon = type === "error" ? "❌" : type === "warn" ? "⚠️ " : type === "success" ? "✅" : "ℹ️ ";
  console.log(`[AutoUpdate] ${icon} ${msg}`);
}

// ── Stats counters ────────────────────────────────────────────────
let stats = {
  total: 0, done: 0,
  linksFixed: 0, imagesFixed: 0, imageBrokenFound: 0, aliasesFixed: 0,
  descFixed: 0, screenshotsFixed: 0, errors: 0, deleted: 0,
};

// ── What counts as "missing" ──────────────────────────────────────
function needsLink(g) {
  if (!g.link || g.link.trim().length < 5) return true;
  // Treat bare FitGirl site URLs as missing — they're the old fallback, not real download links
  try {
    const h = new URL(g.link.trim()).hostname.toLowerCase();
    if (h.includes("fitgirl-repacks.site") || h.includes("fitgirl-repacks.ru")) return true;
  } catch (_) {}
  return false;
}
function needsImage(g)       { return !g.image       || g.image.trim().length       < 5; }
function needsFimage(g)      { return !g.fimage      || g.fimage.trim().length      < 5; }
function needsDescription(g) { return !g.description || g.description.trim().length < 20; }
function needsTrailer(g)     { return !g.trailer?.url && (!g.video || g.video.trim().length < 5); }
function needsScreenshots(g) { return !Array.isArray(g.images) || g.images.filter(i => i.type === "screenshot").length === 0; }
function needsAliases(g)     { return !Array.isArray(g.othername) || g.othername.length === 0; }

// ══════════════════════════════════════════════════════════════════
//  IMAGE HEALTH CHECK + REPAIR
//
//  For every game that has image/fimage URLs already stored,
//  we fire a HEAD request to verify the URL is still reachable.
//
//  Broken URL strategy by platform:
//
//  Mobile — image (icon):
//    1. Try APKPure icon (hotlink-safe CDN, uses externalId/pkgId)
//    2. Fall back to fetchBannerCoverArt("Mobile") → IGDB → SGDB
//
//  Mobile — fimage (hero banner):
//    1. fetchBannerCoverArt("Mobile") → IGDB screenshot → SGDB hero
//
//  PC — image + fimage:
//    1. fetchBannerCoverArt("PC") → SteamGridDB → Steam → IGDB → RAWG
// ══════════════════════════════════════════════════════════════════

async function repairBrokenImages(game) {
  const patch      = {};
  const isMobile   = game.platform === "Mobile";
  const pkgId      = game.externalId || null; // package ID for mobile games

  // ── Check image (icon / cover thumbnail) ──────────────────────
  const imageOk = await checkImageUrl(game.image);
  if (!imageOk) {
    stats.imageBrokenFound++;
    pushLog("warn", `[${game.platform}] "${game.name}" — image broken: ${(game.image || "").slice(0, 80)}`);

    let newIcon = null;

    if (isMobile) {
      // Mobile: try APKPure icon first (most reliable, hotlink-safe)
      if (pkgId) {
        currentGame.step = "repairing icon via APKPure";
        newIcon = await fetchApkPureIcon(pkgId);
        if (newIcon) pushLog("info", `  ↳ New icon from APKPure: ${newIcon}`);
      }

      // Fallback: IGDB cover art
      if (!newIcon) {
        currentGame.step = "repairing icon via IGDB";
        try {
          const art = await fetchBannerCoverArt(game.name, "Mobile");
          if (art?.coverImage) {
            newIcon = art.coverImage;
            pushLog("info", `  ↳ New icon from ${art.source}: ${newIcon}`);
          }
        } catch (_) {}
      }
    } else {
      // PC: SteamGridDB → Steam → IGDB → RAWG
      currentGame.step = "repairing image via SteamGridDB/IGDB";
      try {
        const art = await fetchBannerCoverArt(game.name, "PC");
        if (art?.coverImage) {
          newIcon = art.coverImage;
          pushLog("info", `  ↳ New image from ${art.source}: ${newIcon}`);
        }
      } catch (_) {}
    }

    if (newIcon) {
      patch.image = newIcon;
      stats.imagesFixed++;
      pushLog("success", `[${game.platform}] "${game.name}" — image repaired ✅`);
    } else {
      pushLog("warn", `[${game.platform}] "${game.name}" — could not find replacement image`);
    }
  }

  // ── Check fimage (hero banner) ─────────────────────────────────
  const fimageOk = await checkImageUrl(game.fimage);
  if (!fimageOk) {
    stats.imageBrokenFound++;
    pushLog("warn", `[${game.platform}] "${game.name}" — fimage broken: ${(game.fimage || "").slice(0, 80)}`);

    let newHero = null;
    currentGame.step = "repairing fimage/hero";

    try {
      const art = await fetchBannerCoverArt(game.name, game.platform);
      if (art) {
        newHero = art.heroImage || art.coverImage;
        pushLog("info", `  ↳ New fimage from ${art.source}: ${newHero}`);
      }
    } catch (_) {}

    // If still nothing and we just fixed image, reuse it as fimage
    if (!newHero && patch.image) {
      newHero = patch.image;
      pushLog("info", `  ↳ fimage fell back to repaired image`);
    }

    if (newHero) {
      patch.fimage = newHero;
      pushLog("success", `[${game.platform}] "${game.name}" — fimage repaired ✅`);
    } else {
      pushLog("warn", `[${game.platform}] "${game.name}" — could not find replacement fimage`);
    }
  }

  return patch; // {} if nothing was broken / nothing was fixed
}

// ══════════════════════════════════════════════════════════════════
//  SCREENSHOT FETCH + REPAIR
//
//  Two jobs, both handled here:
//   1. MISSING — game.images has zero entries with type "screenshot"
//      → fetch a fresh batch from the right source and push them in.
//   2. BROKEN  — game.images HAS screenshot entries, but one or more
//      of their URLs no longer resolve (dead link / 404 / hotlink
//      block) → drop the dead ones and try to refill from source.
//
//  Source priority mirrors fetchBannerCoverArt:
//    PC:     SteamGridDB/Steam (no screenshots) → IGDB → RAWG
//    Mobile: IGDB → SteamGridDB → RAWG
//  fetchBannerCoverArt already returns a `screenshots` array picked
//  from whichever source matched, so we lean on that first and only
//  fall back to the raw IGDB/RAWG calls if it comes back empty.
// ══════════════════════════════════════════════════════════════════

async function repairScreenshots(game) {
  const existing = Array.isArray(game.images) ? game.images : [];
  const nonShots = existing.filter(i => i.type !== "screenshot");

  // Drop any junk widget images (torrent-stats.info / [kitty-kode] style
  // "Seeds/Peers" badges) that slipped in before the scraper filtered
  // these out, so a repair run also cleans up already-imported games.
  const allShots  = existing.filter(i => i.type === "screenshot");
  const shots      = allShots.filter(s => !isJunkScreenshotUrl(s.url, s.alt));
  const junkRemoved = allShots.length - shots.length;
  if (junkRemoved > 0) {
    pushLog("warn", `[${game.platform}] "${game.name}" — removed ${junkRemoved} non-screenshot widget image(s)`);
  }

  // ── Step 1: validate existing screenshot URLs, drop dead ones ───
  let aliveShots = shots;
  if (shots.length) {
    currentGame.step = "checking screenshot URLs";
    const checks = await Promise.all(shots.map(s => checkImageUrl(s.url)));
    aliveShots = shots.filter((_, i) => checks[i]);
    const deadCount = shots.length - aliveShots.length;
    if (deadCount > 0) {
      pushLog("warn", `[${game.platform}] "${game.name}" — ${deadCount} broken screenshot URL(s) found`);
    }
  }

  const needFresh = aliveShots.length === 0; // nothing usable left (or never had any)

  if (!needFresh) {
    // Had at least one live screenshot — only rewrite if we actually dropped dead/junk ones
    if (aliveShots.length !== allShots.length) {
      return { images: [...nonShots, ...aliveShots], _screenshotsCleaned: true };
    }
    return {}; // all screenshots already healthy, nothing to do
  }

  // ── Step 2: fetch a fresh batch of screenshots ───────────────────
  currentGame.step = "fetching screenshots…";
  let freshUrls  = [];
  let source     = null;

  try {
    const art = await fetchBannerCoverArt(game.name, game.platform);
    if (art?.screenshots?.length) {
      freshUrls = art.screenshots;
      source    = art.source;
    }
  } catch (_) {}

  if (!freshUrls.length) {
    try {
      if (game.platform === "Mobile") {
        const d = await fetchIGDBImages(game.name);
        if (d?.screenshots?.length) { freshUrls = d.screenshots; source = "igdb"; }
      } else {
        const d = await fetchRAWGData(game.name);
        if (d?.screenshots?.length) { freshUrls = d.screenshots; source = "rawg"; }
      }
    } catch (_) {}
  }

  if (!freshUrls.length) {
    pushLog("warn", `[${game.platform}] "${game.name}" — no screenshots found`);
    // Still write back the cleaned list (dead/junk ones removed) even if we found no replacements
    if (aliveShots.length !== allShots.length) {
      return { images: [...nonShots, ...aliveShots], _screenshotsCleaned: true };
    }
    return {};
  }

  // Dedup against anything still alive, cap at 5 screenshots total
  const seenUrls    = new Set(aliveShots.map(s => s.url));
  const newShotDocs = freshUrls
    .filter(u => !seenUrls.has(u))
    .slice(0, 5 - aliveShots.length)
    .map(url => ({ type: "screenshot", url, source: source || "auto" }));

  pushLog("success", `[${game.platform}] "${game.name}" — screenshots ✅ (${newShotDocs.length} from ${source})`);

  return {
    images: [...nonShots, ...aliveShots, ...newShotDocs],
    _screenshotsCleaned: true,
  };
}

// ── Build MongoDB query based on selected fix targets ─────────────
function buildQuery(targets, platform) {
  const or = [];

  if (targets.includes("link"))
    or.push({ link: { $in: [null, ""] } }, { link: { $exists: false } });

  if (targets.includes("image"))
    or.push({ image: { $in: [null, ""] } }, { image: { $exists: false } });

  if (targets.includes("description"))
    or.push(
      { description: { $in: [null, ""] } },
      { $expr: { $lt: [{ $strLenCP: { $ifNull: ["$description", ""] } }, 20] } }
    );

  if (targets.includes("trailer"))
    or.push(
      { "trailer.url": { $in: [null, ""] } },
      { "trailer.url": { $exists: false } }
    );

  if (targets.includes("screenshots"))
    or.push(
      { images: { $exists: false } },
      { images: { $size: 0 } },
      { images: { $not: { $elemMatch: { type: "screenshot" } } } }
    );

  if (targets.includes("aliases"))
    or.push(
      { othername: { $exists: false } },
      { othername: { $size: 0 } }
    );

  // "imagecheck" target: fetch ALL games (even those with images)
  // so we can validate the URLs. We use a separate query below.
  const q = or.length ? { $or: or } : {};
  if (platform !== "both") q.platform = platform;
  return q;
}

// ── Delete games with no download link ────────────────────────────
async function deleteGamesWithNoLink(platform) {
  const query = { $or: [{ link: { $in: [null, ""] } }, { link: { $exists: false } }] };
  if (platform !== "both") query.platform = platform;
  const toDelete = await games.find(query).select("_id name platform").lean();
  if (!toDelete.length) { pushLog("info", "🗑 Delete pass: no games without links found."); return 0; }
  const ids = toDelete.map(g => g._id);
  await games.deleteMany({ _id: { $in: ids } });
  toDelete.forEach(g => pushLog("warn", `🗑 Deleted [${g.platform}] "${g.name}" — no download link`));
  pushLog("success", `🗑 Deleted ${toDelete.length} game(s) with no download link.`);
  return toDelete.length;
}

// ── Main auto-update loop ─────────────────────────────────────────
async function runAutoUpdate({ targets, platform, batchSize, deleteNoLink }) {
  if (running) return;
  running        = true;
  stopReq        = false;
  liveLog.length = 0;

  const includeImageCheck = targets.includes("imagecheck");

  // ── Build the list of games to process ─────────────────────────
  let allGames;
  if (includeImageCheck) {
    // imagecheck mode: pull ALL games (with any image value) so we
    // can validate each URL. Filter out games with no image at all
    // (those are handled by the normal "image" target).
    const q = {};
    if (platform !== "both") q.platform = platform;
    q.$and = [
      { image:  { $exists: true, $ne: "" } },
    ];
    allGames = await games
      .find(q)
      .select("_id name platform image fimage description link video trailer images othername externalId")
      .lean();
  } else {
    const query = buildQuery(targets, platform);
    allGames = await games
      .find(query)
      .select("_id name platform image fimage description link video trailer images othername externalId")
      .lean();
  }

  stats = {
    total: allGames.length, done: 0,
    linksFixed: 0, imagesFixed: 0, imageBrokenFound: 0, aliasesFixed: 0,
    descFixed: 0, screenshotsFixed: 0, errors: 0, deleted: 0,
  };

  pushLog("info",
    `🔍 Found ${allGames.length} games to process ` +
    `[targets: ${targets.join(", ")} | platform: ${platform}]`
  );

  if (!allGames.length) {
    pushLog("success", "Nothing to update — all games are complete!");
    running = false;
    return;
  }

  for (const game of allGames) {
    if (stopReq) break;

    currentGame = { name: game.name, platform: game.platform, step: "starting" };
    const update    = {};
    const newImages = [];

    // ══════════════════════════════════════════════════════════════
    //  IMAGE URL HEALTH CHECK
    //  Runs when "imagecheck" is in targets OR when the game has
    //  a non-empty image/fimage that we want to verify.
    //  Also runs on every game even in normal mode — broken images
    //  are repaired inline alongside other fixes.
    // ══════════════════════════════════════════════════════════════
    if (
      includeImageCheck ||
      targets.includes("image") ||
      (game.image && game.image.length > 5) ||
      (game.fimage && game.fimage.length > 5)
    ) {
      currentGame.step = "checking image URLs";
      try {
        const imagePatch = await repairBrokenImages(game);
        Object.assign(update, imagePatch);
      } catch (e) {
        pushLog("error", `[${game.platform}] "${game.name}" — image check error: ${e.message}`);
        stats.errors++;
      }
    }

    if (stopReq) break;

    // ══════════════════════════════════════════════════════════════
    //  FILL MISSING FIELDS (original logic — unchanged)
    // ══════════════════════════════════════════════════════════════

    // ── 1. Download link ─────────────────────────────────────────
    if (targets.includes("link") && needsLink(game)) {
      currentGame.step = game.platform === "Mobile" ? "searching APKPure…" : "searching FitGirl…";
      const nameVariants = buildSearchVariants(game.name);
      pushLog("info", `[${game.platform}] "${game.name}" — fetching link… (${nameVariants.length} variant(s))`);
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

    // ── 2. Images (fill missing image/fimage) ────────────────────
    if (targets.includes("image") && (needsImage(game) || needsFimage(game))) {
      // Only fetch if not already patched by the health check above
      const stillNeedsImage  = needsImage(game)  && !update.image;
      const stillNeedsFimage = needsFimage(game) && !update.fimage;

      if (stillNeedsImage || stillNeedsFimage) {
        currentGame.step = "fetching banner art…";
        pushLog("info", `[${game.platform}] "${game.name}" — fetching missing images…`);
        try {
          const artData = await fetchBannerCoverArt(game.name, game.platform);

          if (artData?.coverImage) {
            if (stillNeedsImage)  update.image  = artData.coverImage;
            if (stillNeedsFimage) update.fimage = artData.heroImage || artData.coverImage;

            (artData.screenshots || []).forEach(url =>
              newImages.push({ type: "screenshot", url, source: artData.source })
            );

            if (stillNeedsImage) stats.imagesFixed++;

            const matchInfo = artData.matchedName && artData.matchedName !== game.name
              ? ` → matched "${artData.matchedName}"` : "";
            pushLog("success",
              `[${game.platform}] "${game.name}" — art ✅ (${artData.source}${matchInfo})`
            );
          } else {
            // Final fallback
            pushLog("warn", `[${game.platform}] "${game.name}" — no art found, trying fallback…`);
            try {
              if (game.platform === "Mobile") {
                const d = await fetchIGDBImages(game.name);
                if (d?.cover) {
                  if (stillNeedsImage)  update.image  = d.cover;
                  if (stillNeedsFimage) update.fimage = d.screenshots[0] || d.cover;
                  d.screenshots.forEach(url => newImages.push({ type: "screenshot", url, source: "igdb" }));
                  if (stillNeedsImage) stats.imagesFixed++;
                  pushLog("info", `[${game.platform}] "${game.name}" — fallback image ✅ (IGDB)`);
                }
              } else {
                const d = await fetchRAWGData(game.name);
                if (d?.cover) {
                  if (stillNeedsImage)  update.image  = d.cover;
                  if (stillNeedsFimage) update.fimage = d.background || d.cover;
                  d.screenshots.forEach(url => newImages.push({ type: "screenshot", url, source: "rawg" }));
                  if (stillNeedsImage) stats.imagesFixed++;
                  pushLog("info", `[${game.platform}] "${game.name}" — fallback image ✅ (RAWG)`);
                }
              }
            } catch (fallbackErr) {
              pushLog("error", `[${game.platform}] "${game.name}" — fallback error: ${fallbackErr.message}`);
            }
          }
        } catch (e) {
          pushLog("error", `[${game.platform}] "${game.name}" — image error: ${e.message}`);
          stats.errors++;
        }
      }
    }

    if (stopReq) break;

    // ── 3. Description ───────────────────────────────────────────
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
          pushLog("info", `[${game.platform}] "${game.name}" — generating description with AI…`);
          currentGame.step = "generating description with AI…";
          try {
            const platformHint = game.platform === "Mobile" ? "mobile (Android/iOS)" : "PC";
            const aiResp = await axios.post(
              "https://api.anthropic.com/v1/messages",
              {
                model:      "claude-sonnet-4-5",
                max_tokens: 500,
                messages: [{
                  role:    "user",
                  content:
                    `Write a compelling game description for "${game.name}" (${platformHint} game). ` +
                    `Write 2-3 paragraphs covering: what kind of game it is, its main gameplay mechanics, ` +
                    `setting/story, and what makes it fun or unique. ` +
                    `Write in an engaging, informative tone like a game store page. ` +
                    `Do NOT include any headings, bullet points, or the game name as a title. ` +
                    `Just write the description text directly.`,
                }],
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
              .filter(b => b.type === "text").map(b => b.text).join("").trim();
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
          const label = descSource === "ai-generated"
            ? "description ✅ (AI-generated)"
            : `description ✅ (${update.description.length} chars)`;
          pushLog("success", `[${game.platform}] "${game.name}" — ${label}`);
        } else {
          pushLog("warn", `[${game.platform}] "${game.name}" — description not found`);
        }
      } catch (e) {
        pushLog("error", `[${game.platform}] "${game.name}" — description error: ${e.message}`);
        stats.errors++;
      }
    }

    if (stopReq) break;

    // ── 4. Trailer ───────────────────────────────────────────────
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
          pushLog("warn", `[${game.platform}] "${game.name}" — no trailer found`);
        }
      } catch (e) {
        pushLog("error", `[${game.platform}] "${game.name}" — trailer error: ${e.message}`);
        stats.errors++;
      }
    }

    if (stopReq) break;

    // ── 5. Screenshots (fetch missing / repair broken) ────────────
    if (
      targets.includes("screenshots") ||
      includeImageCheck ||
      (targets.includes("image") && needsScreenshots(game))
    ) {
      currentGame.step = "checking screenshots…";
      try {
        // Fold in any screenshots step 2 already collected (e.g. from
        // fetchBannerCoverArt while filling missing image/fimage) so
        // repairScreenshots sees the fullest possible picture and we
        // don't lose them once we $set the whole images array below.
        const gameForRepair = newImages.length
          ? { ...game, images: [...(game.images || []), ...newImages] }
          : game;

        const shotPatch = await repairScreenshots(gameForRepair);
        if (shotPatch.images) {
          update.images = shotPatch.images;
          // images array now fully replaces via $set — clear newImages
          // so the save block below doesn't also try to $push them.
          newImages.length = 0;
          stats.screenshotsFixed++;
        }
      } catch (e) {
        pushLog("error", `[${game.platform}] "${game.name}" — screenshot error: ${e.message}`);
        stats.errors++;
      }
    }

    if (stopReq) break;

    // ── 6. Aliases (othername) ────────────────────────────────────
    if (targets.includes("aliases") && needsAliases(game)) {
      currentGame.step = "fetching aliases…";
      pushLog("info", `[${game.platform}] "${game.name}" — fetching aliases…`);
      try {
        const aliases = await fetchGameAliases(game.name, game.platform);
        if (aliases.length > 0) {
          // Merge with any existing names (game.othername may have been populated earlier)
          const existing = new Set((game.othername || []).map(n => n.toLowerCase()));
          const fresh    = aliases.filter(n => !existing.has(n.toLowerCase()));
          if (fresh.length > 0) {
            await games.updateOne(
              { _id: game._id },
              { $push: { othername: { $each: fresh } } }
            );
            stats.aliasesFixed = (stats.aliasesFixed || 0) + 1;
            pushLog("success", `[${game.platform}] "${game.name}" — aliases ✅ (${fresh.length} added: ${fresh.slice(0, 3).join(", ")}${fresh.length > 3 ? "…" : ""})`);
          } else {
            pushLog("info", `[${game.platform}] "${game.name}" — aliases already up to date`);
          }
        } else {
          pushLog("warn", `[${game.platform}] "${game.name}" — no aliases found`);
        }
      } catch (e) {
        pushLog("error", `[${game.platform}] "${game.name}" — alias error: ${e.message}`);
        stats.errors++;
      }
    }

    // ── Save to DB ───────────────────────────────────────────────
    try {
      // ✅ Always ensure video entries sit at the front of the images array
      // before saving — covers both full replacements and partial updates.
      function prioritiseVideos(arr) {
        if (!Array.isArray(arr) || arr.length === 0) return arr;
        const isVideo = url => /youtube\.com|youtu\.be|vimeo\.com|\.mp4|\.webm|\.mov|\/video\//i.test(url || "");
        const videos = arr.filter(i => isVideo(i.url) || i.type === "video");
        const stills = arr.filter(i => !isVideo(i.url) && i.type !== "video");
        videos.forEach(v => { v.type = "video"; });
        return [...videos, ...stills];
      }

      // Also prepend any newly fetched trailer into the images array
      if (update.trailer?.url || update.video) {
        const trailerUrl = update.trailer?.url || update.video;
        const baseImages = update.images || game.images || [];
        const alreadyHas = baseImages.some(i => i.url === trailerUrl);
        if (!alreadyHas) {
          const trailerEntry = { type: "video", url: trailerUrl, source: "youtube" };
          update.images = prioritiseVideos([trailerEntry, ...baseImages]);
          newImages.length = 0; // absorbed into update.images
        } else if (update.images) {
          update.images = prioritiseVideos(update.images);
        }
      } else if (update.images) {
        update.images = prioritiseVideos(update.images);
      }

      if (Object.keys(update).length > 0) {
        await games.updateOne({ _id: game._id }, { $set: update });
      }
      if (newImages.length > 0) {
        const existingUrls = new Set((game.images || []).map(i => i.url));
        const fresh = newImages.filter(i => !existingUrls.has(i.url));
        if (fresh.length)
          await games.updateOne({ _id: game._id }, { $push: { images: { $each: fresh } } });
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
    `${stopReq ? "⏹ Stopped" : "✅ Finished"} — ` +
    `${stats.done}/${stats.total} processed | ` +
    `links:${stats.linksFixed} images:${stats.imagesFixed} ` +
    `brokenFound:${stats.imageBrokenFound} desc:${stats.descFixed} ` +
    `screenshots:${stats.screenshotsFixed} aliases:${stats.aliasesFixed} errors:${stats.errors}`
  );

  if (!stopReq && deleteNoLink) {
    pushLog("info", "🗑 Running cleanup — deleting games with no download link…");
    stats.deleted = await deleteGamesWithNoLink(platform);
  }
}

// ── Controllers ───────────────────────────────────────────────────

exports.StartAutoUpdate = async (req, res) => {
  if (running) return res.json({ success: false, message: "Auto-update already running" });

  const deleteNoLink = req.body.deleteNoLink === true;
  const targets      = Array.isArray(req.body.targets) && req.body.targets.length
    ? req.body.targets
    : ["link", "image", "description", "trailer", "screenshots"];
  const platform     = req.body.platform  || "both";
  const batchSize    = Number(req.body.batchSize) || 50;

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
    const targets  = Array.isArray(req.body.targets) ? req.body.targets : ["link","image","description","trailer","screenshots"];
    const platform = req.body.platform || "both";
    const query    = buildQuery(targets, platform);
    const count    = await games.countDocuments(query);

    const pFilter    = platform !== "both" ? { platform } : {};
    const detail = {
      noLink:        await games.countDocuments({ ...pFilter, $or: [{ link:  { $in: [null,""] } }, { link:  { $exists: false } }] }),
      noImage:       await games.countDocuments({ ...pFilter, $or: [{ image: { $in: [null,""] } }, { image: { $exists: false } }] }),
      noDesc:        await games.countDocuments({ ...pFilter, $or: [{ description: { $in: [null,""] } }, { $expr: { $lt: [{ $strLenCP: { $ifNull: ["$description",""] } }, 20] } }] }),
      noTrailer:     await games.countDocuments({ ...pFilter, $or: [{ "trailer.url": { $in: [null,""] } }, { "trailer.url": { $exists: false } }] }),
      noScreenshots: await games.countDocuments({ ...pFilter, $or: [
        { images: { $exists: false } },
        { images: { $size: 0 } },
        { images: { $not: { $elemMatch: { type: "screenshot" } } } },
      ] }),
      noAliases:     await games.countDocuments({ ...pFilter, $or: [
        { othername: { $exists: false } },
        { othername: { $size: 0 } },
      ] }),
      // imagecheck count = all games with a non-empty image (potential broken URLs)
      hasImage:  await games.countDocuments({ ...pFilter, image: { $exists: true, $ne: "" } }),
    };

    res.json({ success: true, count, detail });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};