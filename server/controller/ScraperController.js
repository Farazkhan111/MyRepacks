require("dotenv").config();

const axios     = require("axios");
const cheerio   = require("cheerio");
const Anthropic  = require("@anthropic-ai/sdk");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Headers ──────────────────────────────────────────────────────
const BROWSER_HEADERS = {
  "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  Referer:           "https://www.google.com/",
};
const JSON_HEADERS = { "User-Agent": "Mozilla/5.0", Accept: "application/json" };

// ── Known torrent tracker hostnames ─────────────────────────────
const TORRENT_HOSTS = [
  "1337x", "rarbg", "nyaa", "thepiratebay", "tpb", "rutracker",
  "limetorrents", "torrentgalaxy", "torrentz2", "kickass", "kat.",
  "btdig", "fitgirl-repacks", "dodi-repacks", "gog-games",
  "scene-rls", "skidrowreloaded", "steamrip", "freegogpcgames",
];

// ── Detect if URL is a mobile game source ───────────────────────
const MOBILE_HOSTS = [
  "apkpure", "apkcombo", "apkmody", "apkmirror", "happymod",
  "an1.com", "revdl", "androidappsapk", "apkdone", "rexdl",
  "mob.org", "apknite", "apksfull", "apkgk", "apkfollow",
];

function isMobileURL(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return MOBILE_HOSTS.some(h => host.includes(h));
  } catch (_) { return false; }
}

// ── Helpers ──────────────────────────────────────────────────────
function clean(str) {
  return str?.replace(/\s+/g, " ").trim() || "";
}

// ── Extract description from ANY site ───────────────────────────
function extractDescription($, contentEl) {
  let text = "";
  const candidates = [
    contentEl,
    $("article").first(),
    $(".post-content, .entry-content, .content, .game-description, #description, .overview, .detail-desc").first(),
    $("main").first(),
  ];
  for (const el of candidates) {
    if (!el || !el.length) continue;
    el.find("p").each((_, p) => {
      const t = clean($(p).text());
      if (t.length < 60 || /download|install|torrent|magnet|click here|mirror|apk/i.test(t)) return;
      text += t + "\n\n";
    });
    if (text.length > 100) break;
  }
  return text.slice(0, 1500);
}

// ── Extract ONLY torrent / magnet links (PC games) ──────────────
function extractDownloadLinks($) {
  const links = [];
  const seen  = new Set();

  function push(label, url) {
    if (!url || seen.has(url)) return;
    seen.add(url);
    links.push({ label: label || url, url });
  }

  $("a[href]").each((_, el) => {
    const href = clean($(el).attr("href") || "");
    const text = clean($(el).text());

    if (/\.torrent(\?.*)?$/i.test(href)) { push(text || "Download .torrent", href); return; }
    if (href.startsWith("magnet:?"))      { push(text || "Magnet link", href);       return; }
    if (/[/?&=]torrent/i.test(href))      { push(text || href, href);                return; }

    try {
      const hostname = new URL(href).hostname.toLowerCase();
      if (TORRENT_HOSTS.some(h => hostname.includes(h))) push(text || href, href);
    } catch (_) {}
  });

  return links;
}

// ── Extract APK / mobile download links ─────────────────────────
function extractMobileDownloadLinks($) {
  const links = [];
  const seen  = new Set();

  function push(label, url) {
    if (!url || seen.has(url)) return;
    seen.add(url);
    links.push({ label: label || url, url });
  }

  $("a[href]").each((_, el) => {
    const href = clean($(el).attr("href") || "");
    const text = clean($(el).text());

    if (/\.apk(\?.*)?$/i.test(href))          { push(text || "Download APK", href);       return; }
    if (/download/i.test(text) && href.length > 10) { push(text, href);                   return; }
    if (/\.(obb|xapk|apks)(\?.*)?$/i.test(href))   { push(text || "Download OBB/XAPK", href); }
  });

  return links;
}

