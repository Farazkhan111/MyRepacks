require("dotenv").config();

const axios = require("axios");
const cheerio = require("cheerio");
const Anthropic = require("@anthropic-ai/sdk");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Helpers ─────────────────────────────────────────────────────
function clean(str) {
  return str?.replace(/\s+/g, " ").trim() || "";
}

// ✅ REAL description from page
function extractDescription($, contentEl) {
  let text = "";

  contentEl.find("p").each((_, el) => {
    const t = clean($(el).text());

    if (
      t.length < 80 ||
      /download|repack|install|torrent|magnet/i.test(t)
    ) return;

    text += t + "\n\n";
  });

  return text.slice(0, 1500);
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

// ── AI fallback ─────────────────────────────────────────────────
async function fetchGameDescription(title) {
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{
        role: "user",
        content: `Give a short 3-5 sentence description of "${title}" game.`,
      }],
    });

    return response.content.map(b => b.text || "").join(" ").trim();
  } catch {
    return "";
  }
}

// ── Steam description (REAL WEB) ────────────────────────────────
async function fetchSteamDescription(gameName) {
  try {
    const res = await axios.get(
      `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(gameName)}&l=english&cc=US`
    );

    const first = res.data?.items?.[0];
    if (!first) return null;

    const appId = first.id;

    const page = await axios.get(`https://store.steampowered.com/app/${appId}`);
    const $ = cheerio.load(page.data);

    const desc =
      clean($(".game_description_snippet").text()) ||
      clean($("#game_area_description").text());

    return desc || null;
  } catch {
    return null;
  }
}

// ── Parse HTML ─────────────────────────────────────────────────
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
    const keys = ["Genres", "Languages", "Repack Size", "Original Size", "Version"];
    keys.forEach(k => {
      if (txt.toLowerCase().startsWith(k.toLowerCase() + ":")) {
        info[k] = txt.split(":")[1]?.trim();
      }
    });
  });

  const screenshots = [];
  contentEl.find("img").each((_, el) => {
    const src = $(el).attr("src");
    if (src && !src.includes("logo") && screenshots.length < 6) {
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

// ── CONTROLLER: SCRAPE ─────────────────────────────────────────
exports.ScrapeGame = async (req, res) => {
  const { url } = req.body;

  try {
    const { data: html } = await axios.get(url);
    const data = parseGame(html, url);

    // ✅ fallback only if needed
    if (!data.description || data.description.length < 50) {
      const steamDesc = await fetchSteamDescription(data.title);

      if (steamDesc) {
        data.description = steamDesc;
        data.descriptionSource = "steam";
      } else {
        const aiDesc = await fetchGameDescription(data.title);
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

// ── DESC SEARCH (REAL + AI MIX) ────────────────────────────────
exports.DescSearch = async (req, res) => {
  const { gameName } = req.body;

  try {
    const results = [];

    // ✅ Steam first
    const steamDesc = await fetchSteamDescription(gameName);
    if (steamDesc) {
      results.push({ text: steamDesc, source: "steam" });
    }

    // ✅ AI fallback options
    const ai = await fetchGameDescription(gameName);
    if (ai) {
      results.push({ text: ai, source: "ai" });
    }

    res.json({ success: true, results });

  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

// ── IMAGE SUGGEST (unchanged) ─────────────────────────────────
exports.ImageSuggest = async (req, res) => {
  const { gameName } = req.body;

  const results = [];

  try {
    const steamRes = await axios.get(
      `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(gameName)}`
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
  } catch {}

  res.json({ success: true, results });
};