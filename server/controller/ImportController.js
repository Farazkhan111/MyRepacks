require("dotenv").config();

const axios       = require("axios");
const cheerio     = require("cheerio");
const games       = require("../model/allgamesmodel");
const ImportState = require("../model/importstate");

// ── Config ────────────────────────────────────────────────────────
const RAWG_KEY       = process.env.RAWG_API_KEY;
const IGDB_CLIENT_ID = process.env.IGDB_CLIENT_ID;
const IGDB_SECRET    = process.env.IGDB_CLIENT_SECRET;
const YT_API_KEY     = process.env.YOUTUBE_API_KEY;   // optional
const PAGE_SIZE      = 20;
const LOOP_DELAY_MS  = 2000;

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  Referer:         "https://www.google.com/",
};

// ── Global loop handle ────────────────────────────────────────────
let stopRequested = false;
let loopRunning   = false;

// ── Live log ring buffer (last 60 entries, in-memory only) ────────
const LOG_MAX = 60;
const liveLog = [];   // { ts, type, msg }

function pushLog(type, msg) {
  liveLog.push({ ts: new Date().toISOString(), type, msg });
  if (liveLog.length > LOG_MAX) liveLog.shift();
  const prefix = type === "error" ? "❌" : type === "warn" ? "⚠️ " : type === "success" ? "✅" : "ℹ️ ";
  console.log(`${prefix} ${msg}`);
}

// ── Current game being processed ─────────────────────────────────
let currentGame = { name: "", platform: "", step: "" };

// ── IGDB token cache ──────────────────────────────────────────────
let igdbToken    = null;
let igdbTokenExp = 0;

async function getIGDBToken() {
  if (igdbToken && Date.now() < igdbTokenExp) return igdbToken;
  const res = await axios.post(
    `https://id.twitch.tv/oauth2/token?client_id=${IGDB_CLIENT_ID}&client_secret=${IGDB_SECRET}&grant_type=client_credentials`
  );
  igdbToken    = res.data.access_token;
  igdbTokenExp = Date.now() + res.data.expires_in * 1000 - 60000;
  return igdbToken;
}

// ══════════════════════════════════════════════════════════════════
//  CATEGORY MAPPER
//  Maps raw genre strings → canonical DB categories
// ══════════════════════════════════════════════════════════════════

const PC_CATEGORY_MAP = [
  { keys: ["role playing", "rpg", "jrpg", "action rpg"],           cat: "RPG" },
  { keys: ["open world", "sandbox", "open-world"],                  cat: "Open World" },
  { keys: ["shooter", "fps", "first-person", "third-person", "tps"], cat: "Shooter" },
  { keys: ["fight", "beat em up", "brawler", "hack and slash"],     cat: "Fighting" },
  { keys: ["horror", "survival horror"],                            cat: "Horror" },
  { keys: ["platform", "platformer", "metroidvania"],               cat: "Platformer" },
  { keys: ["stealth", "infiltration"],                              cat: "Stealth" },
  { keys: ["survival"],                                             cat: "Survival" },
  { keys: ["racing", "driving"],                                    cat: "Racing" },
  { keys: ["puzzle", "logic", "brain"],                             cat: "Puzzle" },
  { keys: ["sport", "football", "soccer", "basketball"],            cat: "Sports" },
  { keys: ["simulat", "tycoon", "farming", "city builder"],         cat: "Simulation" },
  { keys: ["strateg", "rts", "tower defense", "4x", "turn-based"], cat: "Strategy" },
  { keys: ["adventur", "exploration"],                              cat: "Adventure" },
  { keys: ["action"],                                               cat: "Action" },
  { keys: ["indie"],                                                cat: "Indie" },
  { keys: ["mmo", "massively multiplayer"],                         cat: "MMO" },
];

const MOBILE_CATEGORY_MAP = [
  { keys: ["role playing", "rpg"],                                  cat: "RPG" },
  { keys: ["shooter", "fps", "battle royale"],                      cat: "Shooter" },
  { keys: ["racing", "driving"],                                    cat: "Racing" },
  { keys: ["puzzle", "logic", "match"],                             cat: "Puzzle" },
  { keys: ["strateg", "tower defense"],                             cat: "Strategy" },
  { keys: ["simulat", "tycoon", "farming"],                         cat: "Simulation" },
  { keys: ["sport", "football", "soccer"],                          cat: "Sports" },
  { keys: ["casual", "hyper casual", "idle", "clicker"],            cat: "Casual" },
  { keys: ["arcade", "runner"],                                     cat: "Arcade" },
  { keys: ["adventur"],                                             cat: "Adventure" },
  { keys: ["action", "fight"],                                      cat: "Action" },
];

