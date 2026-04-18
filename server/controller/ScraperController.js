require("dotenv").config();

const axios = require("axios");
const cheerio = require("cheerio");
const Anthropic = require("@anthropic-ai/sdk");

// ── Anthropic client ──────────────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Helpers ───────────────────────────────────────────────────────────────────

function clean(str) {
  return str?.replace(/\s+/g, " ").trim() || "";
}

function extractDownloadLinks($, contentEl) {
  const links = [];
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

// ── Auto-fetch description on scrape (web search) ────────────────────────────
async function fetchGameDescription(title) {
  console.log(`[desc] Searching web for "${title}" | key: ${!!process.env.ANTHROPIC_API_KEY}`);
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{
        role: "user",
        content: `Search the web for the video game "${title}" and return ONLY a 3-5 sentence description of what the game is about — its gameplay, setting, and story. Plain text only. No bullet points, no headers, no website names, no platform names, no download/torrent/repack words.`,
      }],
    });
    const fullText = response.content
      .map(b => (b.type === "text" ? b.text : ""))
      .filter(Boolean).join(" ").trim();
    if (fullText.length > 30) {
      return { description: fullText.slice(0, 1500), descriptionSource: "web" };
    }
  } catch (e) {
    console.error("[desc] Failed:", e.message);
  }
  return { description: "", descriptionSource: null };
}

// ── Parse HTML from FitGirl/GOG/SteamRip ────────────────────────────────────
function parseGame(html, url) {
  const $ = cheerio.load(html);

  const title =
    clean($("h1.entry-title").first().text()) ||
    clean($("h1").first().text()) ||
    clean($("title").text().split("–")[0]);

  const cover =
    $("img.alignleft, img.wp-post-image, .entry-content img").first().attr("src") ||
    $("meta[property='og:image']").attr("content") ||
    null;

  const contentEl = $(".entry-content, .post-content, article .content").first();

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

  return { title, cover, info, screenshots, downloadLinks, magnet, sourceUrl: url, scrapedAt: new Date().toISOString() };
}

// ── CONTROLLER: ScrapeGame ────────────────────────────────────────────────────
exports.ScrapeGame = async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== "string")
    return res.status(400).json({ success: false, error: "url is required" });
  if (!url.includes("fitgirl-repacks.site") && !url.includes("gog-games") && !url.includes("steamrip"))
    return res.status(400).json({ success: false, error: "Only fitgirl-repacks.site URLs are supported for now" });

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
    const { description, descriptionSource } = await fetchGameDescription(data.title);
    data.description = description;
    data.descriptionSource = descriptionSource;
    res.json({ success: true, data });
  } catch (err) {
    res.status(err.response?.status || 500).json({ success: false, error: `Failed to fetch: ${err.message}` });
  }
};

// ── CONTROLLER: ImageSuggest ──────────────────────────────────────────────────
exports.ImageSuggest = async (req, res) => {
  const { gameName } = req.body;
  if (!gameName) return res.status(400).json({ success: false, error: "gameName is required" });

  const results = [];
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  };

  // Steam
  try {
    const steamRes = await axios.get(
      `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(gameName)}&l=english&cc=US`,
      { timeout: 8000 }
    );
    for (const item of (steamRes.data?.items || []).slice(0, 4)) {
      const id = item.id;
      let screenshots = [];
      try {
        const det = await axios.get(`https://store.steampowered.com/api/appdetails?appids=${id}&filters=screenshots`, { timeout: 8000 });
        screenshots = (det.data?.[id]?.data?.screenshots || []).slice(0, 5).map(s => ({
          title: `${item.name} — Screenshot`, cover: s.path_full, capsule: s.path_thumbnail, hero: s.path_full, source: "steam_screenshot",
        }));
      } catch (_) {}
      results.push(
        { title: item.name, cover: `https://cdn.akamai.steamstatic.com/steam/apps/${id}/library_600x900.jpg`, capsule: `https://cdn.akamai.steamstatic.com/steam/apps/${id}/header.jpg`, hero: `https://cdn.akamai.steamstatic.com/steam/apps/${id}/library_hero.jpg`, source: "steam" },
        ...screenshots
      );
    }
  } catch (_) {}

  // RAWG
  try {
    const rawgRes = await axios.get(`https://api.rawg.io/api/games?search=${encodeURIComponent(gameName)}&page_size=5`, { timeout: 8000, headers });
    for (const game of (rawgRes.data?.results || [])) {
      if (!game.background_image) continue;
      results.push(
        { title: game.name, cover: game.background_image, capsule: game.background_image, hero: game.background_image, source: "rawg" },
        ...(game.short_screenshots || []).slice(1, 5).map(ss => ({ title: `${game.name} — Screenshot`, cover: ss.image, capsule: ss.image, hero: ss.image, source: "rawg_screenshot" }))
      );
    }
  } catch (_) {}

  // Bing fallback
  if (results.length < 6) {
    try {
      const { data: html } = await axios.get(
        `https://www.bing.com/images/search?q=${encodeURIComponent(gameName + " game cover art high quality")}&qft=+filterui:imagesize-large&form=IRFLTR`,
        { timeout: 10000, headers }
      );
      const $ = cheerio.load(html);
      $("a.iusc").each((_, el) => {
        try {
          const parsed = JSON.parse($(el).attr("m") || "{}");
          if (parsed.murl) results.push({ title: parsed.t || gameName, cover: parsed.murl, capsule: parsed.turl || parsed.murl, hero: parsed.murl, source: "bing" });
        } catch (_) {}
      });
    } catch (_) {}
  }

  const seen = new Set();
  res.json({ success: true, results: results.filter(r => r.cover && !seen.has(r.cover) && seen.add(r.cover)) });
};

// ── CONTROLLER: DescSearch ────────────────────────────────────────────────────
// Returns 3 description options via Anthropic web search — called from the Description tab
exports.DescSearch = async (req, res) => {
  const { gameName } = req.body;
  if (!gameName) return res.status(400).json({ success: false, error: "gameName is required" });

  console.log(`[descsearch] Searching descriptions for "${gameName}"`);
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{
        role: "user",
        content: `Search the web for the video game "${gameName}" and find its description/overview.

Return ONLY a JSON array with 3 different description variations (each 3-5 sentences). Each should highlight different aspects: one focused on story, one on gameplay mechanics, one on setting/world.

Rules:
- Plain text only, no bullet points, no headers
- No website names, platform names, store names (no Steam, Epic, GOG, RAWG etc.)
- No words: download, torrent, crack, repack, free, piracy
- Engaging, exciting tone

Return ONLY this exact JSON — nothing before or after it:
[
  { "text": "story-focused description", "source": "web" },
  { "text": "gameplay-focused description", "source": "web" },
  { "text": "setting-focused description", "source": "web" }
]`,
      }],
    });

    const rawText = response.content
      .map(b => (b.type === "text" ? b.text : ""))
      .filter(Boolean).join(" ").trim();

    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const results = JSON.parse(jsonMatch[0]).filter(r => r.text && r.text.length > 20);
      if (results.length > 0) return res.json({ success: true, results });
    }

    // Fallback: single result from raw text
    if (rawText.length > 30) {
      return res.json({ success: true, results: [{ text: rawText.slice(0, 1000), source: "web" }] });
    }

    res.json({ success: false, results: [] });
  } catch (e) {
    console.error("[descsearch] Failed:", e.message);
    res.status(500).json({ success: false, error: e.message });
  }
};
