// ══════════════════════════════════════════════════════════════════
//  PAID PLAY STORE IMPORT
//
//  Scrapes NOT-FREE (paid) games from the Play Store top charts.
//  Detects price via the Play Store page, fetches APKPure download
//  link, resolves icon/banner art, and fetches a YouTube trailer.
//
//  Fields set on DB doc:
//    isPaid      = true
//    price       = "$X.XX" string from Play Store
//    link        = APKPure download link (XAPK direct download)
//    video       = YouTube trailer URL
//    importSource = "playstore_paid"
// ══════════════════════════════════════════════════════════════════

require("dotenv").config();

const axios   = require("axios");
const cheerio = require("cheerio");
const games   = require("../model/allgamesmodel");
const { fetchBannerCoverArt, fetchGameAliases } = require("./helpers");

const LOOP_DELAY = 3500;
const GAME_DELAY = 2000;

// ── Global state ──────────────────────────────────────────────────
let paidStopRequested = false;
let paidLoopRunning   = false;
let paidTotalImported = 0;
let paidCurrentPage   = 1;
let paidUpdatedAt     = null;
let paidCurrentGame   = { name: "", step: "" };

const PAID_LOG_MAX = 60;
const paidLiveLog  = [];

function paidLog(type, msg) {
  paidLiveLog.push({ ts: new Date().toISOString(), type, msg });
  if (paidLiveLog.length > PAID_LOG_MAX) paidLiveLog.shift();
  const icon = type === "error" ? "❌" : type === "warn" ? "⚠️ " : type === "success" ? "✅" : "ℹ️ ";
  console.log(`[PaidPlayStore] ${icon} ${msg}`);
}

function paidUpdateAt() { paidUpdatedAt = new Date().toISOString(); }

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

// ── Category mapper ───────────────────────────────────────────────
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
//  PLAY STORE: Detect price and fetch metadata
// ══════════════════════════════════════════════════════════════════

/**
 * Fetches the Play Store detail page for pkgId.
 * Returns { name, description, genre, developer, rating, price,
 *           isFree, psIcon, psScreenshots }
 *
 * Price detection strategy:
 *  1. Look for structured data (LD-JSON) with "offers.price"
 *  2. Look for the buy-button text (e.g. "Buy $4.99")
 *  3. Look for itemprop="price" meta
 *  4. If nothing found → assume free (skip the game)
 */
async function fetchGameMeta(pkgId, nameHint) {
  const url = `https://play.google.com/store/apps/details?id=${pkgId}&hl=en&gl=US`;
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

    // ── Price detection ─────────────────────────────────────────
    let price  = null;
    let isFree = true;

    // 1. LD+JSON structured data
    $("script[type='application/ld+json']").each((_, el) => {
      if (price) return;
      try {
        const json = JSON.parse($(el).html() || "{}");
        const offers = json.offers || (Array.isArray(json["@graph"]) && json["@graph"].find(n => n["@type"] === "Offer"));
        if (offers) {
          const p = parseFloat(offers.price || offers.lowPrice);
          if (!isNaN(p) && p > 0) {
            price  = `${offers.priceCurrency || "$"}${p.toFixed(2)}`;
            isFree = false;
          } else if (!isNaN(p) && p === 0) {
            isFree = true;
          }
        }
      } catch (_) {}
    });

    // 2. itemprop="price" meta
    if (price === null) {
      const metaPrice = $("[itemprop='price']").attr("content");
      if (metaPrice !== undefined) {
        const p = parseFloat(metaPrice);
        if (!isNaN(p) && p > 0) {
          price  = `$${p.toFixed(2)}`;
          isFree = false;
        } else if (!isNaN(p) && p === 0) {
          isFree = true;
        }
      }
    }

    // 3. Buy-button text: "Buy $X.XX"
    if (price === null) {
      const buyBtn = $("button, [aria-label*='Buy']").filter((_, el) =>
        /buy\s+\$[\d.]+/i.test($(el).text())
      ).first().text().trim();
      const m = buyBtn.match(/\$([\d.]+)/);
      if (m) {
        price  = `$${m[1]}`;
        isFree = false;
      }
    }

    // 4. Search page HTML for price patterns like "$2.99" outside "Free"
    if (price === null) {
      const bodyText = $("body").text();
      // Avoid "Free" pages — look for typical price strings
      const priceMatch = bodyText.match(/\$\s*([\d]+\.\d{2})(?!\s*\/\s*month)/);
      if (priceMatch && !bodyText.toLowerCase().includes("install") === false) {
        price  = `$${priceMatch[1]}`;
        isFree = false;
      }
    }

    // ── Screenshots / Icon ──────────────────────────────────────
    const psIcon        = extractIconFromPlayStorePage($);
    const psScreenshots = extractScreenshotsFromPlayStorePage($);

    return {
      name, description: description.slice(0, 2000),
      genre, developer, rating,
      price, isFree,
      psIcon, psScreenshots,
    };
  } catch (e) {
    paidLog("warn", `Meta fetch failed for ${pkgId}: ${e.message}`);
    return { name: nameHint || pkgId, description: "", genre: "", developer: "", rating: null, price: null, isFree: true, psIcon: null, psScreenshots: [] };
  }
}

