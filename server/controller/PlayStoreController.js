// ══════════════════════════════════════════════════════════════════
//  PLAY STORE AUTO-IMPORT
//
//  image  = App ICON  (square thumbnail — fetched from APKPure CDN,
//                      hotlink-safe, no Referer needed)
//  fimage = Wide BANNER / hero  (Play Store screenshot or IGDB art)
// ══════════════════════════════════════════════════════════════════

require("dotenv").config();

const axios   = require("axios");
const cheerio = require("cheerio");
const games   = require("../model/allgamesmodel");
const { fetchBannerCoverArt } = require("./helpers");

const LOOP_DELAY = 3000;
const GAME_DELAY = 1500;

// ── Global state ──────────────────────────────────────────────────
let psStopRequested = false;
let psLoopRunning   = false;
let psTotalImported = 0;
let psCurrentPage   = 1;
let psUpdatedAt     = null;
let psCurrentGame   = { name: "", step: "" };

// ── Live log ring buffer ──────────────────────────────────────────
const PS_LOG_MAX = 60;
const psLiveLog  = [];

function psLog(type, msg) {
  psLiveLog.push({ ts: new Date().toISOString(), type, msg });
  if (psLiveLog.length > PS_LOG_MAX) psLiveLog.shift();
  const icon = type === "error" ? "❌" : type === "warn" ? "⚠️ " : type === "success" ? "✅" : "ℹ️ ";
  console.log(`[PlayStore] ${icon} ${msg}`);
}

function psUpdateAt() { psUpdatedAt = new Date().toISOString(); }

// ── Headers ───────────────────────────────────────────────────────
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

const APKPURE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  Accept:            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  Referer:           "https://apkpure.net/",
};

// ── Mobile category mapper ────────────────────────────────────────
const MOBILE_CATEGORY_MAP = [
  { keys: ["role playing", "rpg"],             cat: "RPG" },
  { keys: ["shooter", "fps", "battle royale"], cat: "Shooter" },
  { keys: ["racing", "driving"],               cat: "Racing" },
  { keys: ["puzzle", "logic", "match"],        cat: "Puzzle" },
  { keys: ["strateg", "tower defense"],        cat: "Strategy" },
  { keys: ["simulat", "tycoon", "farming"],    cat: "Simulation" },
  { keys: ["sport", "football", "soccer"],     cat: "Sports" },
  { keys: ["casual", "idle", "clicker"],       cat: "Casual" },
  { keys: ["arcade", "runner"],                cat: "Arcade" },
  { keys: ["adventur"],                        cat: "Adventure" },
  { keys: ["action", "fight"],                 cat: "Action" },
];

function mapMobileCategory(genre) {
  if (!genre) return "Casual";
  const g = genre.toLowerCase();
  for (const { keys, cat } of MOBILE_CATEGORY_MAP) {
    if (keys.some(k => g.includes(k))) return cat;
  }
  return genre.split(/[,/|]/)[0].trim().replace(/\b\w/g, c => c.toUpperCase()) || "Casual";
}

// ══════════════════════════════════════════════════════════════════
//  ICON: Fetch from APKPure
//
//  APKPure serves app icons from their own CDN (winudf.com or
//  img.apkpure.com). These URLs are completely hotlink-safe —
//  no Referer or auth required — so they always display in browsers.
//
//  We try the APKPure detail page for the package ID and scrape
//  the icon <img> element.
// ══════════════════════════════════════════════════════════════════