function extractMagnet(html) {
  const m = html.match(/magnet:\?[^\s"'<>]+/);
  return m ? m[0] : null;
}

// ════════════════════════════════════════════════════════════════
// ── YOUTUBE TRAILER FINDER ───────────────────────────────────────
// ════════════════════════════════════════════════════════════════

/**
 * Search YouTube for a game trailer and return the best match URL.
 *
 * Strategy (no API key needed):
 *  1. Scrape YouTube search results HTML for the query
 *     "{gameName} official trailer" (+ "android" for mobile)
 *  2. Parse the ytInitialData JSON blob embedded in the page
 *  3. Score each result — prefer "official", "trailer", publisher channels
 *  4. Return the full YouTube URL of the top result
 *
 * @param {string} gameName
 * @param {"PC"|"Mobile"} platform
 * @returns {Promise<string|null>}  e.g. "https://www.youtube.com/watch?v=xxxxx"
 */
async function fetchYouTubeTrailer(gameName, platform = "PC") {
  try {
    const platformHint = platform === "Mobile" ? "android mobile" : "PC";
    const query = `${gameName} ${platformHint} official trailer`;

    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

    const { data: html } = await axios.get(searchUrl, {
      headers: {
        ...BROWSER_HEADERS,
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeout: 12000,
    });

    // YouTube embeds its data as: var ytInitialData = {...};
    const match = html.match(/var ytInitialData\s*=\s*(\{.+?\});\s*<\/script>/s);
    if (!match) {
      console.error("YouTube: could not find ytInitialData");
      return null;
    }

    const ytData = JSON.parse(match[1]);

    // Drill into the video results array
    const contents =
      ytData?.contents
        ?.twoColumnSearchResultsRenderer
        ?.primaryContents
        ?.sectionListRenderer
        ?.contents?.[0]
        ?.itemSectionRenderer
        ?.contents || [];

    // Collect candidate videos
    const candidates = [];

    for (const item of contents) {
      const vr = item?.videoRenderer;
      if (!vr) continue;

      const videoId = vr.videoId;
      if (!videoId) continue;

      const title   = vr.title?.runs?.map(r => r.text).join("") || "";
      const channel = vr.ownerText?.runs?.map(r => r.text).join("") || "";
      const badges  = (vr.badges || []).map(b => b?.metadataBadgeRenderer?.label || "").join(" ");

      // Skip shorts (< 60 s are usually not trailers)
      const lengthText = vr.lengthText?.simpleText || "";
      if (lengthText && isShort(lengthText)) continue;

      // Score the result
      let score = 0;
      const titleLow   = title.toLowerCase();
      const channelLow = channel.toLowerCase();

      if (titleLow.includes("official trailer"))      score += 40;
      else if (titleLow.includes("trailer"))          score += 25;
      if (titleLow.includes("official"))              score += 15;
      if (titleLow.includes("gameplay"))              score += 5;
      if (titleLow.includes(gameName.toLowerCase()))  score += 20;
      if (channelLow.includes("official"))            score += 10;
      if (badges.toLowerCase().includes("official"))  score += 10;

      // Penalise reaction / review / let's play videos
      if (/reaction|review|let'?s play|walkthrough|guide|tips|how to/i.test(title)) score -= 30;

      candidates.push({ videoId, title, channel, score });
    }

    if (!candidates.length) {
      console.error("YouTube: no video candidates found");
      return null;
    }

    // Pick highest-scored candidate
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];

    console.log(`YouTube trailer found: "${best.title}" by ${best.channel} (score ${best.score})`);
    return `https://www.youtube.com/watch?v=${best.videoId}`;

  } catch (err) {
    console.error("YouTube trailer fetch error:", err.message);
    return null;
  }
}

/** Returns true if the YouTube duration string (e.g. "0:45") is under 60 seconds */
function isShort(lengthText) {
  const parts = lengthText.split(":").map(Number);
  if (parts.length === 2) {
    const [m, s] = parts;
    return m === 0 && s < 60;
  }
  return false;
}

// ════════════════════════════════════════════════════════════════


// ── Parse PC game HTML (FitGirl / DODI / any repack site) ────────
function parsePCGame(html, url) {
  const $ = cheerio.load(html);

  const title =
    clean($("h1.entry-title").text())  ||
    clean($("h1.post-title").text())   ||
    clean($("h1").first().text())      ||
    clean($("meta[property='og:title']").attr("content")) ||
    "Unknown Title";

  const cover =
    $("img.wp-post-image").attr("src")                       ||
    $("meta[property='og:image']").attr("content")           ||
    $(".post-thumbnail img, .cover img").first().attr("src") ||
    null;

  const contentEl =
    $(".entry-content").first().length   ? $(".entry-content").first()  :
    $(".post-content").first().length    ? $(".post-content").first()    :
    $(".article-content").first().length ? $(".article-content").first() :
    $("article").first().length          ? $("article").first()          :
    $("main").first();

  const description = extractDescription($, contentEl);

  const info = {};
  contentEl.find("li, p, td").each((_, el) => {
    const txt = clean($(el).text());
    ["Genres", "Genre", "Languages", "Language", "Repack Size", "Original Size",
     "Version", "HDD Space", "Crack", "Developer", "Publisher", "Release Date"].forEach(k => {
      if (txt.toLowerCase().startsWith(k.toLowerCase() + ":") && !info[k]) {
        info[k] = txt.slice(k.length + 1).trim();
      }
    });
  });

  const screenshots = [];
  contentEl.find("img").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-lazy-src");
    if (src && !src.includes("logo") && !src.includes("icon") && src !== cover && screenshots.length < 8)
      screenshots.push(src);
  });

  const downloadLinks = extractDownloadLinks($);
  const magnet        = extractMagnet(html);
  if (magnet && !downloadLinks.some(l => l.url === magnet))
    downloadLinks.unshift({ label: "Magnet link", url: magnet });

  return { title, cover, description, info, screenshots, downloadLinks, magnet, sourceUrl: url, platform: "PC" };
}

// ── Parse Mobile game HTML ───────────────────────────────────────
function parseMobileGame(html, url) {
  const $ = cheerio.load(html);

  const title =
    clean($(".title-like h1").text())          ||
    clean($("h1.game_name").text())            ||
    clean($("h1.app-name").text())             ||
    clean($(".details-app-name h1").text())    ||
    clean($("h1.title").text())                ||
    clean($("h1").first().text())              ||
    clean($("meta[property='og:title']").attr("content")) ||
    "Unknown Title";

  const cover =
    $("meta[property='og:image']").attr("content")                        ||
    $(".apk-icon img, .app-icon img, .game-icon img").first().attr("src") ||
    $(".icon img").first().attr("src")                                     ||
    null;

  const firstScreenshot =
    $(".screenshot img, .preview-img img, .ss-image img").first().attr("src") ||
    $(".game-screenshots img").first().attr("src")                             ||
    null;

  const contentEl =
    $(".description, .app-description, .detail-desc, .intro").first().length
      ? $(".description, .app-description, .detail-desc, .intro").first()
      : $("main").first();

  const description = extractDescription($, contentEl);

  const info = {};
  $(".apk-detail-info li, .info-list li, .detail-list li, table tr").each((_, el) => {
    const txt = clean($(el).text());
    ["Version", "Size", "Requires Android", "Updated", "Developer",
     "Category", "Genre", "Downloads", "Rating"].forEach(k => {
      if (txt.toLowerCase().startsWith(k.toLowerCase()) && !info[k]) {
        info[k] = txt.replace(new RegExp(k + ":?\\s*", "i"), "").trim();
      }
    });
  });

  const screenshots = [];
  $(".screenshot img, .preview-img img, .ss-image img, .game-screenshots img").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src");
    if (src && src !== cover && screenshots.length < 8) screenshots.push(src);
  });

  const downloadLinks = extractMobileDownloadLinks($);

  return {
    title, cover,
    fimage:       firstScreenshot || cover,
    description,  info, screenshots, downloadLinks,
    magnet:       null,
    sourceUrl:    url,
    platform:     "Mobile",
  };
}

