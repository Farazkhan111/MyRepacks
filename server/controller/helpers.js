// ── Shared scraping helpers used by ImportController & AutoUpdateController ──
require("dotenv").config();

const axios   = require("axios");
const cheerio = require("cheerio");

const IGDB_CLIENT_ID   = process.env.IGDB_CLIENT_ID;
const IGDB_SECRET      = process.env.IGDB_CLIENT_SECRET;
const YT_API_KEY       = process.env.YOUTUBE_API_KEY;
const STEAMGRIDDB_KEY  = process.env.STEAMGRIDDB_API_KEY;

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
// ─────────────────────────────────────────────────────────────────
function buildSearchVariants(rawName) {
  const variants = [];
  const seen     = new Set();

  function add(name) {
    if (!name) return;
    let clean = name.trim()
      .replace(/\s{2,}/g, " ")
      .replace(/^[\s\-–—:,.|]+|[\s\-–—:,.|]+$/g, "")
      .trim();
    if (clean.length < 3 || !/[a-zA-Z]{2,}/.test(clean) || seen.has(clean.toLowerCase())) return;
    seen.add(clean.toLowerCase());
    variants.push(clean);
  }

  const NOISE = [
    /\(\s*\d{4}\s*\)/gi,
    /\[\s*\d{4}\s*\]/gi,
    /\b(19[7-9]\d|20\d{2})\b/g,
    /\bv\s*\d[\d.a-z]*/gi,
    /\b(build|update|patch|hotfix)\s*[\d.]+/gi,
    /\b(repack(ed)?|remastered|remake|definitive|complete|ultimate|gold|goty|deluxe|premium|anniversary|enhanced|extended|legendary|platinum|royal)\b/gi,
    /\bdirector[''']?s\s*cut\b/gi,
    /\bgame\s*of\s*the\s*year\b/gi,
    /\b(edition|collection|bundle|pack|season(\s+update)?)\b/gi,
    /\b(pc|mobile|android|ios|multi\s*\d*|x64|x86|64.?bit|32.?bit)\b/gi,
    /\b\d+(\.\d+)+[a-z]?\b/g,
    /[+&]\s*(all\s*)?(dlc|update|patch)s?/gi,
    /\[[^\]]*\]/g,
    /\([^)]*\)/g,
  ];

  function stripNoise(name) {
    let s = name;
    for (const rx of NOISE) s = s.replace(rx, " ");
    s = s.replace(/\s+-\s+/g, " ").replace(/\s{2,}/g, " ").trim();
    s = s.replace(/^[\-–—:,.|]+|[\-–—:,.|]+$/g, "").trim();
    return s;
  }

  add(rawName);

  const dashMatch = rawName.match(/ [-–—] /);
  const beforeDash = dashMatch
    ? rawName.slice(0, rawName.indexOf(dashMatch[0])).trim()
    : rawName;
  if (beforeDash !== rawName) add(beforeDash);

  const cleanFull  = stripNoise(rawName);
  const cleanShort = stripNoise(beforeDash);

  add(cleanFull);
  if (cleanShort !== cleanFull) add(cleanShort);

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

// ═════════════════════════════════════════════════════════════════
// ── STEAMGRIDDB — COVER ART SOURCE (PC primary, Mobile tertiary) ─
// ═════════════════════════════════════════════════════════════════

async function searchSteamGridDB(name) {
  if (!STEAMGRIDDB_KEY) return null;

  const headers = { Authorization: `Bearer ${STEAMGRIDDB_KEY}` };

  try {
    const res = await axios.get(
      `https://www.steamgriddb.com/api/v2/search/autocomplete/${encodeURIComponent(name)}`,
      { headers, timeout: 10000 }
    );
    const results = res.data?.data || [];
    if (!results.length) return null;

    const lower = name.toLowerCase();
    return results.find(g => g.name?.toLowerCase() === lower) || results[0];
  } catch (_) {
    return null;
  }
}

async function fetchSteamGridDBImages(gameId, gameName) {
  if (!STEAMGRIDDB_KEY || !gameId) return null;

  const headers = { Authorization: `Bearer ${STEAMGRIDDB_KEY}` };
  let heroImage  = null;
  let coverImage = null;
  let logoUrl    = null;

  try {
    const heroRes = await axios.get(
      `https://www.steamgriddb.com/api/v2/heroes/game/${gameId}`,
      {
        headers,
        params: {
          styles:     "alternate,blurred,white_logo,material",
          dimensions: "1920x620,3840x1240,1600x650",
          mimes:      "image/jpeg,image/png,image/webp",
          types:      "static",
          nsfw:       "false",
          humor:      "false",
          limit:      20,
        },
        timeout: 10000,
      }
    );

    const heroes = heroRes.data?.data || [];
    if (heroes.length) {
      const withLogo = heroes.find(h => h.style === "white_logo");
      const topScore = heroes.reduce((best, h) => (!best || h.score > best.score) ? h : best, null);
      heroImage = (withLogo || topScore || heroes[0])?.url || null;
    }
  } catch (_) {}

  try {
    const gridRes = await axios.get(
      `https://www.steamgriddb.com/api/v2/grids/game/${gameId}`,
      {
        headers,
        params: {
          styles:     "alternate,white_logo,material,no_logo",
          dimensions: "600x900,920x430,460x215,342x482",
          mimes:      "image/jpeg,image/png,image/webp",
          types:      "static",
          nsfw:       "false",
          humor:      "false",
          limit:      20,
        },
        timeout: 10000,
      }
    );

    const grids = gridRes.data?.data || [];
    if (grids.length) {
      const portrait   = grids.find(g => g.height > g.width);
      const landscape  = grids.find(g => g.width > g.height);
      const topScore   = grids.reduce((best, g) => (!best || g.score > best.score) ? g : best, null);
      coverImage = (portrait || landscape || topScore || grids[0])?.url || null;
    }
  } catch (_) {}

  if (heroImage || coverImage) {
    try {
      const logoRes = await axios.get(
        `https://www.steamgriddb.com/api/v2/logos/game/${gameId}`,
        {
          headers,
          params: {
            styles: "official,white,black",
            mimes:  "image/png",
            types:  "static",
            nsfw:   "false",
            humor:  "false",
            limit:  5,
          },
          timeout: 8000,
        }
      );
      const logos = logoRes.data?.data || [];
      if (logos.length) {
        logoUrl = logos[0]?.url || null;
      }
    } catch (_) {}
  }

  if (!heroImage && !coverImage) return null;

  console.log(
    `[SteamGridDB] ✅ Images found for "${gameName}"` +
    ` | hero: ${heroImage ? "✅" : "❌"} | cover: ${coverImage ? "✅" : "❌"} | logo: ${logoUrl ? "✅" : "❌"}`
  );

  return {
    heroImage:  heroImage  || coverImage,
    coverImage: coverImage || heroImage,
    logoUrl,
    source: "steamgriddb",
  };
}

async function fetchSteamGridDBBanner(gameName) {
  if (!STEAMGRIDDB_KEY) {
    console.warn("[SteamGridDB] ⚠️  STEAMGRIDDB_API_KEY is not set — skipping SteamGridDB lookup");
    return null;
  }

  const variants = buildSearchVariants(gameName);

  for (const name of variants) {
    try {
      const game = await searchSteamGridDB(name);
      if (!game?.id) continue;

      const images = await fetchSteamGridDBImages(game.id, name);
      if (!images) continue;

      return {
        heroImage:   images.heroImage,
        coverImage:  images.coverImage,
        logoUrl:     images.logoUrl || null,
        screenshots: [],
        source:      "steamgriddb",
        matchedName: game.name,
        sgdbId:      game.id,
      };
    } catch (e) {
      if (e.response?.status !== 404) {
        console.warn(`[SteamGridDB] Fetch failed for variant "${name}": ${e.message}`);
      }
    }
  }

  console.log(`[SteamGridDB] ❌ No images found for "${gameName}" after trying ${variants.length} variant(s)`);
  return null;
}

// ═════════════════════════════════════════════════════════════════
// ── STEAM STORE — SECONDARY SOURCE (PC only) ─────────────────────
// ═════════════════════════════════════════════════════════════════

async function fetchSteamStoreBanner(gameName) {
  const variants = buildSearchVariants(gameName);

  for (const name of variants) {
    try {
      const searchRes = await axios.get(
        `https://store.steampowered.com/api/storesearch/`,
        {
          params: { term: name, l: "english", cc: "US" },
          headers: BROWSER_HEADERS,
          timeout: 10000,
        }
      );

      const items = searchRes.data?.items || [];
      if (!items.length) continue;

      const lower = name.toLowerCase();
      const best  = items.find(i => i.name?.toLowerCase() === lower) || items[0];
      if (!best?.id) continue;

      const appId       = best.id;
      const headerImage = `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`;
      const libraryHero = `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_hero.jpg`;

      let heroImage = headerImage;
      try {
        await axios.head(libraryHero, { timeout: 5000 });
        heroImage = libraryHero;
      } catch (_) {}

      console.log(`[Steam] ✅ Found banner for "${gameName}" → matched "${best.name}" (appId: ${appId})`);
      return {
        heroImage,
        coverImage: headerImage,
        screenshots: [],
        appId: String(appId),
        source: "steam",
        matchedName: best.name,
      };
    } catch (_) {}
  }

  return null;
}

// ═════════════════════════════════════════════════════════════════
// ── MASTER COVER ART FETCHER ─────────────────────────────────────
//
//  Priority order differs by platform:
//
//  PC games:
//    1. SteamGridDB  ← PRIMARY
//    2. Steam Store  ← SECONDARY
//    3. IGDB         ← TERTIARY
//    4. RAWG         ← FINAL FALLBACK
//
//  Mobile games:
//    1. IGDB         ← PRIMARY  (most accurate art for known mobile titles)
//    2. SteamGridDB  ← SECONDARY (many mobile games listed here too)
//    3. RAWG         ← FINAL FALLBACK
//    NOTE: Steam Store is skipped entirely for Mobile.
//
//  The PlayStoreImportController passes its own validated Play Store
//  images directly into the DB without calling this function.
//  This function is the fallback called ONLY when Play Store images
//  fail the reachability check.
// ═════════════════════════════════════════════════════════════════

async function fetchBannerCoverArt(gameName, platform = "PC") {
  const isMobile = platform === "Mobile";

  if (isMobile) {
    // ════════════════════════════════════════════════════════════
    // MOBILE IMAGE PRIORITY
    // ════════════════════════════════════════════════════════════

    // ── 1. IGDB (PRIMARY for Mobile) ────────────────────────────
    // Many popular mobile games (PUBG Mobile, COD Mobile, Clash of Clans,
    // Among Us, etc.) have IGDB entries with high-quality cover art.
    try {
      const igdbResult = await fetchIGDBImages(gameName);
      if (igdbResult?.cover) {
        console.log(`[IGDB] ✅ Mobile cover found for "${gameName}"`);
        return {
          coverImage:  igdbResult.cover,
          heroImage:   igdbResult.cover,
          logoUrl:     null,
          screenshots: igdbResult.screenshots || [],
          source:      "igdb",
          matchedName: igdbResult.matchedName || gameName,
          resultTitle: igdbResult.resultTitle,
        };
      }
    } catch (e) {
      console.warn(`[fetchBannerCoverArt] IGDB error for mobile "${gameName}": ${e.message}`);
    }

    // ── 2. SteamGridDB (SECONDARY for Mobile) ───────────────────
    try {
      const sgdb = await fetchSteamGridDBBanner(gameName);
      if (sgdb?.heroImage || sgdb?.coverImage) {
        return {
          coverImage:  sgdb.coverImage || sgdb.heroImage,
          heroImage:   sgdb.heroImage  || sgdb.coverImage,
          logoUrl:     sgdb.logoUrl    || null,
          screenshots: sgdb.screenshots || [],
          source:      "steamgriddb",
          matchedName: sgdb.matchedName || gameName,
          sgdbId:      sgdb.sgdbId     || null,
        };
      }
    } catch (e) {
      console.warn(`[fetchBannerCoverArt] SteamGridDB error for mobile "${gameName}": ${e.message}`);
    }

    // ── 3. RAWG (FINAL FALLBACK for Mobile) ─────────────────────
    try {
      const rawg = await fetchRAWGData(gameName);
      if (rawg?.cover) {
        console.log(`[RAWG] ✅ Mobile fallback image for "${gameName}"`);
        return {
          coverImage:  rawg.cover,
          heroImage:   rawg.background || rawg.cover,
          logoUrl:     null,
          screenshots: rawg.screenshots || [],
          source:      "rawg",
          matchedName: gameName,
        };
      }
    } catch (_) {}

    return null;
  }

  // ════════════════════════════════════════════════════════════════
  // PC IMAGE PRIORITY (unchanged)
  // ════════════════════════════════════════════════════════════════

  // ── 1. SteamGridDB (PRIMARY for PC) ───────────────────────────
  try {
    const sgdb = await fetchSteamGridDBBanner(gameName);
    if (sgdb?.heroImage || sgdb?.coverImage) {
      return {
        coverImage:  sgdb.coverImage || sgdb.heroImage,
        heroImage:   sgdb.heroImage  || sgdb.coverImage,
        logoUrl:     sgdb.logoUrl    || null,
        screenshots: sgdb.screenshots || [],
        source:      "steamgriddb",
        matchedName: sgdb.matchedName || gameName,
        sgdbId:      sgdb.sgdbId     || null,
      };
    }
  } catch (e) {
    console.warn(`[fetchBannerCoverArt] SteamGridDB error for "${gameName}": ${e.message}`);
  }

  // ── 2. Steam Store (SECONDARY for PC) ─────────────────────────
  try {
    const steam = await fetchSteamStoreBanner(gameName);
    if (steam?.coverImage) {
      return {
        coverImage:  steam.coverImage,
        heroImage:   steam.heroImage || steam.coverImage,
        logoUrl:     null,
        screenshots: [],
        source:      "steam",
        matchedName: steam.matchedName || gameName,
        appId:       steam.appId,
      };
    }
  } catch (e) {
    console.warn(`[fetchBannerCoverArt] Steam error for "${gameName}": ${e.message}`);
  }

  // ── 3. IGDB (TERTIARY for PC) ─────────────────────────────────
  try {
    const token    = await getIGDBToken();
    const variants = buildSearchVariants(gameName);

    for (const name of variants.slice(0, 3)) {
      try {
        const res = await axios.post(
          "https://api.igdb.com/v4/games",
          `fields name,cover.url,artworks.url,screenshots.url;
           search "${name.replace(/"/g, "")}";
           limit 5;`,
          {
            headers: {
              "Client-ID":    IGDB_CLIENT_ID,
              Authorization:  `Bearer ${token}`,
              "Content-Type": "text/plain",
            },
            timeout: 10000,
          }
        );

        const results = res.data || [];
        const game    = results.find(g => g.cover?.url && titleMatches(name, g.name));
        if (!game) continue;

        const artworks = (game.artworks || [])
          .map(a => "https:" + a.url.replace(/t_thumb|t_cover_small|t_720p|t_screenshot_med/, "t_1080p"))
          .filter(Boolean);

        const cover = game.cover?.url
          ? "https:" + game.cover.url.replace(/t_thumb|t_cover_small|t_cover_big/, "t_1080p")
          : null;

        const screenshots = (game.screenshots || [])
          .slice(0, 4)
          .map(s => "https:" + s.url.replace(/t_thumb|t_screenshot_med/, "t_screenshot_huge"));

        const heroImage  = artworks[0] || cover;
        const coverImage = cover || artworks[0];

        if (!coverImage) continue;

        console.log(`[IGDB] ✅ Found art for "${gameName}" → matched "${game.name}"`);
        return {
          coverImage,
          heroImage,
          logoUrl:     null,
          screenshots,
          source:      "igdb",
          matchedName: name,
          resultTitle: game.name,
        };
      } catch (_) {}
    }
  } catch (_) {}

  // ── 4. RAWG (FINAL FALLBACK for PC) ───────────────────────────
  try {
    const rawg = await fetchRAWGData(gameName);
    if (rawg?.cover) {
      console.log(`[RAWG] ✅ Fallback image found for "${gameName}"`);
      return {
        coverImage:  rawg.cover,
        heroImage:   rawg.background || rawg.cover,
        logoUrl:     null,
        screenshots: rawg.screenshots || [],
        source:      "rawg",
        matchedName: gameName,
      };
    }
  } catch (_) {}

  return null;
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
async function fetchYouTubeTrailer(gameName, platform) {
  const hint = platform === "Mobile" ? "android mobile" : "PC";

  async function searchYouTube(query, preferredKeywords = []) {
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
        for (const item of contents) {
          const vr = item?.videoRenderer;
          if (!vr?.videoId) continue;
          const title = vr.title?.runs?.map(r => r.text).join("") || "";
          if (preferredKeywords.some(kw => new RegExp(kw, "i").test(title))) {
            const vid = vr.videoId;
            return { url: `https://www.youtube.com/watch?v=${vid}`, embed: `https://www.youtube.com/embed/${vid}` };
          }
        }
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

  const ytVariants = buildSearchVariants(gameName);
  const ytName = ytVariants[2] || ytVariants[1] || ytVariants[0];

  const trailerQuery = `${ytName} ${hint} official trailer`;
  const trailer = await searchYouTube(trailerQuery, ["trailer", "official"]);
  if (trailer) return { ...trailer, type: "trailer" };

  const gameplayQuery = `${ytName} ${hint} gameplay`;
  const gameplay = await searchYouTube(gameplayQuery, ["gameplay"]);
  if (gameplay) return { ...gameplay, type: "gameplay" };

  return null;
}

// ── Title match checker ───────────────────────────────────────────
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

  const matched = sw.filter(w => rw.some(r => r === w || r.startsWith(w) || w.startsWith(r))).length;
  return (matched / sw.length) >= 0.6 || (matched / rw.length) >= 0.6;
}

// ── IGDB image search ─────────────────────────────────────────────
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

// ── RAWG image/description search ──────────────────────────────────
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
      const game = results.find(g => g.background_image && titleMatches(name, g.name));
      if (!game) continue;
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
  fetchBannerCoverArt,        // ← Master cover art fetcher
  fetchSteamGridDBBanner,     // ← SteamGridDB hero + grid images
  fetchSteamStoreBanner,      // ← Steam store header / library hero
  buildSearchVariants,
};