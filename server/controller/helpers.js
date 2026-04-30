// ── Shared scraping helpers used by ImportController & AutoUpdateController ──
require("dotenv").config();

const axios   = require("axios");
const cheerio = require("cheerio");

const IGDB_CLIENT_ID = process.env.IGDB_CLIENT_ID;
const IGDB_SECRET    = process.env.IGDB_CLIENT_SECRET;
const YT_API_KEY     = process.env.YOUTUBE_API_KEY;

// ── Headers ───────────────────────────────────────────────────────
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:           "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  Referer:          "https://www.google.com/",
};

const APKPURE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  Accept:           "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  Referer:          "https://apkpure.net/",
};

// ── IGDB token ────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────
// ── Smart name variant builder ───────────────────────────────────
//
// Given a raw game name (e.g. "FIFA 23 (2022) Ultimate Edition" or
// "Call of Duty Modern Warfare 2 (2022) Remastered [PC] v2.1"),
// returns an ordered array of search strings to try, from most
// specific to most general:
//
//  [1] Full original name (with year, edition, version, etc.)
//  [2] Everything before the first " - " / " – " dash separator
//  [3] Noise-stripped full name  (year/version/edition words removed)
//  [4] Noise-stripped pre-dash name
//  [5] First 3 words of the cleanest name  (only for long names)
//  [6] First 2 words of the cleanest name  (only for long names)
//
// Duplicates and results with stop-word endings are filtered out.
// Each variant is tried in order; the first one that returns a link wins.
// ─────────────────────────────────────────────────────────────────
function buildSearchVariants(rawName) {
  const variants = [];
  const seen     = new Set();

  // Add a candidate — deduplicates, validates, strips edge junk
  function add(name) {
    if (!name) return;
    let clean = name.trim()
      .replace(/\s{2,}/g, " ")
      .replace(/^[\s\-–—:,.|]+|[\s\-–—:,.|]+$/g, "")
      .trim();
    // Reject: too short, no real word letters, or already seen
    if (clean.length < 3 || !/[a-zA-Z]{2,}/.test(clean) || seen.has(clean.toLowerCase())) return;
    seen.add(clean.toLowerCase());
    variants.push(clean);
  }

  // Patterns that represent noise (NOT the core game title):
  //   years in parens/brackets, bare years, version strings, edition
  //   words, platform tags, DLC markers, anything in brackets/parens
  const NOISE = [
    /\(\s*\d{4}\s*\)/gi,                 // (2013) (2022)
    /\[\s*\d{4}\s*\]/gi,                 // [2013]
    /\b(19[7-9]\d|20\d{2})\b/g,          // bare year: 2013, 1998
    /\bv\s*\d[\d.a-z]*/gi,              // v1.0  v2.3b  v 1.5
    /\b(build|update|patch|hotfix)\s*[\d.]+/gi,
    /\b(repack(ed)?|remastered|remake|definitive|complete|ultimate|gold|goty|deluxe|premium|anniversary|enhanced|extended|legendary|platinum|royal)\b/gi,
    /\bdirector[''']?s\s*cut\b/gi,
    /\bgame\s*of\s*the\s*year\b/gi,
    /\b(edition|collection|bundle|pack|season(\s+update)?)\b/gi,
    /\b(pc|mobile|android|ios|multi\s*\d*|x64|x86|64.?bit|32.?bit)\b/gi,
    /\b\d+(\.\d+)+[a-z]?\b/g,            // 1.2.3  1.04.00
    /[+&]\s*(all\s*)?(dlc|update|patch)s?/gi,
    /\[[^\]]*\]/g,                        // [anything in brackets]
    /\([^)]*\)/g,                         // (anything in parens)
  ];

  function stripNoise(name) {
    let s = name;
    for (const rx of NOISE) s = s.replace(rx, " ");
    // After removing tokens, collapse stray dashes and extra spaces
    s = s.replace(/\s+-\s+/g, " ").replace(/\s{2,}/g, " ").trim();
    s = s.replace(/^[\-–—:,.|]+|[\-–—:,.|]+$/g, "").trim();
    return s;
  }

  // ── 1. Full original name ────────────────────────────────────────
  add(rawName);

  // ── 2. Before first dash separator " - " ────────────────────────
  const dashMatch = rawName.match(/ [-–—] /);
  const beforeDash = dashMatch
    ? rawName.slice(0, rawName.indexOf(dashMatch[0])).trim()
    : rawName;
  if (beforeDash !== rawName) add(beforeDash);

  // ── 3. Noise-stripped versions ───────────────────────────────────
  const cleanFull  = stripNoise(rawName);
  const cleanShort = stripNoise(beforeDash);

  add(cleanFull);
  if (cleanShort !== cleanFull) add(cleanShort);

  // ── 4. First 2-3 words of the cleanest short name ───────────────
  // Only for names that are long enough (4+ words).
  // Skip truncations whose last word is a stop word (avoids "Need for",
  // "Call of", "Game of", etc.)
  const STOP_WORDS = new Set([
    "the","a","an","of","in","on","at","for","to","and","or","by","with","from","into"
  ]);

  function isGoodCut(wordArr) {
    if (wordArr.length < 2) return false;
    const last = wordArr[wordArr.length - 1].toLowerCase();
    return !STOP_WORDS.has(last) && last.length > 1;
  }

  const words = cleanShort.split(/\s+/).filter(Boolean);

  if (words.length >= 4) {
    const w3 = words.slice(0, 3);
    const w2 = words.slice(0, 2);
    if (isGoodCut(w3)) add(w3.join(" "));
    if (isGoodCut(w2)) add(w2.join(" "));
  } else if (words.length === 3) {
    const w2 = words.slice(0, 2);
    if (isGoodCut(w2)) add(w2.join(" "));
  }

  return variants;
}

// ── FitGirl ───────────────────────────────────────────────────────
async function searchFitgirlPage(gameName) {
  try {
    const { data: html } = await axios.get(
      `https://fitgirl-repacks.site/?s=${encodeURIComponent(gameName)}`,
      { headers: BROWSER_HEADERS, timeout: 15000 }
    );
    const $ = cheerio.load(html);
    return $("article h1.entry-title a, article h2.entry-title a").first().attr("href") || null;
  } catch (_) { return null; }
}

async function scrapeFitgirlTorrent(pageUrl) {
  try {
    const { data: html } = await axios.get(pageUrl, { headers: BROWSER_HEADERS, timeout: 20000 });
    const magnetMatch = html.match(/magnet:\?[^\s"'<>]+/);
    if (magnetMatch) return magnetMatch[0];
    const $ = cheerio.load(html);
    let torrentFile = null;
    $("a[href]").each((_, el) => {
      if (torrentFile) return;
      const href = ($(el).attr("href") || "").trim();
      if (/\.torrent(\?.*)?$/i.test(href)) torrentFile = href;
    });
    if (torrentFile) return torrentFile;
    const TORRENT_HOSTS = ["1337x","rarbg","nyaa","thepiratebay","rutracker","limetorrents","torrentgalaxy","kickass","fitgirl-repacks","dodi-repacks","gog-games","steamrip"];
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

// Tries every name variant in order; returns first link found.
async function getFitgirlLink(gameName) {
  const variants = buildSearchVariants(gameName);
  for (const name of variants) {
    try {
      const pageUrl = await searchFitgirlPage(name);
      if (pageUrl) {
        const link = await scrapeFitgirlTorrent(pageUrl);
        if (link) return link;
      }
    } catch (_) {}
  }
  return null;
}

// ── APKPure ───────────────────────────────────────────────────────
function extractPackageId(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const seg = parts[i];
    if (seg.includes(".") && /^[a-zA-Z][a-zA-Z0-9_.]{4,}$/.test(seg)) return seg;
  }
  return null;
}

function buildApkPureDirectLink(pkgId) {
  if (!pkgId) return null;
  return `https://d.apkpure.net/b/XAPK/${pkgId}?version=latest`;
}

async function searchApkPure(gameName) {
  const searchUrls = [
    `https://apkpure.net/search?q=${encodeURIComponent(gameName)}`,
    `https://apkpure.com/search?q=${encodeURIComponent(gameName)}`,
  ];
  for (const searchUrl of searchUrls) {
    try {
      const { data: html } = await axios.get(searchUrl, { headers: APKPURE_HEADERS, timeout: 15000, maxRedirects: 5 });
      const $ = cheerio.load(html);
      let pkgId = null;
      $("a[href]").each((_, el) => {
        if (pkgId) return;
        const href = ($(el).attr("href") || "").split("?")[0].trim();
        if (/apkpure\.(net|com)\/[^/]+\/[a-zA-Z]/.test(href)) {
          try { const id = extractPackageId(new URL(href).pathname); if (id) { pkgId = id; return; } } catch (_) {}
        }
        if (/^\/[^/]+\/[a-zA-Z][a-zA-Z0-9_.]{4,}$/.test(href)) {
          const id = extractPackageId(href);
          if (id) { pkgId = id; return; }
        }
      });
      if (!pkgId) {
        const m = html.match(/data-pkg(?:name)?=["']([a-zA-Z][a-zA-Z0-9_.]{4,})["']/);
        if (m) pkgId = m[1];
      }
      if (!pkgId) {
        const m = html.match(/d\.apkpure\.net\/b\/(?:XAPK|APK)\/([a-zA-Z][a-zA-Z0-9_.]{4,})/);
        if (m) pkgId = m[1];
      }
      if (pkgId) return pkgId;
    } catch (_) {}
  }
  return null;
}

// Tries every name variant in order; returns first link found.
async function getApkPureLink(gameName) {
  const variants = buildSearchVariants(gameName);
  for (const name of variants) {
    try {
      const pkgId = await searchApkPure(name);
      if (pkgId) return buildApkPureDirectLink(pkgId);
    } catch (_) {}
  }
  return null;
}

// ── YouTube Trailer (with gameplay fallback) ───────────────────────
// 1. Search for official trailer  (tries cleanest name variants)
// 2. If nothing found, fall back to gameplay video
async function fetchYouTubeTrailer(gameName, platform) {
  const hint = platform === "Mobile" ? "android mobile" : "PC";

  // Inner helper: search YouTube for a query, return best matching video
  async function searchYouTube(query, preferredKeywords = []) {
    // Try YouTube Data API first
    if (YT_API_KEY) {
      try {
        const res = await axios.get("https://www.googleapis.com/youtube/v3/search", {
          params: { key: YT_API_KEY, q: query, part: "snippet", type: "video", maxResults: 5 },
          timeout: 8000,
        });
        const items = res.data.items || [];
        const best = items.find(i =>
          preferredKeywords.some(kw => new RegExp(kw, "i").test(i.snippet.title))
        ) || items[0];
        if (best) {
          const vid = best.id.videoId;
          return { url: `https://www.youtube.com/watch?v=${vid}`, embed: `https://www.youtube.com/embed/${vid}` };
        }
      } catch (_) {}
    }

    // Fallback: scrape YouTube search page
    try {
      const { data: html } = await axios.get(
        `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
        { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 10000 }
      );
      const match = html.match(/var ytInitialData\s*=\s*(\{.+?\});\s*<\/script>/s);
      if (match) {
        const yt       = JSON.parse(match[1]);
        const contents = yt?.contents?.twoColumnSearchResultsRenderer?.primaryContents
          ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
        // First pass: prefer keyword match in title
        for (const item of contents) {
          const vr = item?.videoRenderer;
          if (!vr?.videoId) continue;
          const title = vr.title?.runs?.map(r => r.text).join("") || "";
          if (preferredKeywords.some(kw => new RegExp(kw, "i").test(title))) {
            const vid = vr.videoId;
            return { url: `https://www.youtube.com/watch?v=${vid}`, embed: `https://www.youtube.com/embed/${vid}` };
          }
        }
        // Second pass: return any video
        for (const item of contents) {
          const vr = item?.videoRenderer;
          if (vr?.videoId) {
            const vid = vr.videoId;
            return { url: `https://www.youtube.com/watch?v=${vid}`, embed: `https://www.youtube.com/embed/${vid}` };
          }
        }
      }
    } catch (_) {}

    return null;
  }

  // Use the cleanest variant of the name for YouTube (usually the pre-dash, noise-stripped one)
  const ytVariants = buildSearchVariants(gameName);
  // Best YouTube name = first noise-stripped variant (index 2 or 3 typically),
  // but at minimum the before-dash version if available
  const ytName = ytVariants[2] || ytVariants[1] || ytVariants[0];

  // ── Step 1: official trailer ─────────────────────────────────────
  const trailerQuery = `${ytName} ${hint} official trailer`;
  const trailer = await searchYouTube(trailerQuery, ["trailer", "official"]);
  if (trailer) return { ...trailer, type: "trailer" };

  // ── Step 2: gameplay fallback ────────────────────────────────────
  const gameplayQuery = `${ytName} ${hint} gameplay`;
  const gameplay = await searchYouTube(gameplayQuery, ["gameplay"]);
  if (gameplay) return { ...gameplay, type: "gameplay" };

  return null;
}

// ── Title match checker ───────────────────────────────────────────
// Verifies the API result title actually belongs to the game we searched.
// Both names are stripped to core words (no stop/noise words), then we
// check that enough words overlap in either direction.
function titleMatches(searchName, resultName) {
  if (!resultName) return false;

  function normalize(s) {
    return s.toLowerCase()
      .replace(/[''`]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  const STOP = new Set([
    "the","a","an","of","in","on","at","for","to","and","or","by","with",
    "from","into","edition","remastered","remake","definitive","complete",
    "ultimate","gold","goty","deluxe","premium","collection","bundle",
    "pack","repack","pc","mobile","android","ios",
  ]);

  function coreWords(s) {
    return normalize(s).split(" ").filter(w => w.length > 1 && !STOP.has(w));
  }

  const sw = coreWords(searchName);
  const rw = coreWords(resultName);
  if (!sw.length || !rw.length) return false;

  // Count overlapping words (prefix match handles plurals/slight variations)
  const matched = sw.filter(w => rw.some(r => r === w || r.startsWith(w) || w.startsWith(r))).length;

  // Accept if 60%+ of search words found in result, OR 60%+ of result words found in search
  return (matched / sw.length) >= 0.6 || (matched / rw.length) >= 0.6;
}

// ── IGDB image search (tries all name variants, verifies title) ───
async function fetchIGDBImages(gameName) {
  const variants = buildSearchVariants(gameName);
  for (const name of variants) {
    try {
      const token = await getIGDBToken();
      const res   = await axios.post(
        "https://api.igdb.com/v4/games",
        `fields name,cover.url,screenshots.url,summary;
         search "${name.replace(/"/g, "")}";
         limit 5;`,
        {
          headers: {
            "Client-ID":     IGDB_CLIENT_ID,
            Authorization:  `Bearer ${token}`,
            "Content-Type": "text/plain",
          },
          timeout: 10000,
        }
      );
      const results = res.data || [];
      // Find first result that has a cover AND whose title matches what we searched
      const game = results.find(g => g.cover?.url && titleMatches(name, g.name));
      if (!game) continue;
      const cover = "https:" + game.cover.url.replace("t_thumb", "t_1080p");
      const screenshots = (game.screenshots || []).slice(0, 4).map(s =>
        "https:" + s.url.replace("t_thumb", "t_screenshot_huge")
      );
      return { cover, screenshots, summary: game.summary || null, matchedName: name, resultTitle: game.name };
    } catch (_) {}
  }
  return null;
}

// ── RAWG image/description search (tries all name variants, verifies title) ──
async function fetchRAWGData(gameName) {
  const RAWG_KEY = process.env.RAWG_API_KEY;
  const variants = buildSearchVariants(gameName);
  for (const name of variants) {
    try {
      const res = await axios.get("https://api.rawg.io/api/games", {
        params: { key: RAWG_KEY, search: name, page_size: 5 },
        timeout: 10000,
      });
      const results = res.data?.results || [];
      // Find first result that has an image AND whose title matches what we searched
      const game = results.find(g => g.background_image && titleMatches(name, g.name));
      if (!game) continue;
      // Fetch full detail for description
      let description = "";
      try {
        const detail = await axios.get(`https://api.rawg.io/api/games/${game.id}`, {
          params: { key: RAWG_KEY },
          timeout: 10000,
        });
        description = detail.data?.description_raw || "";
      } catch (_) {}
      return {
        cover:       game.background_image || null,
        background:  game.background_image_additional || game.background_image || null,
        screenshots: (game.short_screenshots || []).slice(1, 5).map(s => s.image),
        description,
        matchedName:  name,
        resultTitle:  game.name,
      };
    } catch (_) {}
  }
  return null;
}

module.exports = {
  getFitgirlLink,
  getApkPureLink,
  fetchYouTubeTrailer,
  fetchIGDBImages,
  fetchRAWGData,
  buildSearchVariants,  // exported so AutoUpdateController can log the variants
};