// ── AI description fallback ──────────────────────────────────────
async function fetchAIDescription(title, platform = "PC") {
  try {
    const platformHint = platform === "Mobile" ? "Android mobile game" : "PC game";
    const response = await anthropic.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{
        role:    "user",
        content: `Write a short 3–5 sentence description for the ${platformHint} "${title}". Focus on gameplay, genre, and what makes it interesting. Plain text only, no bullet points.`,
      }],
    });
    return response.content.map(b => b.text || "").join(" ").trim();
  } catch (e) {
    console.error("AI description error:", e.message);
    return "";
  }
}

// ── Steam description (PC only) ──────────────────────────────────
async function fetchSteamDescription(gameName) {
  try {
    const searchRes = await axios.get(
      `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(gameName)}&l=english&cc=US`,
      { headers: JSON_HEADERS, timeout: 8000 }
    );
    const first = searchRes.data?.items?.[0];
    if (!first) return null;

    const detailRes = await axios.get(
      `https://store.steampowered.com/api/appdetails?appids=${first.id}&l=english`,
      { headers: JSON_HEADERS, timeout: 8000 }
    );
    const appData = detailRes.data?.[first.id]?.data;
    return appData ? clean(appData.short_description) || null : null;
  } catch (e) {
    console.error("Steam description error:", e.message);
    return null;
  }
}