async function fetchIconFromApkPure(pkgId) {
  // APKPure's detail page is at /[any-slug]/[pkgId]
  // but they also support a direct lookup via search
  const searchUrl = `https://apkpure.net/search?q=${pkgId}`;

  try {
    const { data: html } = await axios.get(searchUrl, {
      headers: APKPURE_HEADERS,
      timeout: 15000,
      maxRedirects: 5,
    });

    const $ = cheerio.load(html);

    // Find the first search result link that matches the package ID
    let appPageUrl = null;
    $("a[href]").each((_, el) => {
      if (appPageUrl) return;
      const href = $(el).attr("href") || "";
      if (href.includes(pkgId)) appPageUrl = href;
    });

    if (!appPageUrl) return null;

    // Make absolute if relative
    if (appPageUrl.startsWith("/")) appPageUrl = "https://apkpure.net" + appPageUrl;

    // Fetch the app detail page
    const { data: detailHtml } = await axios.get(appPageUrl, {
      headers: APKPURE_HEADERS,
      timeout: 15000,
      maxRedirects: 5,
    });

    const $d = cheerio.load(detailHtml);

    // APKPure icon is in .icon img or .app-icon img or a general img near the title
    const iconSelectors = [
      ".icon img",
      "img.icon",
      ".apk-detail-top .icon img",
      ".detail-info .icon img",
      "aside img",
      ".main-icon img",
    ];

    for (const sel of iconSelectors) {
      const el  = $d(sel).first();
      const src = el.attr("src") || el.attr("data-src") || el.attr("data-lazy-src") || "";
      if (src && src.startsWith("http") && !src.includes("placeholder")) {
        psLog("info", `🖼  APKPure icon (${sel}): ${src}`);
        return src;
      }
    }

    // Broader: any img whose src is from a known APKPure image CDN
    let found = null;
    $d("img").each((_, el) => {
      if (found) return;
      const src = $d(el).attr("src") || $d(el).attr("data-src") || "";
      if (!src.startsWith("http")) return;
      if (
        src.includes("winudf.com") ||
        src.includes("img.apkpure.com") ||
        src.includes("image.apkpure.com") ||
        src.includes("apkpure.net/v3/")
      ) {
        found = src;
      }
    });

    if (found) {
      psLog("info", `🖼  APKPure icon (CDN): ${found}`);
      return found;
    }

  } catch (e) {
    psLog("warn", `APKPure icon fetch failed for ${pkgId}: ${e.message}`);
  }

  return null;
}

// ══════════════════════════════════════════════════════════════════
//  ICON FALLBACK: Play Store og:image
//
//  The og:image on a Play Store page is always the app icon.
//  These lh3.googleusercontent.com URLs DO work in browsers when
//  loaded as <img src> — Google only blocks them via fetch/XHR,
//  not via standard image requests from browsers.
// ══════════════════════════════════════════════════════════════════

function extractIconFromPlayStorePage($) {
  // og:image is always the app icon on Play Store
  const og = $("meta[property='og:image']").attr("content") || "";
  if (og && og.startsWith("http")) return og;

  // itemprop="image" — structured data icon
  const itemprop = $("img[itemprop='image']").first();
  const itsrc = itemprop.attr("src") || itemprop.attr("data-src") || "";
  if (itsrc && itsrc.startsWith("http")) return itsrc;

  // Any square googleusercontent image
  let iconUrl = null;
  $("img").each((_, el) => {
    if (iconUrl) return;
    const src = $(el).attr("src") || "";
    if (!src.startsWith("http")) return;
    if (!src.includes("googleusercontent") && !src.includes("play-lh")) return;
    // Prefer =sNNN (square) or =wNNN-hNNN where w≈h
    if (src.includes("=s")) { iconUrl = src; return; }
    const m = src.match(/=w(\d+)-h(\d+)/);
    if (m && Math.abs(+m[1] - +m[2]) / Math.max(+m[1], +m[2]) < 0.15) {
      iconUrl = src;
    }
  });

  return iconUrl;
}

// ══════════════════════════════════════════════════════════════════
//  BANNER: Extract wide screenshots from Play Store page
//  Used for fimage (hero background on the game detail page)
// ══════════════════════════════════════════════════════════════════

