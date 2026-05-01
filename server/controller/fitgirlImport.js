// ══════════════════════════════════════════════════════════════════
//  FITGIRL DIRECT IMPORT
//  Scrapes games directly from fitgirl-repacks.site
//  - Game name, description, genre, size, screenshots (HD)
//  - Magnet / torrent links scraped from each post
//  - YouTube trailer fetched automatically
//  - Category mapped to canonical DB category
// ══════════════════════════════════════════════════════════════════

require("dotenv").config();

const axios       = require("axios");
const cheerio     = require("cheerio");
const games       = require("../model/allgamesmodel");
const ImportState = require("../model/importstate");

const { fetchBannerCoverArt, buildSearchVariants } = require("./helpers");

const YT_API_KEY  = process.env.YOUTUBE_API_KEY;

const BASE_URL    = "https://fitgirl-repacks.site";
const PAGE_SIZE   = 10;
const LOOP_DELAY  = 3000;
const GAME_DELAY  = 2000;

// ── Global state ──────────────────────────────────────────────────
let fgStopRequested = false;
let fgLoopRunning   = false;

// ── Live log ──────────────────────────────────────────────────────
const FG_LOG_MAX = 60;
const fgLiveLog  = [];
let   fgCurrentGame = { name: "", platform: "PC", step: "" };

function fgLog(type, msg) {
  fgLiveLog.push({ ts: new Date().toISOString(), type, msg });
  if (fgLiveLog.length > FG_LOG_MAX) fgLiveLog.shift();
  const prefix = type === "error" ? "❌" : type === "warn" ? "⚠️ " : type === "success" ? "✅" : "ℹ️ ";
  console.log(`[FitGirl] ${prefix} ${msg}`);
}

// ── Browser-like headers ──────────────────────────────────────────
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  Connection:        "keep-alive",
  Referer:           "https://fitgirl-repacks.site/",
  "Cache-Control":   "no-cache",
};

// ══════════════════════════════════════════════════════════════════
//  CATEGORY MAPPER
// ══════════════════════════════════════════════════════════════════

const CATEGORY_MAP = [
  { keys: ["role playing", "rpg", "jrpg", "action rpg"],            cat: "RPG" },
  { keys: ["open world", "sandbox", "open-world"],                   cat: "Open World" },
  { keys: ["shooter", "fps", "first-person", "third-person", "tps"], cat: "Shooter" },
  { keys: ["fight", "beat em up", "brawler", "hack and slash"],      cat: "Fighting" },
  { keys: ["horror", "survival horror"],                             cat: "Horror" },
  { keys: ["platform", "platformer", "metroidvania"],                cat: "Platformer" },
  { keys: ["stealth", "infiltration"],                               cat: "Stealth" },
  { keys: ["survival"],                                              cat: "Survival" },
  { keys: ["racing", "driving"],                                     cat: "Racing" },
  { keys: ["puzzle", "logic", "brain"],                              cat: "Puzzle" },
  { keys: ["sport", "football", "soccer", "basketball"],             cat: "Sports" },
  { keys: ["simulat", "tycoon", "farming", "city builder"],          cat: "Simulation" },
  { keys: ["strateg", "rts", "tower defense", "4x", "turn-based"],  cat: "Strategy" },
  { keys: ["adventur", "exploration"],                               cat: "Adventure" },
  { keys: ["action"],                                                cat: "Action" },
  { keys: ["indie"],                                                 cat: "Indie" },
  { keys: ["mmo", "massively multiplayer"],                          cat: "MMO" },
];

function mapCategory(raw) {
  if (!raw) return "Action";
  const g = raw.toLowerCase();
  for (const { keys, cat } of CATEGORY_MAP) {
    if (keys.some(k => g.includes(k))) return cat;
  }
  return raw.split(/[,/|]/)[0].trim().replace(/\b\w/g, c => c.toUpperCase()) || "Action";
}

// ══════════════════════════════════════════════════════════════════
//  IMAGE RESOLUTION UPGRADER
// ══════════════════════════════════════════════════════════════════

