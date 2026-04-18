const axios = require("axios");
const cheerio = require("cheerio");

// ── Helpers ──────────────────────────────────────────────────────────────────

function clean(str) {
  return str?.replace(/\s+/g, " ").trim() || "";
}

function extractDownloadLinks($, contentEl) {
  const links = [];
  const hosts = ["1fichier", "gofile", "buzzheavier", "datanodes", "filesfm", "pixeldrain", "torrent", "magnet:"];
  contentEl.find("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    const text = clean($(el).text());
    if (hosts.some(h => href.includes(h))) {
      links.push({ label: text || href, url: href });
    }
  });
  return links;
}

function extractMagnet(html) {
  const m = html.match(/magnet:\?[^\s"'<>]+/);
  return m ? m[0] : null;
}

function parseGame(html, url) {
  const $ = cheerio.load(html);

  // Title
  const title =
    clean($("h1.entry-title").first().text()) ||
    clean($("h1").first().text()) ||
    clean($("title").text().split("–")[0]);

  // Cover image
  const cover =
    $("img.alignleft, img.wp-post-image, .entry-content img").first().attr("src") ||
    $("meta[property='og:image']").attr("content") ||
    null;

  // OG description fallback
  const ogDesc = $("meta[property='og:description']").attr("content") || "";

  const contentEl = $(".entry-content, .post-content, article .content").first();

  // Description paragraphs
  let description = "";
  const skipPrefixes = ["Genres", "Company", "Companies", "Languages", "Original", "Repack", "Download", "Size", "HDD", "Version", "Crack"];
  contentEl.find("p").each((_, el) => {
    const txt = clean($(el).text());
    if (txt.length > 60 && !skipPrefixes.some(p => txt.startsWith(p)) && description.length < 1000) {
      description += (description ? " " : "") + txt;
    }
  });
  if (!description) description = ogDesc;

  // Structured info
  const info = {};
  const infoKeys = ["Genres", "Tags", "Companies", "Company", "Languages", "Original Size", "Repack Size", "HDD Space", "Download", "Version", "Crack"];
  contentEl.find("ul li, p").each((_, el) => {
    const txt = clean($(el).text());
    infoKeys.forEach(key => {
      if (txt.toLowerCase().startsWith(key.toLowerCase() + ":")) {
        const val = txt.slice(key.length + 1).trim();
        if (val && !info[key]) info[key] = val;
      }
    });
  });

  // Screenshots (all content images except cover)
  const screenshots = [];
  contentEl.find("img").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src") || "";
    if (src && src !== cover && !src.includes("avatar") && !src.includes("logo") &&
      (src.endsWith(".jpg") || src.endsWith(".png") || src.endsWith(".webp") || src.includes(".jpg?") || src.includes(".png?"))) {
      if (screenshots.length < 8) screenshots.push(src);
    }
  });

  const downloadLinks = extractDownloadLinks($, contentEl);
  const magnet = extractMagnet(html);

  return { title, cover, description: description.slice(0, 1500), info, screenshots, downloadLinks, magnet, sourceUrl: url, scrapedAt: new Date().toISOString() };
}

// ── Controllers ───────────────────────────────────────────────────────────────

exports.ScrapeGame = async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== "string") {
    return res.status(400).json({ success: false, error: "url is required" });
  }

  if (!url.includes("fitgirl-repacks.site") && !url.includes("gog-games") && !url.includes("steamrip")) {
    return res.status(400).json({ success: false, error: "Only fitgirl-repacks.site URLs are supported for now" });
  }

  try {
    const { data: html } = await axios.get(url, {
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.google.com/",
      },
    });

    const data = parseGame(html, url);
    res.json({ success: true, data });
  } catch (err) {
    const status = err.response?.status || 500;
    res.status(status).json({ success: false, error: `Failed to fetch: ${err.message}` });
  }
};

// Image suggestions using RAWG (free game database) + fallback to IGDB-style search
exports.ImageSuggest = async (req, res) => {
  const { gameName } = req.body;
  if (!gameName) return res.status(400).json({ success: false, error: "gameName is required" });

  const results = [];

  try {
    // Strategy 1: RAWG API (free, no key needed for basic search)
    const rawgUrl = `https://api.rawg.io/api/games?search=${encodeURIComponent(gameName)}&page_size=6&key=`;
    // Note: RAWG requires a free API key. We use SteamGridDB approach instead.

    // Strategy 2: Use Steam search + store images (Steam has great HQ images)
    const steamSearchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(gameName)}&l=english&cc=US`;

    const steamRes = await axios.get(steamSearchUrl, { timeout: 8000 });
    const items = steamRes.data?.items || [];

    for (const item of items.slice(0, 5)) {
      const appId = item.id;
      results.push({
        title: item.name,
        thumbnail: `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`,
        cover: `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`,
        hero: `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_hero.jpg`,
        capsule: `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`,
        landscape: `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/ss_${appId}.jpg`,
        appId,
        source: "steam",
      });
    }

    res.json({ success: true, results });
  } catch (err) {
    // Fallback: return placeholder suggestions with the game name embedded in search URLs
    res.json({
      success: true,
      results: [],
      tip: "Steam search failed. Try pasting direct image URLs.",
    });
  }
};