function mapCategory(raw, platform = "PC") {
  if (!raw) return platform === "Mobile" ? "Casual" : "Action";
  const g   = raw.toLowerCase();
  const map = platform === "Mobile" ? MOBILE_CATEGORY_MAP : PC_CATEGORY_MAP;
  for (const { keys, cat } of map) {
    if (keys.some(k => g.includes(k))) return cat;
  }
  // Capitalise first genre word as fallback
  return raw.split(/[,/|]/)[0].trim().replace(/\b\w/g, c => c.toUpperCase()) ||
    (platform === "Mobile" ? "Casual" : "Action");
}

// ══════════════════════════════════════════════════════════════════
//  FITGIRL TORRENT LINK FETCHER
//  For each PC game: search FitGirl by name → scrape magnet link
// ══════════════════════════════════════════════════════════════════

/**
 * Search FitGirl for a game name, return the first result page URL.
 */
async function searchFitgirlPage(gameName) {
  try {
    const { data: html } = await axios.get(
      `https://fitgirl-repacks.site/?s=${encodeURIComponent(gameName)}`,
      { headers: BROWSER_HEADERS, timeout: 15000 }
    );
    const $ = cheerio.load(html);
    const link = $("article h1.entry-title a, article h2.entry-title a").first().attr("href");
    return link || null;
  } catch (_) { return null; }
}

/**
 * Scrape a FitGirl game page and return the best torrent/magnet link.
 * Priority: magnet link > .torrent file > known host link
 */