function upgradeImageUrl(url) {
  if (!url) return null;
  try {
    if (/i\.imgur\.com/.test(url)) {
      return url
        .replace(/([a-zA-Z0-9]{7})[stbmhlSTBMHL]\.(jpg|jpeg|png|gif|webp)/i, "$1.$2")
        .replace(/\?.*$/, "");
    }
    if (/images\.igdb\.com/.test(url)) {
      return url.replace(/t_(thumb|cover_small|cover_big|screenshot_med|720p|micro)/, "t_1080p");
    }
    if (/\.wp\.com|\.wordpress\.com/.test(url)) {
      const u = new URL(url);
      u.searchParams.delete("resize");
      u.searchParams.delete("fit");
      u.searchParams.delete("w");
      u.searchParams.delete("h");
      u.searchParams.set("w", "1920");
      return u.toString();
    }
    if (/[?&](resize|w=|width=|size=)/.test(url)) {
      return url.replace(/[?&](resize|w|width|size|h|height)=[^&]*/g, "").replace(/^[?&]/, "");
    }
    return url;
  } catch (_) {
    return url;
  }
}

// ══════════════════════════════════════════════════════════════════
//  COVER ART FETCHER
// ══════════════════════════════════════════════════════════════════

async function fetchBestCovers(gameName) {
  const result = await fetchBannerCoverArt(gameName, "PC");

  if (result?.coverImage) {
    fgLog("info", `  🖼️  Cover found for "${gameName}" via ${result.source}`);
    return {
      coverImage:  result.coverImage,
      heroImage:   result.heroImage || result.coverImage,
      screenshots: result.screenshots || [],
      source:      result.source,
    };
  }

  fgLog("warn", `  🖼️  No cover found for "${gameName}" — will save without cover`);
  return null;
}

// ══════════════════════════════════════════════════════════════════
//  FITGIRL PAGE LIST SCRAPER
// ══════════════════════════════════════════════════════════════════

async function scrapeFitgirlListPage(pageNum) {
  const url = pageNum === 1 ? `${BASE_URL}/` : `${BASE_URL}/page/${pageNum}/`;
  try {
    const { data: html } = await axios.get(url, { headers: HEADERS, timeout: 20000 });
    const $     = cheerio.load(html);
    const links = [];
    $("article").each((_, el) => {
      const href = $(el).find("h1.entry-title a, h2.entry-title a").attr("href");
      if (href && href.startsWith(BASE_URL)) links.push(href);
    });
    return links;
  } catch (e) {
    fgLog("error", `Failed to scrape list page ${pageNum}: ${e.message}`);
    return [];
  }
}

// ══════════════════════════════════════════════════════════════════
//  FITGIRL POST SCRAPER
// ══════════════════════════════════════════════════════════════════

