const axios = require("axios");
const cheerio = require("cheerio");

// ── Helpers ──────────────────────────────────────────────────────────────────

function clean(str) {
  return str?.replace(/\s+/g, " ").trim() || "";
}

function extractDownloadLinks($, contentEl) {
  const links = [];
  // Only torrent and magnet links
  contentEl.find("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    const text = clean($(el).text());
    if (href.includes("magnet:") || href.includes("torrent") || href.endsWith(".torrent")) {
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

// ── Image Suggest — no API key needed ────────────────────────────────────────
// Pulls high-quality game images from multiple free sources:
//   1. Steam store  (cover, hero, header, screenshots)
//   2. RAWG.io      (free game DB, no key for basic search)
//   3. Bing image search scrape (fallback)

exports.ImageSuggest = async (req, res) => {
  const { gameName } = req.body;
  if (!gameName) return res.status(400).json({ success: false, error: "gameName is required" });

  const results = [];
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  };

  // ── Source 1: Steam ───────────────────────────────────────────────────────
  try {
    const steamRes = await axios.get(
      `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(gameName)}&l=english&cc=US`,
      { timeout: 8000 }
    );
    const items = steamRes.data?.items || [];

    for (const item of items.slice(0, 3)) {
      const id = item.id;
      // Fetch full app details for screenshots
      try {
        const detailRes = await axios.get(
          `https://store.steampowered.com/api/appdetails?appids=${id}&filters=screenshots,header_image`,
          { timeout: 8000 }
        );
        const appData = detailRes.data?.[id]?.data;
        const screenshots = (appData?.screenshots || []).map(s => ({
          title: `${item.name} - Screenshot`,
          imageUrl: s.path_full,
          thumbnailUrl: s.path_thumbnail,
          source: "steam_screenshot",
        }));

        results.push(
          {
            title: item.name,
            imageUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${id}/library_600x900.jpg`,
            thumbnailUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${id}/library_600x900_2x.jpg`,
            source: "steam_cover",
          },
          {
            title: item.name,
            imageUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${id}/library_hero.jpg`,
            thumbnailUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${id}/library_hero_2x.jpg`,
            source: "steam_hero",
          },
          {
            title: item.name,
            imageUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${id}/header.jpg`,
            thumbnailUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${id}/header.jpg`,
            source: "steam_header",
          },
          ...screenshots.slice(0, 5)
        );
      } catch (_) {
        // detail fetch failed, push basic images only
        results.push({
          title: item.name,
          imageUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${id}/header.jpg`,
          thumbnailUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${id}/header.jpg`,
          source: "steam_header",
        });
      }
    }
  } catch (_) { /* Steam unavailable, continue */ }

  // ── Source 2: RAWG.io (free, no key) ─────────────────────────────────────
  try {
    const rawgRes = await axios.get(
      `https://api.rawg.io/api/games?search=${encodeURIComponent(gameName)}&page_size=5`,
      { timeout: 8000, headers }
    );
    const games = rawgRes.data?.results || [];

    for (const game of games) {
      if (game.background_image) {
        results.push({
          title: game.name,
          imageUrl: game.background_image,
          thumbnailUrl: game.background_image,
          source: "rawg_background",
        });
      }
      // RAWG short_screenshots
      for (const ss of (game.short_screenshots || []).slice(0, 4)) {
        results.push({
          title: `${game.name} - Screenshot`,
          imageUrl: ss.image,
          thumbnailUrl: ss.image,
          source: "rawg_screenshot",
        });
      }
    }
  } catch (_) { /* RAWG unavailable, continue */ }

  // ── Source 3: Bing Image Search scrape (fallback) ─────────────────────────
  if (results.length < 5) {
    try {
      const bingUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(gameName + " game cover art high quality")}&qft=+filterui:imagesize-large&form=IRFLTR`;
      const { data: html } = await axios.get(bingUrl, { timeout: 10000, headers });
      const $ = cheerio.load(html);

      $("a.iusc").each((_, el) => {
        try {
          const m = $(el).attr("m");
          if (m) {
            const parsed = JSON.parse(m);
            if (parsed.murl) {
              results.push({
                title: parsed.t || gameName,
                imageUrl: parsed.murl,
                thumbnailUrl: parsed.turl || parsed.murl,
                source: "bing_image",
              });
            }
          }
        } catch (_) {}
      });
    } catch (_) { /* Bing scrape failed */ }
  }

  // Deduplicate by imageUrl
  const seen = new Set();
  const unique = results.filter(r => {
    if (!r.imageUrl || seen.has(r.imageUrl)) return false;
    seen.add(r.imageUrl);
    return true;
  });

  res.json({
    success: true,
    gameName,
    totalFound: unique.length,
    images: unique,
  });
};