function extractIconFromPlayStorePage($) {
  const og = $("meta[property='og:image']").attr("content") || "";
  if (og && og.startsWith("http")) return og;
  let iconUrl = null;
  $("img").each((_, el) => {
    if (iconUrl) return;
    const src = $(el).attr("src") || "";
    if (!src.startsWith("http")) return;
    if (!src.includes("googleusercontent") && !src.includes("play-lh")) return;
    if (src.includes("=s")) { iconUrl = src; return; }
    const m = src.match(/=w(\d+)-h(\d+)/);
    if (m && Math.abs(+m[1] - +m[2]) / Math.max(+m[1], +m[2]) < 0.15) iconUrl = src;
  });
  return iconUrl;
}

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
    if (w < 200 || h < 100) return;
    if (Math.abs(w - h) / Math.max(w, h) < 0.15) return;
    const hd = src.replace(/=w\d+-h\d+[^"'\s]*/, "=w1280-h720-rw");
    if (!shots.includes(hd)) shots.push(hd);
  });
  return shots;
}

// ══════════════════════════════════════════════════════════════════
//  APKPure: fetch icon (hotlink-safe CDN URLs)
// ══════════════════════════════════════════════════════════════════

async function fetchIconFromApkPure(pkgId) {
  const searchUrl = `https://apkpure.net/search?q=${pkgId}`;
  try {
    const { data: html } = await axios.get(searchUrl, {
      headers: APKPURE_HEADERS, timeout: 15000, maxRedirects: 5,
    });
    const $ = cheerio.load(html);
    let appPageUrl = null;
    $("a[href]").each((_, el) => {
      if (appPageUrl) return;
      const href = $(el).attr("href") || "";
      if (href.includes(pkgId)) appPageUrl = href;
    });
    if (!appPageUrl) return null;
    if (appPageUrl.startsWith("/")) appPageUrl = "https://apkpure.net" + appPageUrl;

    const { data: detailHtml } = await axios.get(appPageUrl, {
      headers: APKPURE_HEADERS, timeout: 15000, maxRedirects: 5,
    });
    const $d = cheerio.load(detailHtml);

    const iconSelectors = [
      ".icon img", "img.icon", ".apk-detail-top .icon img",
      ".detail-info .icon img", "aside img", ".main-icon img",
    ];
    for (const sel of iconSelectors) {
      const el  = $d(sel).first();
      const src = el.attr("src") || el.attr("data-src") || el.attr("data-lazy-src") || "";
      if (src && src.startsWith("http") && !src.includes("placeholder")) return src;
    }

    let found = null;
    $d("img").each((_, el) => {
      if (found) return;
      const src = $d(el).attr("src") || $d(el).attr("data-src") || "";
      if (!src.startsWith("http")) return;
      if (src.includes("winudf.com") || src.includes("img.apkpure.com") ||
          src.includes("image.apkpure.com") || src.includes("apkpure.net/v3/"))
        found = src;
    });
    return found;
  } catch (e) {
    paidLog("warn", `APKPure icon failed for ${pkgId}: ${e.message}`);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════
//  APKPure: APK download link
// ══════════════════════════════════════════════════════════════════

function buildApkPureDownloadLink(pkgId) {
  // Direct XAPK download from APKPure CDN — works for paid apps too
  // (serves the latest available version)
  return `https://d.apkpure.net/b/XAPK/${pkgId}?version=latest`;
}

// ══════════════════════════════════════════════════════════════════
//  YouTube trailer
// ══════════════════════════════════════════════════════════════════

async function fetchYouTubeTrailer(gameName) {
  try {
    const query = `${gameName} android mobile official trailer`;
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const { data: html } = await axios.get(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeout: 15000,
    });

    // Parse ytInitialData from page HTML
    const match = html.match(/var ytInitialData\s*=\s*(\{.+?\});\s*<\/script>/s);
    if (!match) return null;

    let ytData;
    try { ytData = JSON.parse(match[1]); } catch (_) { return null; }

    const videos = [];
    function walk(obj) {
      if (!obj || typeof obj !== "object") return;
      if (obj.videoId && obj.title) {
        const titleText = obj.title?.runs?.[0]?.text || obj.title?.simpleText || "";
        const channel   = obj.shortBylineText?.runs?.[0]?.text || "";
        const durationText = obj.lengthText?.simpleText || "";
        const parts = durationText.split(":").map(Number);
        let seconds = 0;
        if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
        else if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
        videos.push({ videoId: obj.videoId, title: titleText, channel, seconds });
        return;
      }
      for (const v of Object.values(obj)) walk(v);
    }
    walk(ytData);

    if (!videos.length) return null;

    const scored = videos.map(v => {
      let score = 0;
      const t = v.title.toLowerCase();
      if (t.includes("official trailer")) score += 40;
      else if (t.includes("trailer"))     score += 25;
      if (t.includes("official"))         score += 10;
      if (v.seconds > 60 && v.seconds < 600) score += 10;
      if (v.seconds < 60) score -= 20; // skip shorts
      return { ...v, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    if (!best || best.score < 0) return null;

    return `https://www.youtube.com/watch?v=${best.videoId}`;
  } catch (e) {
    paidLog("warn", `YouTube trailer error: ${e.message}`);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════
//  STEP 1: Scrape paid chart
//
//  Play Store has a dedicated paid-games chart URL.
//  We also fall back to scanning the main chart and filtering by price.
// ══════════════════════════════════════════════════════════════════

function buildPaidChartUrl(startIndex) {
  // Play Store paid games chart (top paid)
  return `https://play.google.com/store/games/top-paid?hl=en&gl=US&start=${startIndex}&num=24`;
}

function buildTopChartUrl(startIndex) {
  // Fallback: main games chart — we'll filter paid ones in meta step
  return `https://play.google.com/store/games?hl=en&gl=US&start=${startIndex}&num=24`;
}

async function scrapePaidChartPage(startIndex) {
  const urls = [buildPaidChartUrl(startIndex), buildTopChartUrl(startIndex)];
  for (const url of urls) {
    try {
      const { data: html } = await axios.get(url, { headers: HEADERS, timeout: 20000 });
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

      if (entries.length > 0) return entries;
    } catch (e) {
      paidLog("warn", `Chart fetch error (start=${startIndex}, url=${url}): ${e.message}`);
    }
  }
  return [];
}

// ══════════════════════════════════════════════════════════════════
//  STEP 2: Resolve images
// ══════════════════════════════════════════════════════════════════

async function resolveImages(pkgId, gameName, psIcon, psScreenshots) {
  let iconUrl = await fetchIconFromApkPure(pkgId);

  if (!iconUrl && psIcon) {
    iconUrl = psIcon;
    paidLog("info", `🖼  Icon fallback (Play Store og:image)`);
  }

  let heroUrl = psScreenshots.length > 0 ? psScreenshots[0] : null;

  if (!iconUrl || !heroUrl) {
    try {
      const art = await fetchBannerCoverArt(gameName, "Mobile");
      if (art) {
        if (!iconUrl && art.coverImage) iconUrl = art.coverImage;
        if (!heroUrl && (art.heroImage || art.coverImage)) heroUrl = art.heroImage || art.coverImage;
      }
    } catch (e) {
      paidLog("warn", `Art fetch failed: ${e.message}`);
    }
  }

  if (!iconUrl && heroUrl) iconUrl = heroUrl;
  if (!heroUrl && iconUrl) heroUrl = iconUrl;

  return { iconUrl, heroUrl };
}

// ══════════════════════════════════════════════════════════════════
//  STEP 3: Upsert to DB
// ══════════════════════════════════════════════════════════════════

async function upsertPaidGame(doc) {
  const existing = await games.findOne({
    $or: [
      { externalId: doc.externalId, importSource: "playstore_paid" },
      { name: doc.name, importSource: "playstore_paid" },
    ],
  });

  if (existing) {
    const patch = { lastImportedAt: new Date() };
    if (!existing.link   || existing.link.trim().length  < 5) patch.link   = doc.link;
    if (!existing.image  || existing.image.trim().length  < 5) patch.image  = doc.image;
    if (!existing.fimage || existing.fimage.trim().length < 5) patch.fimage = doc.fimage;
    if (!existing.video  || existing.video.trim().length  < 5) patch.video  = doc.video;
    if (!existing.description && doc.description) patch.description = doc.description;
    if (doc.price) patch.price = doc.price;
    await games.updateOne({ _id: existing._id }, { $set: patch });

    // ✅ Merge othername aliases
    if (doc.othername?.length) {
      const existingNames = new Set((existing.othername || []).map(n => n.toLowerCase()));
      const newNames = doc.othername.filter(n => !existingNames.has(n.toLowerCase()));
      if (newNames.length > 0) {
        await games.updateOne(
          { _id: existing._id },
          { $push: { othername: { $each: newNames } } }
        );
      }
    }

    return "updated";
  }

  await games.create(doc);
  return "inserted";
}

// ══════════════════════════════════════════════════════════════════
//  MAIN LOOP
// ══════════════════════════════════════════════════════════════════

async function runPaidPlayStoreLoop() {
  if (paidLoopRunning) return;
  paidLoopRunning    = true;
  paidStopRequested  = false;
  paidLiveLog.length = 0;

  paidLog("info", `▶ Paid Play Store import started | from page ${paidCurrentPage}`);
  let startIndex = (paidCurrentPage - 1) * 24;

  while (!paidStopRequested) {
    try {
      paidLog("info", `📋 Scraping paid chart (start=${startIndex})…`);
      paidUpdateAt();

      const entries = await scrapePaidChartPage(startIndex);

      if (!entries.length) {
        paidLog("warn", `No games at start=${startIndex} — restarting from 0`);
        startIndex = 0; paidCurrentPage = 1;
        await new Promise(r => setTimeout(r, LOOP_DELAY));
        continue;
      }

      paidLog("info", `Found ${entries.length} candidate games — checking prices…`);

      for (let i = 0; i < entries.length; i++) {
        if (paidStopRequested) break;

        const { pkgId, name } = entries[i];
        paidCurrentGame = { name, step: "fetching metadata" };
        paidLog("info", `[${i + 1}/${entries.length}] "${name}" (${pkgId})`);
        paidUpdateAt();

        try {
          paidCurrentGame.step = "checking price on Play Store";
          const meta = await fetchGameMeta(pkgId, name);

          // ── SKIP free games ───────────────────────────────────
          if (meta.isFree) {
            paidLog("info", `⏭  Skipping "${meta.name}" — appears to be free`);
            continue;
          }

          paidLog("success", `💰 Paid game detected: "${meta.name}" — ${meta.price || "unknown price"}`);

          paidCurrentGame.step = "resolving images";
          const { iconUrl, heroUrl } = await resolveImages(
            pkgId, meta.name, meta.psIcon, meta.psScreenshots
          );

          paidCurrentGame.step = "fetching APKPure download link";
          const downloadUrl = buildApkPureDownloadLink(pkgId);

          paidCurrentGame.step = "fetching YouTube trailer";
          const trailerUrl = await fetchYouTubeTrailer(meta.name);
          if (trailerUrl) paidLog("info", `🎬 Trailer: ${trailerUrl}`);

          paidCurrentGame.step = "fetching aliases";
          const othername = await fetchGameAliases(meta.name, "Mobile");

          const category = mapMobileCategory(meta.genre);

          const imagesArr = [];
          // ✅ Video first — trailer at the front of the images list
          if (trailerUrl) {
            imagesArr.push({ type: "video", url: trailerUrl, source: "youtube" });
          }
          if (iconUrl) imagesArr.push({ type: "cover",      url: iconUrl, source: "playstore_paid" });
          if (heroUrl && heroUrl !== iconUrl)
                        imagesArr.push({ type: "background", url: heroUrl, source: "playstore_paid" });
          // Screenshots — video URLs go before stills
          const ssVideos = meta.psScreenshots.filter(u => /youtube\.com|youtu\.be|\.mp4|\.webm/i.test(u));
          const ssStills = meta.psScreenshots.filter(u => !/youtube\.com|youtu\.be|\.mp4|\.webm/i.test(u));
          ssVideos.forEach(url => imagesArr.push({ type: "video",      url, source: "playstore_paid" }));
          ssStills.forEach(url => imagesArr.push({ type: "screenshot", url, source: "playstore_paid" }));

          const doc = {
            name:          meta.name,
            image:         iconUrl || "",
            fimage:        heroUrl || "",
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
            video:         trailerUrl || "",
            images:        imagesArr,
            othername,                              // ✅ all known aliases
            importSource:  "playstore_paid",
            externalId:    pkgId,
            isPaid:        true,
            price:         meta.price || "",
            lastImportedAt: new Date(),
          };

          paidCurrentGame.step = "saving to DB";
          const result = await upsertPaidGame(doc);
          if (result === "inserted") paidTotalImported++;

          paidLog(
            result === "inserted" ? "success" : "info",
            `"${meta.name}" → ${result} | ${meta.price} | icon:${iconUrl ? "✅" : "❌"} trailer:${trailerUrl ? "✅" : "❌"} | ${category} | total:${paidTotalImported}`
          );
        } catch (e) {
          paidLog("error", `Error on "${name}": ${e.message}`);
        }

        paidCurrentGame = { name: "", step: "" };
        if (!paidStopRequested) await new Promise(r => setTimeout(r, GAME_DELAY));
      }

      startIndex += 24;
      paidCurrentPage++;
      paidUpdateAt();
      if (!paidStopRequested) await new Promise(r => setTimeout(r, LOOP_DELAY));

    } catch (err) {
      paidLog("error", `Page error: ${err.message}`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  paidLoopRunning = false;
  paidCurrentGame = { name: "", step: "" };
  paidUpdateAt();
  paidLog("info", `⏹ Stopped. Total imported: ${paidTotalImported}`);
}

// ══════════════════════════════════════════════════════════════════
//  CONTROLLERS
// ══════════════════════════════════════════════════════════════════

exports.StartPaidPlayStoreImport = (req, res) => {
  if (paidLoopRunning) return res.json({ success: false, message: "Already running" });
  runPaidPlayStoreLoop().catch(err => {
    console.error("[PaidPlayStore] Fatal:", err.message);
    paidLoopRunning = false;
  });
  res.json({ success: true, message: "Paid Play Store import started" });
};

exports.StopPaidPlayStoreImport = (req, res) => {
  paidStopRequested = true;
  res.json({ success: true, message: "Stop requested" });
};

exports.PaidPlayStoreImportStatus = (req, res) => {
  res.json({
    success: true, isRunning: paidLoopRunning,
    lastPage: paidCurrentPage, totalImported: paidTotalImported,
    updatedAt: paidUpdatedAt, currentGame: paidCurrentGame,
    log: [...paidLiveLog],
  });
};

exports.ResetPaidPlayStoreImport = (req, res) => {
  if (paidLoopRunning) return res.status(400).json({ success: false, error: "Stop first" });
  paidCurrentPage = 1; paidTotalImported = 0;
  paidLiveLog.length = 0; paidUpdatedAt = null;
  res.json({ success: true, message: "Reset to page 1" });
};
