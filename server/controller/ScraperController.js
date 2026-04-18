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

// ── FIXED: Description generator (NO FAKE WEB TOOL) ───────────────────────────
async function fetchGameDescription(title) {
  console.log(`[desc] Generating description for "${title}"`);
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `Give a 3-5 sentence description of the video game "${title}". Focus on gameplay, story, and setting. Plain text only.`,
      }],
    });

    const fullText = response.content
      .map(b => (b.type === "text" ? b.text : ""))
      .filter(Boolean).join(" ").trim();

    if (fullText.length > 30) {
      return { description: fullText.slice(0, 1500), descriptionSource: "ai" };
    }
  } catch (e) {
    console.error("[desc] Failed:", e.message);
  }
  return { description: "", descriptionSource: null };
}

// ── Parse HTML ───────────────────────────────────────────────────────────────
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
    return res.status(400).json({ success: false, error: "Only supported URLs allowed" });

  try {
    const { data: html } = await axios.get(url, {
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "text/html",
      },
    });

    const data = parseGame(html, url);

    const { description, descriptionSource } = await fetchGameDescription(data.title);
    data.description = description;
    data.descriptionSource = descriptionSource;

    res.json({ success: true, data });

  } catch (err) {
    res.status(err.response?.status || 500).json({ success: false, error: err.message });
  }
};

// ── CONTROLLER: ImageSuggest (UNCHANGED) ──────────────────────────────────────
exports.ImageSuggest = async (req, res) => {
  const { gameName } = req.body;
  if (!gameName) return res.status(400).json({ success: false, error: "gameName is required" });

  const results = [];
  const headers = {
    "User-Agent": "Mozilla/5.0",
    Accept: "text/html",
  };

  try {
    const steamRes = await axios.get(
      `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(gameName)}&l=english&cc=US`
    );

    for (const item of (steamRes.data?.items || []).slice(0, 4)) {
      const id = item.id;
      results.push({
        title: item.name,
        cover: `https://cdn.akamai.steamstatic.com/steam/apps/${id}/library_600x900.jpg`,
        capsule: `https://cdn.akamai.steamstatic.com/steam/apps/${id}/header.jpg`,
        hero: `https://cdn.akamai.steamstatic.com/steam/apps/${id}/library_hero.jpg`,
        source: "steam"
      });
    }
  } catch (_) {}

  res.json({ success: true, results });
};

// ── FIXED: DescSearch ─────────────────────────────────────────────────────────
exports.DescSearch = async (req, res) => {
  const { gameName } = req.body;
  if (!gameName) return res.status(400).json({ success: false, error: "gameName is required" });

  console.log(`[descsearch] Generating descriptions for "${gameName}"`);

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: `Write 3 different descriptions of the game "${gameName}".

Return ONLY JSON:
[
  { "text": "story-focused description", "source": "ai" },
  { "text": "gameplay-focused description", "source": "ai" },
  { "text": "setting-focused description", "source": "ai" }
]`,
      }],
    });

    const rawText = response.content
      .map(b => (b.type === "text" ? b.text : ""))
      .filter(Boolean).join(" ").trim();

    const jsonMatch = rawText.match(/\[[\s\S]*\]/);

    if (jsonMatch) {
      const results = JSON.parse(jsonMatch[0]).filter(r => r.text);
      return res.json({ success: true, results });
    }

    res.json({ success: false, results: [] });

  } catch (e) {
    console.error("[descsearch] Failed:", e.message);
    res.status(500).json({ success: false, error: e.message });
  }
};