async function scrapeFitgirlPost(postUrl) {
  try {
    const { data: html } = await axios.get(postUrl, { headers: HEADERS, timeout: 25000 });
    const $ = cheerio.load(html);

    const rawTitle = $("h1.entry-title, h2.entry-title").first().text().trim();
    const name     = cleanGameName(rawTitle);
    if (!name) return null;

    const content = $(".entry-content");

    let genres       = "";
    let company      = "";
    let originalSize = "";
    let repackSize   = "";

    content.find("p, li").each((_, el) => {
      const text = $(el).text().trim();
      const html = $(el).html() || "";
      if (/genres?\/tags?:/i.test(text)) {
        genres = text.replace(/^.*genres?\/tags?:\s*/i, "").split("\n")[0].trim();
      } else if (/^company:/i.test(text) || /<strong>company:/i.test(html)) {
        company = text.replace(/^company:\s*/i, "").trim();
      } else if (/original size:/i.test(text)) {
        originalSize = text.replace(/^.*original size:\s*/i, "").split("\n")[0].trim();
      } else if (/repack size:/i.test(text)) {
        repackSize = text.replace(/^.*repack size:\s*/i, "").split("\n")[0].trim();
      }
    });

    // ── Scrape FitGirl post images (for screenshots only, NOT cover) ──
    const rawImages = [];
    content.find("img").each((_, el) => {
      const src = $(el).attr("data-src") || $(el).attr("src") || "";
      if (!src) return;
      if (/smiley|emoji|icon|logo|button|banner|\.gif$/i.test(src)) return;
      if (src.includes("gravatar")) return;
      if (!/imgur|steam|cloudfront|wp\.com|wordpress|igdb|gog\.com|epicgames|playstation|xbox/i.test(src)
          && !/\.(jpg|jpeg|png|webp)/i.test(src)) return;
      rawImages.push(src);
    });

    const imagesArr = [];
    content.find("img").each((_, el) => {
      const srcset = $(el).attr("srcset") || "";
      if (srcset) {
        const candidates = srcset.split(",").map(s => {
          const [u, w] = s.trim().split(/\s+/);
          return { url: u, width: parseInt(w) || 0 };
        });
        candidates.sort((a, b) => b.width - a.width);
        if (candidates[0]?.url) {
          imagesArr.push(upgradeImageUrl(candidates[0].url));
          return;
        }
      }
      const src = $(el).attr("data-src") || $(el).attr("src") || "";
      if (src && rawImages.includes(src)) imagesArr.push(upgradeImageUrl(src));
    });

    const seenUrls  = new Set();
    const finalImgs = [];
    for (const url of imagesArr) {
      if (url && !seenUrls.has(url)) { seenUrls.add(url); finalImgs.push(url); }
    }

    // All FitGirl images are screenshots only — type "screenshot" for all
    const imagesDocs = finalImgs.map(url => ({
      type:   "screenshot",
      url,
      source: "fitgirl",
    }));

    // ── Torrent / magnet link ──────────────────────────────────
    let torrentLink = null;
    const magnetMatch = html.match(/magnet:\?[^\s"'<>]+/);
    if (magnetMatch) torrentLink = magnetMatch[0];

    if (!torrentLink) {
      content.find("a[href]").each((_, el) => {
        if (torrentLink) return;
        const href = ($(el).attr("href") || "").trim();
        if (/\.torrent(\?.*)?$/i.test(href)) torrentLink = href;
      });
    }

    if (!torrentLink) {
      const TORRENT_HOSTS = ["1337x", "rarbg", "rutracker", "limetorrents", "torrentgalaxy", "kickass"];
      content.find("a[href]").each((_, el) => {
        if (torrentLink) return;
        const href = ($(el).attr("href") || "").trim();
        try {
          const hostname = new URL(href).hostname.toLowerCase();
          if (TORRENT_HOSTS.some(h => hostname.includes(h))) torrentLink = href;
        } catch (_) {}
      });
    }

    if (!torrentLink) torrentLink = postUrl;

    let releaseDate = "";
    const timeEl = $("time.entry-date, time[datetime]").attr("datetime");
    if (timeEl) releaseDate = timeEl.split("T")[0];

    return {
      name,
      rawTitle,
      genres,
      company,
      originalSize,
      repackSize,
      imagesDocs,   // screenshots only — no coverImage/heroImage from FitGirl
      torrentLink,
      releaseDate,
      postUrl,
    };

  } catch (e) {
    fgLog("error", `Failed to scrape post ${postUrl}: ${e.message}`);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════
//  NAME CLEANER
// ══════════════════════════════════════════════════════════════════

function cleanGameName(rawTitle) {
  if (!rawTitle) return "";
  return rawTitle
    .replace(/\s*[\[(]v[\d.]+[^\])]*/gi, "")
    .replace(/\s*[\[(][^\])]*update[^\])]*[\])]/gi, "")
    .replace(/\s*[\[(][^\])]*repack[^\])]*[\])]/gi, "")
    .replace(/\s*[\[(][^\])]*dlc[^\])]*[\])]/gi, "")
    .replace(/\s*\+\s*(all\s+)?dlcs?.*$/gi, "")
    .replace(/\s*–\s*(selective|lossless|repack).*/gi, "")
    .replace(/\s*(repack|selective download|lossless)\s*$/gi, "")
    .replace(/\s*\[.*?\]\s*/g, "")
    .replace(/\s*\(.*?\)\s*/g, "")
    .trim();
}

// ══════════════════════════════════════════════════════════════════
//  YOUTUBE TRAILER
// ══════════════════════════════════════════════════════════════════

async function fetchYouTubeTrailer(gameName) {
  const q = `${gameName} PC official trailer`;

  if (YT_API_KEY) {
    try {
      const res = await axios.get("https://www.googleapis.com/youtube/v3/search", {
        params: { key: YT_API_KEY, q, part: "snippet", type: "video", maxResults: 5 },
        timeout: 8000,
      });
      const items = res.data.items || [];
      const best  = items.find(i =>
        /trailer/i.test(i.snippet.title) || /official/i.test(i.snippet.title)
      ) || items[0];
      if (best) {
        const vid = best.id.videoId;
        return { url: `https://www.youtube.com/watch?v=${vid}`, embed: `https://www.youtube.com/embed/${vid}` };
      }
    } catch (_) {}
  }

  try {
    const { data: html } = await axios.get(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
      { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 10000 }
    );
    const match = html.match(/var ytInitialData\s*=\s*(\{.+?\});\s*<\/script>/s);
    if (match) {
      const yt       = JSON.parse(match[1]);
      const contents = yt?.contents?.twoColumnSearchResultsRenderer?.primaryContents
                        ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
      for (const item of contents) {
        const vr = item?.videoRenderer;
        if (!vr?.videoId) continue;
        const title = vr.title?.runs?.map(r => r.text).join("") || "";
        if (/trailer/i.test(title)) {
          const vid = vr.videoId;
          return { url: `https://www.youtube.com/watch?v=${vid}`, embed: `https://www.youtube.com/embed/${vid}` };
        }
      }
    }
  } catch (_) {}

  return null;
}

