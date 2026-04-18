require("dotenv").config();

const axios = require("axios");
const cheerio = require("cheerio");
const Anthropic = require("@anthropic-ai/sdk");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Shared axios headers (prevents Steam/Cloudflare 403s) ────────
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.google.com/",
};

const JSON_HEADERS = {
  "User-Agent": "Mozilla/5.0",
  Accept: "application/json",
};

// ── Helpers ──────────────────────────────────────────────────────
function clean(str) {
  return str?.replace(/\s+/g, " ").trim() || "";
}

function extractDescription($, contentEl) {
  let text = "";
  contentEl.find("p").each((_, el) => {
    const t = clean($(el).text());
    if (t.length < 80 || /download|repack|install|torrent|magnet/i.test(t)) return;
    text += t + "\n\n";
  });
  return text.slice(0, 1500);
}

function extractDownloadLinks($, contentEl) {
  const links = [];
  contentEl.find("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    const text = clean($(el).text());
    const hosts = ["1fichier", "gofile", "buzzheavier", "datanodes", "filesfm", "pixeldrain", "magnet:", "torrent"];
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

// ── AI description (always available as fallback) ────────────────
async function fetchAIDescription(title) {
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{
        role: "user",
        content: `Write a short 3–5 sentence game description for "${title}". Focus on gameplay, genre, and what makes it interesting. Plain text only, no bullet points.`,
      }],
    });
    return response.content.map(b => b.text || "").join(" ").trim();
  } catch (e) {
    console.error("AI description error:", e.message);
    return "";
  }
}

// ── Steam description ────────────────────────────────────────────
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
    if (!appData) return null;

    // short_description is plain text, no HTML
    return clean(appData.short_description) || null;
  } catch (e) {
    console.error("Steam description error:", e.message);
    return null;
  }
}

// ── Parse FitGirl HTML ───────────────────────────────────────────
function parseGame(html, url) {
  const $ = cheerio.load(html);

  const title =
    clean($("h1.entry-title").text()) ||
    clean($("h1").first().text());

  const cover =
    $("img.wp-post-image").attr("src") ||
    $("meta[property='og:image']").attr("content") ||
    null;

  const contentEl = $(".entry-content").first();
  const description = extractDescription($, contentEl);

  const info = {};
  contentEl.find("li, p").each((_, el) => {
    const txt = clean($(el).text());
    ["Genres", "Languages", "Repack Size", "Original Size", "Version", "HDD Space", "Crack"].forEach(k => {
      if (txt.toLowerCase().startsWith(k.toLowerCase() + ":") && !info[k]) {
        info[k] = txt.slice(k.length + 1).trim();
      }
    });
  });

  const screenshots = [];
  contentEl.find("img").each((_, el) => {
    const src = $(el).attr("src");
    if (src && !src.includes("logo") && src !== cover && screenshots.length < 8) {
      screenshots.push(src);
    }
  });

  return {
    title,
    cover,
    description,
    info,
    screenshots,
    downloadLinks: extractDownloadLinks($, contentEl),
    magnet: extractMagnet(html),
    sourceUrl: url,
  };
}

// ── CONTROLLER: SCRAPE ───────────────────────────────────────────
exports.ScrapeGame = async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ success: false, error: "url is required" });

  try {
    const { data: html } = await axios.get(url, {
      headers: BROWSER_HEADERS,
      timeout: 15000,
    });

    const data = parseGame(html, url);

    // Fallback description: Steam → AI
    if (!data.description || data.description.length < 50) {
      const steamDesc = await fetchSteamDescription(data.title);
      if (steamDesc) {
        data.description = steamDesc;
        data.descriptionSource = "steam";
      } else {
        const aiDesc = await fetchAIDescription(data.title);
        data.description = aiDesc;
        data.descriptionSource = "ai";
      }
    } else {
      data.descriptionSource = "web";
    }

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── CONTROLLER: DESCSEARCH ───────────────────────────────────────
// Called by frontend at POST /descsearch
exports.DescSearch = async (req, res) => {
  const { gameName } = req.body;
  if (!gameName) return res.status(400).json({ success: false, error: "gameName is required" });

  const results = [];

  try {
    // 1. Try Steam short description (plain text, reliable)
    const steamDesc = await fetchSteamDescription(gameName);
    if (steamDesc) {
      results.push({ text: steamDesc, source: "steam" });
    }

    // 2. Always add AI as an option
    const aiDesc = await fetchAIDescription(gameName);
    if (aiDesc) {
      results.push({ text: aiDesc, source: "ai" });
    }

    res.json({ success: true, results });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

// ── CONTROLLER: IMAGESUGGEST ─────────────────────────────────────
exports.ImageSuggest = async (req, res) => {
  const { gameName } = req.body;
  if (!gameName) return res.status(400).json({ success: false, error: "gameName is required" });

  const results = [];

  try {
    const steamRes = await axios.get(
      `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(gameName)}&l=english&cc=US`,
      { headers: JSON_HEADERS, timeout: 10000 }
    );

    const items = steamRes.data?.items || [];

    for (const item of items.slice(0, 4)) {
      const id = item.id;
      results.push({
        title: item.name,
        cover:   `https://cdn.akamai.steamstatic.com/steam/apps/${id}/library_600x900.jpg`,
        capsule: `https://cdn.akamai.steamstatic.com/steam/apps/${id}/header.jpg`,
        hero:    `https://cdn.akamai.steamstatic.com/steam/apps/${id}/library_hero.jpg`,
        source: "steam",
      });
    }
  } catch (e) {
    console.error("ImageSuggest error:", e.message);
    // Return empty results rather than 500 — frontend handles empty gracefully
  }

  res.json({ success: true, results });
};