async function scrapeFitgirlTorrent(pageUrl) {
  try {
    const { data: html } = await axios.get(pageUrl, {
      headers: BROWSER_HEADERS,
      timeout: 20000,
    });

    // 1. Magnet link (best — works without a torrent client download step)
    const magnetMatch = html.match(/magnet:\?[^\s"'<>]+/);
    if (magnetMatch) return magnetMatch[0];

    const $ = cheerio.load(html);

    // 2. Direct .torrent file link
    let torrentFile = null;
    $("a[href]").each((_, el) => {
      if (torrentFile) return;
      const href = ($(el).attr("href") || "").trim();
      if (/\.torrent(\?.*)?$/i.test(href)) torrentFile = href;
    });
    if (torrentFile) return torrentFile;

    // 3. Known repack/torrent host link
    const TORRENT_HOSTS = [
      "1337x", "rarbg", "nyaa", "thepiratebay", "rutracker",
      "limetorrents", "torrentgalaxy", "kickass", "fitgirl-repacks",
      "dodi-repacks", "gog-games", "steamrip",
    ];
    let hostLink = null;
    $("a[href]").each((_, el) => {
      if (hostLink) return;
      const href = ($(el).attr("href") || "").trim();
      if (!href.startsWith("http")) return;
      try {
        const hostname = new URL(href).hostname.toLowerCase();
        if (TORRENT_HOSTS.some(h => hostname.includes(h))) hostLink = href;
      } catch (_) {}
    });
    return hostLink || null;

  } catch (_) { return null; }
}

/**
 * getFitgirlLink(gameName)
 * Searches FitGirl for gameName and returns the best torrent/magnet link.
 * Returns null if not found.
 */
async function getFitgirlLink(gameName) {
  try {
    const pageUrl = await searchFitgirlPage(gameName);
    if (!pageUrl) {
      console.log(`  [FitGirl] No page found for "${gameName}"`);
      return null;
    }
    const link = await scrapeFitgirlTorrent(pageUrl);
    if (link) {
      const preview = link.startsWith("magnet:") ? "[magnet link]" : link.slice(0, 70);
      console.log(`  [FitGirl] ✅ "${gameName}" → ${preview}`);
    } else {
      console.log(`  [FitGirl] ⚠️  No torrent found on page for "${gameName}"`);
    }
    return link || null;
  } catch (e) {
    console.warn(`  [FitGirl] Error for "${gameName}": ${e.message}`);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════
//  APKPURE DIRECT DOWNLOAD LINK
//  Pattern: https://d.apkpure.net/b/XAPK/{packageId}?version=latest
//  Strategy:
//    1. Search apkpure.net for the game name
//    2. Extract the package ID from the first matching app URL
//    3. Build the direct CDN download link — no extra request needed
// ══════════════════════════════════════════════════════════════════

const APKPURE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  Accept:           "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  Referer:          "https://apkpure.net/",
};

/**
 * Extract a valid Android package ID from a URL path.
 * Package IDs look like: com.tencent.ig, com.dts.freefireth, jp.konami.pesam
 * They must contain at least one dot and start with a letter.
 */
function extractPackageId(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  // Walk from last segment backwards — the package ID is usually last
  for (let i = parts.length - 1; i >= 0; i--) {
    const seg = parts[i];
    if (seg.includes(".") && /^[a-zA-Z][a-zA-Z0-9_.]{4,}$/.test(seg)) {
      return seg;
    }
  }
  return null;
}

/**
 * Build the direct APKPure CDN download link from a package ID.
 * → https://d.apkpure.net/b/XAPK/com.tencent.ig?version=latest
 */
function buildApkPureDirectLink(pkgId) {
  if (!pkgId) return null;
  return `https://d.apkpure.net/b/XAPK/${pkgId}?version=latest`;
}

/**
 * Scrape the APKPure search results page and return the first
 * matching app's package ID.
 */
async function searchApkPure(gameName) {
  // APKPure uses both .com and .net — .net tends to be more accessible
  const searchUrls = [
    `https://apkpure.net/search?q=${encodeURIComponent(gameName)}`,
    `https://apkpure.com/search?q=${encodeURIComponent(gameName)}`,
  ];

  for (const searchUrl of searchUrls) {
    try {
      const { data: html } = await axios.get(searchUrl, {
        headers: APKPURE_HEADERS,
        timeout: 15000,
        maxRedirects: 5,
      });

      const $ = cheerio.load(html);
      let pkgId = null;

      // Strategy A: look for app card links in search results
      // APKPure search results have links like:
      //   /pubg-mobile/com.tencent.ig  or  https://apkpure.net/pubg-mobile/com.tencent.ig
      $("a[href]").each((_, el) => {
        if (pkgId) return;
        const href = ($(el).attr("href") || "").split("?")[0].trim();

        // Absolute URL form
        if (/apkpure\.(net|com)\/[^/]+\/[a-zA-Z]/.test(href)) {
          try {
            const id = extractPackageId(new URL(href).pathname);
            if (id) { pkgId = id; return; }
          } catch (_) {}
        }

        // Relative URL form: /game-name/com.package.id  (2-segment path)
        if (/^\/[^/]+\/[a-zA-Z][a-zA-Z0-9_.]{4,}$/.test(href)) {
          const id = extractPackageId(href);
          if (id) { pkgId = id; return; }
        }
      });

      // Strategy B: scan raw HTML for package ID patterns embedded in data attrs
      if (!pkgId) {
        const pkgMatch = html.match(/data-pkg(?:name)?=["']([a-zA-Z][a-zA-Z0-9_.]{4,})["']/);
        if (pkgMatch) pkgId = pkgMatch[1];
      }

      // Strategy C: look for the download URL pattern directly in the HTML
      if (!pkgId) {
        const dlMatch = html.match(/d\.apkpure\.net\/b\/(?:XAPK|APK)\/([a-zA-Z][a-zA-Z0-9_.]{4,})/);
        if (dlMatch) pkgId = dlMatch[1];
      }

      if (pkgId) return pkgId;

    } catch (e) {
      console.warn(`  [APKPure] Search error (${searchUrl}): ${e.message}`);
    }
  }

  return null;
}

/**
 * getApkPureLink(gameName)
 *
 * Searches APKPure for the game and returns the one-click XAPK
 * download link. Format:
 *   https://d.apkpure.net/b/XAPK/{packageId}?version=latest
 *
 * This URL triggers an immediate download when opened in a browser —
 * no extra confirmation page.
 */
async function getApkPureLink(gameName) {
  try {
    const pkgId = await searchApkPure(gameName);

    if (!pkgId) {
      console.log(`  [APKPure] ❌ No package ID found for "${gameName}"`);
      return null;
    }

    const link = buildApkPureDirectLink(pkgId);
    console.log(`  [APKPure] ✅ "${gameName}" → ${link}`);
    return link;
  } catch (e) {
    console.warn(`  [APKPure] Error for "${gameName}": ${e.message}`);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════
//  YOUTUBE TRAILER
// ══════════════════════════════════════════════════════════════════

async function fetchYouTubeTrailer(gameName, platform) {
  const hint = platform === "Mobile" ? "android mobile" : "PC";
  const q    = `${gameName} ${hint} official trailer`;

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
//  RAWG — PC GAMES
// ══════════════════════════════════════════════════════════════════

async function fetchRAWGPage(page) {
  const res = await axios.get("https://api.rawg.io/api/games", {
    params: { key: RAWG_KEY, page, page_size: PAGE_SIZE, ordering: "-added" },
    timeout: 10000,
  });
  return res.data?.results || [];
}

/**
 * mapRAWGGame(rawg)
 *
 * Converts a RAWG API game object into a DB document.
 * - Keeps RAWG images as-is (already HD: 1280×720)
 * - Searches FitGirl for the real torrent/magnet download link
 * - Maps genres to canonical category
 */
async function mapRAWGGame(rawg) {
  const genres    = (rawg.genres || []).map(g => g.name).join(", ");
  const platforms = (rawg.platforms || []).map(p => p.platform.name);

  // RAWG images are already high quality (1280×720 background images)
  const coverUrl = rawg.background_image || null;
  const heroUrl  = rawg.background_image_additional || rawg.background_image || null;

  const imagesArr = [];
  if (coverUrl) imagesArr.push({ type: "cover",      url: coverUrl, source: "rawg" });
  if (heroUrl && heroUrl !== coverUrl)
    imagesArr.push({ type: "background", url: heroUrl, source: "rawg" });
  (rawg.short_screenshots || []).slice(1, 5).forEach(ss => {
    imagesArr.push({ type: "screenshot", url: ss.image, source: "rawg" });
  });

  // ✅ Fetch real FitGirl torrent/magnet link
  const torrentLink = await getFitgirlLink(rawg.name);

  // YouTube trailer
  const trailer = await fetchYouTubeTrailer(rawg.name, "PC");

  // ✅ Proper category mapping
  const category = mapCategory(genres, "PC");

  return {
    name:          rawg.name,
    image:         coverUrl,          // original RAWG cover — preserved
    fimage:        heroUrl,           // RAWG hero/background image
    description:   "",                // RAWG list endpoint has no description
    category,                         // ✅ properly mapped
    platform:      "PC",
    genre:         genres,
    developer:     "",
    publisher:     "",
    releaseDate:   rawg.released || "",
    rating:        rawg.rating ? Math.round(rawg.rating * 10) / 10 : null,
    platforms,
    trending:      "Not Trending",
    link:          torrentLink || "", // ✅ real FitGirl magnet/torrent link
    video:         trailer?.url  || "",
    trailer:       trailer || undefined,
    images:        imagesArr,
    importSource:  "rawg",
    externalId:    String(rawg.id),
    lastImportedAt: new Date(),
  };
}

// ══════════════════════════════════════════════════════════════════
//  IGDB — MOBILE GAMES
// ══════════════════════════════════════════════════════════════════

async function fetchIGDBMobilePage(offset) {
  const token = await getIGDBToken();
  const res   = await axios.post(
    "https://api.igdb.com/v4/games",
    `fields name,summary,genres.name,first_release_date,involved_companies.company.name,
     rating,platforms.name,cover.url,screenshots.url;
     where platforms = (34,39);
     sort first_release_date desc;
     limit ${PAGE_SIZE};
     offset ${offset};`,
    {
      headers: {
        "Client-ID":     IGDB_CLIENT_ID,
        Authorization:  `Bearer ${token}`,
        "Content-Type": "text/plain",
      },
      timeout: 10000,
    }
  );
  return res.data || [];
}

/**
 * mapIGDBGame(igdb)
 *
 * Converts an IGDB API game object into a DB document.
 * - Keeps IGDB images as-is (already 1080p)
 * - Searches APKPure for the real direct APK download link
 * - Maps genres to canonical mobile category
 */
async function mapIGDBGame(igdb) {
  const genres    = (igdb.genres || []).map(g => g.name).join(", ");
  const platforms = (igdb.platforms || []).map(p => p.name);
  const devCo     = (igdb.involved_companies || []).find(ic => ic.company?.name);
  const dev       = devCo?.company?.name || "";

  // IGDB cover — upgrade to 1080p (t_thumb → t_1080p)
  const rawCover = igdb.cover?.url
    ? "https:" + igdb.cover.url.replace("t_thumb", "t_1080p")
    : null;

  const imagesArr = [];
  if (rawCover) imagesArr.push({ type: "cover", url: rawCover, source: "igdb" });
  (igdb.screenshots || []).slice(0, 4).forEach(ss => {
    const url = "https:" + ss.url.replace("t_thumb", "t_screenshot_huge");
    imagesArr.push({ type: "screenshot", url, source: "igdb" });
  });

  const releaseDate = igdb.first_release_date
    ? new Date(igdb.first_release_date * 1000).toISOString().split("T")[0]
    : "";

  // ✅ Fetch real APKPure direct download link
  const apkLink = await getApkPureLink(igdb.name);

  // YouTube trailer
  const trailer = await fetchYouTubeTrailer(igdb.name, "Mobile");

  // ✅ Proper mobile category mapping
  const category = mapCategory(genres, "Mobile");

  return {
    name:          igdb.name,
    image:         rawCover,                       // original IGDB cover — preserved
    fimage:        imagesArr[1]?.url || rawCover,  // screenshot as hero if available
    description:   igdb.summary || "",
    category,                                      // ✅ properly mapped
    platform:      "Mobile",
    genre:         genres,
    developer:     dev,
    publisher:     dev,
    releaseDate,
    rating:        igdb.rating ? Math.round(igdb.rating) / 10 : null,
    platforms,
    trending:      "Not Trending",
    link:          apkLink || "",  // ✅ real APKPure direct download link
    video:         trailer?.url || "",
    trailer:       trailer || undefined,
    images:        imagesArr,
    importSource:  "igdb",
    externalId:    String(igdb.id),
    lastImportedAt: new Date(),
  };
}

// ══════════════════════════════════════════════════════════════════
//  UPSERT — duplicate-safe save
// ══════════════════════════════════════════════════════════════════

async function upsertGame(doc) {
  const existing = await games.findOne({
    $or: [
      { externalId: doc.externalId, importSource: doc.importSource },
      { name: doc.name },
    ],
  });

  if (existing) {
    const updateFields = {
      genre:         doc.genre,
      developer:     doc.developer,
      releaseDate:   doc.releaseDate,
      rating:        doc.rating,
      platforms:     doc.platforms,
      lastImportedAt: new Date(),
    };

    // Update category if it was empty/default before
    if (!existing.category || existing.category === "Action" || existing.category === "Casual") {
      updateFields.category = doc.category;
    }

    // Update link if it was missing
    if ((!existing.link || existing.link.trim().length < 5) && doc.link) {
      updateFields.link = doc.link;
    }

    // Add trailer only if missing
    if (!existing.trailer?.url && doc.trailer?.url) {
      updateFields.trailer = doc.trailer;
      updateFields.video   = doc.video;
    }

    // Add new images that aren't stored yet
    const existingUrls = new Set((existing.images || []).map(i => i.url));
    const newImages    = (doc.images || []).filter(i => !existingUrls.has(i.url));
    if (newImages.length > 0) {
      await games.updateOne(
        { _id: existing._id },
        { $push: { images: { $each: newImages } } }
      );
    }

    await games.updateOne({ _id: existing._id }, { $set: updateFields });
    return { status: "updated" };
  }

  await games.create(doc);
  return { status: "inserted" };
}

// ══════════════════════════════════════════════════════════════════
//  STATE HELPERS
// ══════════════════════════════════════════════════════════════════

async function loadState() {
  let state = await ImportState.findById("singleton");
  if (!state) state = await ImportState.create({ _id: "singleton" });
  return state;
}

async function saveState(patch) {
  await ImportState.updateOne(
    { _id: "singleton" },
    { $set: { ...patch, updatedAt: new Date() } },
    { upsert: true }
  );
}

// ══════════════════════════════════════════════════════════════════
//  MAIN IMPORT LOOP
//  Runs continuously page by page until stopped.
//  Saves progress to DB so it can be resumed after a restart.
// ══════════════════════════════════════════════════════════════════

async function runImportLoop(platform) {
  if (loopRunning) return;
  loopRunning   = true;
  stopRequested = false;
  liveLog.length = 0; // clear log on new run

  const state  = await loadState();
  let page     = state.lastPage     || 1;
  let imported = state.totalImported || 0;

  await saveState({ isRunning: true, platform });

  const doPC     = platform === "PC"     || platform === "both";
  const doMobile = platform === "Mobile" || platform === "both";

  pushLog("info", `▶ Starting — platform: ${platform} | page: ${page} | imported so far: ${imported}`);

  while (!stopRequested) {
    try {
      // ── PC: RAWG ──────────────────────────────────────────────
      if (doPC) {
        pushLog("info", `📋 Fetching RAWG page ${page}…`);
        const rawgGames = await fetchRAWGPage(page);

        if (!rawgGames.length) {
          pushLog("warn", "RAWG: no more results — PC import complete");
          if (!doMobile) break;
        }

        for (let i = 0; i < rawgGames.length; i++) {
          if (stopRequested) break;
          const gname = rawgGames[i].name;
          currentGame = { name: gname, platform: "PC", step: "processing" };
          pushLog("info", `[PC] (${i + 1}/${rawgGames.length}) Processing "${gname}"…`);
          try {
            currentGame.step = "fetching FitGirl link";
            const doc    = await mapRAWGGame(rawgGames[i]);
            currentGame.step = "saving to DB";
            const result = await upsertGame(doc);
            if (result.status === "inserted") imported++;
            const linkStatus = doc.link ? "link ✅" : "link ❌";
            pushLog(
              result.status === "inserted" ? "success" : "info",
              `[PC] "${doc.name}" → ${result.status} | ${linkStatus} | ${doc.category} | total: ${imported}`
            );
          } catch (e) {
            pushLog("error", `[PC] Error on "${gname}": ${e.message}`);
          }
          currentGame = { name: "", platform: "", step: "" };
        }
      }

      // ── Mobile: IGDB ──────────────────────────────────────────
      if (doMobile && !stopRequested) {
        const offset = (page - 1) * PAGE_SIZE;
        pushLog("info", `📋 Fetching IGDB mobile page ${page} (offset ${offset})…`);
        const igdbGames = await fetchIGDBMobilePage(offset);

        if (!igdbGames.length) {
          pushLog("warn", "IGDB: no more results — Mobile import complete");
          if (!doPC) break;
        }

        for (let i = 0; i < igdbGames.length; i++) {
          if (stopRequested) break;
          const gname = igdbGames[i].name;
          currentGame = { name: gname, platform: "Mobile", step: "processing" };
          pushLog("info", `[Mobile] (${i + 1}/${igdbGames.length}) Processing "${gname}"…`);
          try {
            currentGame.step = "fetching APKPure link";
            const doc    = await mapIGDBGame(igdbGames[i]);
            currentGame.step = "saving to DB";
            const result = await upsertGame(doc);
            if (result.status === "inserted") imported++;
            const linkStatus = doc.link ? "link ✅" : "link ❌";
            pushLog(
              result.status === "inserted" ? "success" : "info",
              `[Mobile] "${doc.name}" → ${result.status} | ${linkStatus} | ${doc.category} | total: ${imported}`
            );
          } catch (e) {
            pushLog("error", `[Mobile] Error on "${gname}": ${e.message}`);
          }
          currentGame = { name: "", platform: "", step: "" };
        }
      }

      await saveState({ lastPage: page, totalImported: imported });
      page++;
      await new Promise(r => setTimeout(r, LOOP_DELAY_MS));

    } catch (err) {
      pushLog("error", `Error on page ${page}: ${err.message}`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  await saveState({ isRunning: false, lastPage: page, totalImported: imported });
  loopRunning = false;
  currentGame = { name: "", platform: "", step: "" };
  pushLog("info", `⏹ Stopped. Total imported: ${imported}`);
}

// ══════════════════════════════════════════════════════════════════
//  CONTROLLERS
// ══════════════════════════════════════════════════════════════════

exports.StartImport = async (req, res) => {
  if (loopRunning)
    return res.json({ success: false, message: "Import already running" });

  const platform = req.body.platform || "both";
  runImportLoop(platform).catch(err => {
    console.error("[Import] Fatal loop error:", err.message);
    loopRunning = false;
  });

  res.json({ success: true, message: "Import started", platform });
};

exports.StopImport = async (req, res) => {
  stopRequested = true;
  res.json({ success: true, message: "Stop requested — will stop after current game" });
};

exports.ImportStatus = async (req, res) => {
  try {
    const state = await loadState();
    res.json({
      success:       true,
      isRunning:     loopRunning,
      lastPage:      state.lastPage,
      totalImported: state.totalImported,
      platform:      state.platform,
      updatedAt:     state.updatedAt,
      currentGame,                          // { name, platform, step }
      log:           [...liveLog],          // last 60 log entries
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.ResetImport = async (req, res) => {
  if (loopRunning)
    return res.status(400).json({ success: false, error: "Stop import first" });

  await saveState({ lastPage: 1, lastGameIndex: 0, totalImported: 0, isRunning: false });
  res.json({ success: true, message: "Import state reset to page 1" });
};