// ══════════════════════════════════════════════════════════════════
//  UPSERT
// ══════════════════════════════════════════════════════════════════

async function upsertGame(doc) {
  const existing = await games.findOne({
    $or: [
      { externalId: doc.externalId, importSource: doc.importSource },
      { name: doc.name },
    ],
  });

  if (existing) {
    const updateFields = { lastImportedAt: new Date() };

    if ((!existing.link || existing.link.trim().length < 5) && doc.link)
      updateFields.link = doc.link;

    if (!existing.trailer?.url && doc.trailer?.url) {
      updateFields.trailer = doc.trailer;
      updateFields.video   = doc.video;
    }

    if (!existing.category || existing.category === "Action")
      updateFields.category = doc.category;

    const existingUrls = new Set((existing.images || []).map(i => i.url));
    const newImages    = (doc.images || []).filter(i => !existingUrls.has(i.url));
    if (newImages.length > 0) {
      await games.updateOne({ _id: existing._id }, { $push: { images: { $each: newImages } } });
    }

    if (!existing.image  && doc.image)  updateFields.image  = doc.image;
    if (!existing.fimage && doc.fimage) updateFields.fimage = doc.fimage;

    await games.updateOne({ _id: existing._id }, { $set: updateFields });
    return { status: "updated" };
  }

  await games.create(doc);
  return { status: "inserted" };
}

// ══════════════════════════════════════════════════════════════════
//  STATE HELPERS
// ══════════════════════════════════════════════════════════════════

const FG_STATE_ID = "fitgirl";

async function loadFGState() {
  let state = await ImportState.findById(FG_STATE_ID);
  if (!state) state = await ImportState.create({ _id: FG_STATE_ID, source: "fitgirl", platform: "PC" });
  return state;
}

async function saveFGState(patch) {
  await ImportState.updateOne(
    { _id: FG_STATE_ID },
    { $set: { ...patch, updatedAt: new Date() } },
    { upsert: true }
  );
}

// ══════════════════════════════════════════════════════════════════
//  MAIN FITGIRL IMPORT LOOP
// ══════════════════════════════════════════════════════════════════