function extractScreenshotsFromPlayStorePage($) {
  const shots = [];

  $("img").each((_, el) => {
    if (shots.length >= 5) return;
    const src = $(el).attr("src") || $(el).attr("data-src") || "";
    if (!src || !src.startsWith("http")) return;
    if (!src.includes("play-lh") && !src.includes("googleusercontent")) return;

    const m = src.match(/=w(\d+)-h(\d+)/);
    if (!m) return;
    const w = +m[1], h = +m[2];
    if (w < 200 || h < 100) return;                          // too small
    if (Math.abs(w - h) / Math.max(w, h) < 0.15) return;    // square = icon, skip

    // Upscale to 1280×720
    const hd = src.replace(/=w\d+-h\d+[^"'\s]*/, "=w1280-h720-rw");
    if (!shots.includes(hd)) shots.push(hd);
  });

  return shots;
}

// ══════════════════════════════════════════════════════════════════
//  STEP 1: Scrape Play Store chart page
// ══════════════════════════════════════════════════════════════════

function buildChartUrl(startIndex) {
  return `https://play.google.com/store/games?hl=en&gl=US&start=${startIndex}&num=24`;
}

async function scrapeChartPage(startIndex) {
  try {
    const { data: html } = await axios.get(buildChartUrl(startIndex), {
      headers: HEADERS, timeout: 20000,
    });
    const $ = cheerio.load(html);
    const entries = [];

    $("a[href*='/store/apps/details']").each((_, el) => {
      const href  = $(el).attr("href") || "";
      const match = href.match(/[?&]id=([a-zA-Z][a-zA-Z0-9_.]+)/);
      if (!match) return;
      const pkgId = match[1];
      if (!pkgId || pkgId.includes("android.vending") || pkgId.includes("google.")) return;

      const name =
        $(el).attr("aria-label") ||
        $(el).find("[aria-label]").first().attr("aria-label") ||
        $(el).text().trim() || "";

      if (pkgId && name.length > 1 && !entries.find(e => e.pkgId === pkgId))
        entries.push({ pkgId, name: name.trim() });
    });

    return entries;
  } catch (e) {
    psLog("warn", `Chart page error (start=${startIndex}): ${e.message}`);
    return [];
  }
}

// ══════════════════════════════════════════════════════════════════
//  STEP 2: Fetch Play Store game metadata
// ══════════════════════════════════════════════════════════════════

async function fetchGameMeta(pkgId, nameHint) {
  const url = `https://play.google.com/store/apps/details?id=${pkgId}&hl=en`;
  try {
    const { data: html } = await axios.get(url, { headers: HEADERS, timeout: 20000 });
    const $ = cheerio.load(html);

    const name =
      $("h1[itemprop='name'] span").first().text().trim() ||
      $("h1.Fd93Bb span").first().text().trim() ||
      $("h1").first().text().trim() ||
      nameHint || pkgId;

    const description =
      $("[data-g-id='description']").first().text().trim() ||
      $("[jsname='sngebd']").first().text().trim() ||
      $(".bARER").first().text().trim() || "";

    const genre =
      $("a[href*='/store/apps/category/GAME']").first().text().trim() ||
      $("[itemprop='genre']").first().text().trim() || "";

    const developer = $("a[href*='developer']").first().text().trim() || "";

    const ratingText =
      $("[itemprop='ratingValue']").first().attr("content") ||
      $(".BHMmbe").first().text().trim() || "";
    const rating = parseFloat(ratingText) || null;

    const psIcon        = extractIconFromPlayStorePage($);
    const psScreenshots = extractScreenshotsFromPlayStorePage($);

    return {
      name, description: description.slice(0, 2000),
      genre, developer, rating,
      psIcon, psScreenshots,
    };
  } catch (e) {
    psLog("warn", `Meta fetch failed for ${pkgId}: ${e.message}`);
    return { name: nameHint || pkgId, description: "", genre: "", developer: "", rating: null, psIcon: null, psScreenshots: [] };
  }
}

// ══════════════════════════════════════════════════════════════════
//  STEP 3: Resolve final icon (image) and banner (fimage)
// ══════════════════════════════════════════════════════════════════

async function resolveImages(pkgId, gameName, psIcon, psScreenshots) {
  let iconUrl = null;
  let heroUrl = null;

  // ── Icon: APKPure CDN (hotlink-safe) ─────────────────────────
  psCurrentGame.step = "fetching icon from APKPure";
  iconUrl = await fetchIconFromApkPure(pkgId);

  // ── Icon fallback: Play Store og:image ────────────────────────
  if (!iconUrl && psIcon) {
    iconUrl = psIcon;
    psLog("info", `🖼  Icon fallback (Play Store og:image): ${iconUrl}`);
  }

  // ── Hero: first Play Store screenshot ─────────────────────────
  if (psScreenshots.length > 0) {
    heroUrl = psScreenshots[0];
    psLog("info", `🖼  Hero (Play Store screenshot): ${heroUrl}`);
  }

  // ── Fallback: IGDB/SteamGridDB if still missing ───────────────
  if (!iconUrl || !heroUrl) {
    psCurrentGame.step = "fetching art from IGDB";
    try {
      const art = await fetchBannerCoverArt(gameName, "Mobile");
      if (art) {
        if (!iconUrl && art.coverImage) {
          iconUrl = art.coverImage;
          psLog("info", `🖼  Icon from ${art.source}: ${iconUrl}`);
        }
        if (!heroUrl && (art.heroImage || art.coverImage)) {
          heroUrl = art.heroImage || art.coverImage;
          psLog("info", `🖼  Hero from ${art.source}: ${heroUrl}`);
        }
      }
    } catch (e) {
      psLog("warn", `Art fetch failed: ${e.message}`);
    }
  }

  if (!iconUrl && heroUrl) iconUrl = heroUrl;
  if (!heroUrl && iconUrl) heroUrl = iconUrl;

  return { iconUrl, heroUrl };
}

// ══════════════════════════════════════════════════════════════════
//  STEP 4: Upsert to DB
// ══════════════════════════════════════════════════════════════════

async function upsertPlayStoreGame(doc) {
  const existing = await games.findOne({
    $or: [
      { externalId: doc.externalId, importSource: "playstore" },
      { name: doc.name },
    ],
  });

  if (existing) {
    const patch = { lastImportedAt: new Date() };
    if (!existing.link   || existing.link.trim().length  < 5) patch.link   = doc.link;
    if (!existing.image  || existing.image.trim().length  < 5) patch.image  = doc.image;
    if (!existing.fimage || existing.fimage.trim().length < 5) patch.fimage = doc.fimage;
    if (!existing.description && doc.description) patch.description = doc.description;
    await games.updateOne({ _id: existing._id }, { $set: patch });
    return "updated";
  }

  await games.create(doc);
  return "inserted";
}

// ══════════════════════════════════════════════════════════════════
//  MAIN LOOP
// ══════════════════════════════════════════════════════════════════

async function runPlayStoreLoop() {
  if (psLoopRunning) return;
  psLoopRunning    = true;
  psStopRequested  = false;
  psLiveLog.length = 0;

  psLog("info", `▶ Play Store import started | from page ${psCurrentPage}`);
  let startIndex = (psCurrentPage - 1) * 24;

  while (!psStopRequested) {
    try {
      psLog("info", `📋 Scraping chart (start=${startIndex})…`);
      psUpdateAt();

      const entries = await scrapeChartPage(startIndex);

      if (!entries.length) {
        psLog("warn", `No games at start=${startIndex} — restarting from 0`);
        startIndex = 0; psCurrentPage = 1;
        await new Promise(r => setTimeout(r, LOOP_DELAY));
        continue;
      }

      psLog("info", `Found ${entries.length} games`);

      for (let i = 0; i < entries.length; i++) {
        if (psStopRequested) break;

        const { pkgId, name } = entries[i];
        psCurrentGame = { name, step: "fetching metadata" };
        psLog("info", `[${i + 1}/${entries.length}] "${name}" (${pkgId})`);
        psUpdateAt();

        try {
          psCurrentGame.step = "fetching Play Store page";
          const meta = await fetchGameMeta(pkgId, name);

          psCurrentGame.step = "resolving images";
          const { iconUrl, heroUrl } = await resolveImages(
            pkgId, meta.name, meta.psIcon, meta.psScreenshots
          );

          psCurrentGame.step = "building download link";
          const downloadUrl = `https://d.apkpure.net/b/XAPK/${pkgId}?version=latest`;
          const category    = mapMobileCategory(meta.genre);

          const imagesArr = [];
          if (iconUrl) imagesArr.push({ type: "cover",      url: iconUrl, source: "playstore" });
          if (heroUrl && heroUrl !== iconUrl)
                        imagesArr.push({ type: "background", url: heroUrl, source: "playstore" });
          meta.psScreenshots.forEach(url =>
            imagesArr.push({ type: "screenshot", url, source: "playstore" })
          );

          const doc = {
            name:          meta.name,
            image:         iconUrl || "",    // ← square app icon
            fimage:        heroUrl || "",    // ← wide hero banner
            description:   meta.description,
            category,
            platform:      "Mobile",
            genre:         meta.genre,
            developer:     meta.developer,
            publisher:     meta.developer,
            releaseDate:   "",
            rating:        meta.rating,
            platforms:     ["Android"],
            trending:      "Not Trending",
            link:          downloadUrl,
            video:         "",
            images:        imagesArr,
            importSource:  "playstore",
            externalId:    pkgId,
            lastImportedAt: new Date(),
          };

          psCurrentGame.step = "saving to DB";
          const result = await upsertPlayStoreGame(doc);
          if (result === "inserted") psTotalImported++;

          psLog(
            result === "inserted" ? "success" : "info",
            `"${meta.name}" → ${result} | icon:${iconUrl ? "✅" : "❌"} hero:${heroUrl ? "✅" : "❌"} | ${category} | total:${psTotalImported}`
          );
        } catch (e) {
          psLog("error", `Error on "${name}": ${e.message}`);
        }

        psCurrentGame = { name: "", step: "" };
        if (!psStopRequested) await new Promise(r => setTimeout(r, GAME_DELAY));
      }

      startIndex += 24;
      psCurrentPage++;
      psUpdateAt();
      if (!psStopRequested) await new Promise(r => setTimeout(r, LOOP_DELAY));

    } catch (err) {
      psLog("error", `Page error: ${err.message}`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  psLoopRunning = false;
  psCurrentGame = { name: "", step: "" };
  psUpdateAt();
  psLog("info", `⏹ Stopped. Total imported: ${psTotalImported}`);
}

// ══════════════════════════════════════════════════════════════════
//  CONTROLLERS
// ══════════════════════════════════════════════════════════════════

exports.StartPlayStoreImport = (req, res) => {
  if (psLoopRunning) return res.json({ success: false, message: "Already running" });
  runPlayStoreLoop().catch(err => { console.error("[PlayStore] Fatal:", err.message); psLoopRunning = false; });
  res.json({ success: true, message: "Play Store import started" });
};

exports.StopPlayStoreImport = (req, res) => {
  psStopRequested = true;
  res.json({ success: true, message: "Stop requested" });
};

exports.PlayStoreImportStatus = (req, res) => {
  res.json({
    success: true, isRunning: psLoopRunning,
    lastPage: psCurrentPage, totalImported: psTotalImported,
    updatedAt: psUpdatedAt, currentGame: psCurrentGame,
    log: [...psLiveLog],
  });
};

exports.ResetPlayStoreImport = (req, res) => {
  if (psLoopRunning) return res.status(400).json({ success: false, error: "Stop first" });
  psCurrentPage = 1; psTotalImported = 0; psLiveLog.length = 0; psUpdatedAt = null;
  res.json({ success: true, message: "Reset to page 1" });
};