// ── Google Play description (Mobile) ────────────────────────────
async function fetchPlayStoreDescription(gameName) {
  try {
    const searchUrl = `https://play.google.com/store/search?q=${encodeURIComponent(gameName)}&c=apps`;
    const { data: html } = await axios.get(searchUrl, { headers: BROWSER_HEADERS, timeout: 10000 });
    const $ = cheerio.load(html);
    const metaDesc = $("meta[name='description']").attr("content");
    if (metaDesc && metaDesc.length > 30) return clean(metaDesc);
    return null;
  } catch (e) {
    return null;
  }
}

// ── CONTROLLER: SCRAPE ───────────────────────────────────────────
exports.ScrapeGame = async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ success: false, error: "url is required" });

  try {
    const { data: html } = await axios.get(url, { headers: BROWSER_HEADERS, timeout: 15000 });

    const mobile = isMobileURL(url);
    const data   = mobile ? parseMobileGame(html, url) : parsePCGame(html, url);

    // ── Description fallback ──────────────────────────────────
    if (!data.description || data.description.length < 50) {
      if (mobile) {
        const playDesc = await fetchPlayStoreDescription(data.title);
        if (playDesc) { data.description = playDesc; data.descriptionSource = "playstore"; }
        else          { data.description = await fetchAIDescription(data.title, "Mobile"); data.descriptionSource = "ai"; }
      } else {
        const steamDesc = await fetchSteamDescription(data.title);
        if (steamDesc) { data.description = steamDesc; data.descriptionSource = "steam"; }
        else           { data.description = await fetchAIDescription(data.title, "PC");   data.descriptionSource = "ai"; }
      }
    } else {
      data.descriptionSource = "web";
    }

    // ── YouTube trailer ───────────────────────────────────────
    data.trailer = await fetchYouTubeTrailer(data.title, mobile ? "Mobile" : "PC");

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── CONTROLLER: DESCSEARCH ───────────────────────────────────────
exports.DescSearch = async (req, res) => {
  const { gameName, platform } = req.body;
  if (!gameName) return res.status(400).json({ success: false, error: "gameName is required" });

  const results  = [];
  const isMobile = platform === "Mobile";

  try {
    if (isMobile) {
      const playDesc = await fetchPlayStoreDescription(gameName);
      if (playDesc) results.push({ text: playDesc, source: "playstore" });
    } else {
      const steamDesc = await fetchSteamDescription(gameName);
      if (steamDesc) results.push({ text: steamDesc, source: "steam" });
    }

    const aiDesc = await fetchAIDescription(gameName, isMobile ? "Mobile" : "PC");
    if (aiDesc) results.push({ text: aiDesc, source: "ai" });

    res.json({ success: true, results });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

// ── CONTROLLER: TRAILERSEARCH ────────────────────────────────────
// POST { gameName, platform }  →  { success, trailer: "https://youtube.com/..." }
exports.TrailerSearch = async (req, res) => {
  const { gameName, platform } = req.body;
  if (!gameName) return res.status(400).json({ success: false, error: "gameName is required" });

  try {
    const trailer = await fetchYouTubeTrailer(gameName, platform || "PC");
    res.json({ success: true, trailer });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

// ── CONTROLLER: IMAGESUGGEST ─────────────────────────────────────
exports.ImageSuggest = async (req, res) => {
  const { gameName, platform } = req.body;
  if (!gameName) return res.status(400).json({ success: false, error: "gameName is required" });

  const results  = [];
  const headers  = {
    "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept:            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  };
  const isMobile = platform === "Mobile";

  if (!isMobile) {
    // ── Steam (PC only) ──────────────────────────────────────
    try {
      const steamRes = await axios.get(
        `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(gameName)}&l=english&cc=US`,
        { timeout: 8000 }
      );
      const items = steamRes.data?.items || [];
      for (const item of items.slice(0, 4)) {
        const id = item.id;
        let screenshots = [];
        try {
          const detailRes = await axios.get(
            `https://store.steampowered.com/api/appdetails?appids=${id}&filters=screenshots`,
            { timeout: 8000 }
          );
          const appData = detailRes.data?.[id]?.data;
          screenshots = (appData?.screenshots || []).slice(0, 5).map(s => ({
            title: `${item.name} — Screenshot`, cover: s.path_full,
            capsule: s.path_thumbnail, hero: s.path_full, source: "steam_screenshot",
          }));
        } catch (_) {}
        results.push(
          { title: item.name,
            cover:   `https://cdn.akamai.steamstatic.com/steam/apps/${id}/library_600x900.jpg`,
            capsule: `https://cdn.akamai.steamstatic.com/steam/apps/${id}/header.jpg`,
            hero:    `https://cdn.akamai.steamstatic.com/steam/apps/${id}/library_hero.jpg`,
            source:  "steam" },
          ...screenshots
        );
      }
    } catch (_) {}
  }

  // ── RAWG (PC + Mobile) ────────────────────────────────────
  try {
    const rawgRes = await axios.get(
      `https://api.rawg.io/api/games?search=${encodeURIComponent(gameName)}&page_size=5`,
      { timeout: 8000, headers }
    );
    const games = rawgRes.data?.results || [];
    for (const game of games) {
      if (!game.background_image) continue;
      const ssResults = (game.short_screenshots || []).slice(1, 5).map(ss => ({
        title: `${game.name} — Screenshot`, cover: ss.image, capsule: ss.image,
        hero: ss.image, source: "rawg_screenshot",
      }));
      results.push(
        { title: game.name, cover: game.background_image, capsule: game.background_image,
          hero: game.background_image, source: "rawg" },
        ...ssResults
      );
    }
  } catch (_) {}

  // ── Bing fallback ─────────────────────────────────────────
  if (results.length < 6) {
    try {
      const q = isMobile
        ? `${gameName} android game icon cover art`
        : `${gameName} game cover art high quality`;
      const bingUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(q)}&qft=+filterui:imagesize-large&form=IRFLTR`;
      const { data: html } = await axios.get(bingUrl, { timeout: 10000, headers });
      const $ = cheerio.load(html);
      $("a.iusc").each((_, el) => {
        try {
          const m = $(el).attr("m");
          if (m) {
            const parsed = JSON.parse(m);
            if (parsed.murl) results.push({
              title: parsed.t || gameName, cover: parsed.murl,
              capsule: parsed.turl || parsed.murl, hero: parsed.murl, source: "bing",
            });
          }
        } catch (_) {}
      });
    } catch (_) {}
  }

  const seen   = new Set();
  const unique = results.filter(r => {
    if (!r.cover || seen.has(r.cover)) return false;
    seen.add(r.cover);
    return true;
  });

  res.json({ success: true, results: unique });
};