async function runFitgirlLoop() {
  if (fgLoopRunning) return;
  fgLoopRunning   = true;
  fgStopRequested = false;
  fgLiveLog.length = 0;

  const state  = await loadFGState();
  let page     = state.lastPage     || 1;
  let imported = state.totalImported || 0;

  await saveFGState({ isRunning: true, platform: "PC", source: "fitgirl" });

  fgLog("info", `▶ FitGirl import starting — page: ${page} | imported so far: ${imported}`);

  while (!fgStopRequested) {
    try {
      fgLog("info", `📋 Scraping FitGirl archive page ${page}…`);
      const postUrls = await scrapeFitgirlListPage(page);

      if (!postUrls.length) {
        fgLog("warn", `No posts found on page ${page} — may be the last page.`);
        break;
      }

      fgLog("info", `Found ${postUrls.length} posts on page ${page}`);

      for (let i = 0; i < postUrls.length; i++) {
        if (fgStopRequested) break;

        const postUrl = postUrls[i];
        fgLog("info", `(${i + 1}/${postUrls.length}) Scraping: ${postUrl}`);

        const post = await scrapeFitgirlPost(postUrl);
        if (!post || !post.name) {
          fgLog("warn", `Skipped — could not parse post: ${postUrl}`);
          continue;
        }

        fgCurrentGame = { name: post.name, platform: "PC", step: "fetching cover art" };

        // ── Fetch HD cover art from SteamGridDB → Steam → IGDB → RAWG ──
        const covers = await fetchBestCovers(post.name);

        fgCurrentGame.step = "fetching trailer";
        const trailer = await fetchYouTubeTrailer(post.name);
        fgCurrentGame.step = "saving to DB";

        const category = mapCategory(post.genres);

        // ── Build final images array ───────────────────────────
        // cover/hero: external APIs only (SteamGridDB/Steam/IGDB/RAWG)
        // screenshots: external API screenshots + FitGirl post images as extras
        const finalImages = [];

        if (covers?.coverImage) {
          finalImages.push({ type: "cover", url: covers.coverImage, source: covers.source });
        }
        if (covers?.heroImage && covers.heroImage !== covers.coverImage) {
          finalImages.push({ type: "screenshot", url: covers.heroImage, source: covers.source });
        }
        (covers?.screenshots || []).forEach(url => {
          if (!finalImages.find(i => i.url === url))
            finalImages.push({ type: "screenshot", url, source: covers.source });
        });

        // FitGirl post images appended as extra screenshots — never as cover/hero
        post.imagesDocs.forEach(img => {
          if (!finalImages.find(i => i.url === img.url))
            finalImages.push(img); // already typed "screenshot" from scrapeFitgirlPost
        });

        // ✅ cover and hero come ONLY from external APIs — null if not found
        // The auto-update job will fill these in later if they're missing
        const coverImage  = covers?.coverImage || null;
        const heroImage   = covers?.heroImage  || covers?.coverImage || null;
        const rating      = covers?.rating     || null;
        const releaseDate = covers?.releaseDate || post.releaseDate || "";

        const doc = {
          name:          post.name,
          image:         coverImage,
          fimage:        heroImage,
          description:   "",
          category,
          platform:      "PC",
          genre:         post.genres || "",
          developer:     post.company || "",
          publisher:     post.company || "",
          releaseDate,
          rating,
          platforms:     ["PC (Windows)"],
          trending:      "Not Trending",
          link:          post.torrentLink || "",
          video:         trailer?.url  || "",
          trailer:       trailer || undefined,
          images:        finalImages,
          importSource:  "fitgirl",
          externalId:    encodeURIComponent(post.name.toLowerCase().replace(/\s+/g, "-")),
          lastImportedAt: new Date(),
          originalSize:  post.originalSize || "",
          repackSize:    post.repackSize   || "",
          repackUrl:     post.postUrl      || "",
        };

        try {
          const result = await upsertGame(doc);
          if (result.status === "inserted") imported++;
          const linkStatus  = doc.link   ? "link ✅"  : "link ❌";
          const coverStatus = coverImage ? `🖼️ ${covers?.source}` : "🖼️ ❌ (no external cover)";
          const imgCount    = finalImages.length;
          fgLog(
            result.status === "inserted" ? "success" : "info",
            `"${doc.name}" → ${result.status} | ${linkStatus} | ${coverStatus} | ${imgCount} imgs | ${category} | total: ${imported}`
          );
        } catch (e) {
          fgLog("error", `DB error for "${post.name}": ${e.message}`);
        }

        fgCurrentGame = { name: "", platform: "PC", step: "" };
        await new Promise(r => setTimeout(r, GAME_DELAY));
      }

      await saveFGState({ lastPage: page, totalImported: imported });
      page++;
      await new Promise(r => setTimeout(r, LOOP_DELAY));

    } catch (err) {
      fgLog("error", `Error on page ${page}: ${err.message}`);
      await new Promise(r => setTimeout(r, 8000));
    }
  }

  await saveFGState({ isRunning: false, lastPage: page, totalImported: imported });
  fgLoopRunning   = false;
  fgCurrentGame   = { name: "", platform: "PC", step: "" };
  fgLog("info", `⏹ FitGirl import stopped. Total imported: ${imported}`);
}

// ══════════════════════════════════════════════════════════════════
//  CONTROLLERS
// ══════════════════════════════════════════════════════════════════

exports.StartFitgirlImport = async (req, res) => {
  if (fgLoopRunning)
    return res.json({ success: false, message: "FitGirl import already running" });

  runFitgirlLoop().catch(err => {
    console.error("[FitGirl Import] Fatal error:", err.message);
    fgLoopRunning = false;
  });

  res.json({ success: true, message: "FitGirl import started" });
};

exports.StopFitgirlImport = async (req, res) => {
  fgStopRequested = true;
  res.json({ success: true, message: "Stop requested — will stop after current game" });
};

exports.FitgirlImportStatus = async (req, res) => {
  try {
    const state = await loadFGState();
    res.json({
      success:       true,
      isRunning:     fgLoopRunning,
      lastPage:      state.lastPage,
      totalImported: state.totalImported,
      platform:      "PC",
      source:        "fitgirl",
      updatedAt:     state.updatedAt,
      currentGame:   fgCurrentGame,
      log:           [...fgLiveLog],
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.ResetFitgirlImport = async (req, res) => {
  if (fgLoopRunning)
    return res.status(400).json({ success: false, error: "Stop FitGirl import first" });

  await saveFGState({ lastPage: 1, totalImported: 0, isRunning: false });
  res.json({ success: true, message: "FitGirl import state reset to page 1" });
};