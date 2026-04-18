const axios = require("axios");
const cheerio = require("cheerio");
const Anthropic = require("@anthropic-ai/sdk");

// ── Anthropic client ──────────────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Fetch game description ────────────────────────────────────────────────────
// Priority: Steam → RAWG → AI (always guaranteed a result)
async function fetchGameDescription(title, info = {}) {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
  };

  // ── 1. Steam ──────────────────────────────────────────────────────────────
  try {
    const searchRes = await axios.get(
      `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(title)}&l=english&cc=US`,
      { timeout: 8000, headers }
    );
    const items = searchRes.data?.items || [];
    if (items.length > 0) {
      const appId = items[0].id;
      const detailRes = await axios.get(
        `https://store.steampowered.com/api/appdetails?appids=${appId}&filters=short_description,detailed_description`,
        { timeout: 8000, headers }
      );
      const appData = detailRes.data?.[appId]?.data;
      if (appData) {
        const desc =
          appData.short_description ||
          appData.detailed_description?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (desc && desc.length > 30) {
          console.log(`[desc] Got description from Steam for "${title}"`);
          return { description: desc.slice(0, 1500), descriptionSource: "steam" };
        }
      }
    }
  } catch (e) {
    console.warn("[desc] Steam failed:", e.message);
  }

  // ── 2. RAWG ───────────────────────────────────────────────────────────────
  try {
    const rawgRes = await axios.get(
      `https://api.rawg.io/api/games?search=${encodeURIComponent(title)}&page_size=1`,
      { timeout: 8000, headers }
    );
    const game = rawgRes.data?.results?.[0];
    if (game?.id) {
      const detailRes = await axios.get(
        `https://api.rawg.io/api/games/${game.id}`,
        { timeout: 8000, headers }
      );
      const desc =
        detailRes.data?.description_raw ||
        detailRes.data?.description?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (desc && desc.length > 30) {
        console.log(`[desc] Got description from RAWG for "${title}"`);
        return { description: desc.slice(0, 1500), descriptionSource: "rawg" };
      }
    }
  } catch (e) {
    console.warn("[desc] RAWG failed:", e.message);
  }

  // ── 3. AI (Anthropic Claude) — always runs if above both fail ────────────
  console.log(`[desc] Falling back to AI for "${title}"`);
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn("[desc] ANTHROPIC_API_KEY not set, skipping AI");
    } else {
      const context = Object.entries(info)
        .filter(([k]) => ["Genres", "Tags", "Companies", "Company"].includes(k))
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");

      const prompt = `Write a compelling 3-4 sentence game description for the video game "${title}"${context ? ` (${context})` : ""}.
Write it like a professional game store description — focus on gameplay, setting, and what makes it exciting and unique.
Do not mention repack, torrent, crack, or download. Plain text only, no bullet points, no headers.`;

      const message = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",  // fast + cheap for description generation
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      });

      const desc = message.content?.[0]?.text?.trim();
      if (desc && desc.length > 30) {
        console.log(`[desc] AI generated description for "${title}"`);
        return { description: desc, descriptionSource: "ai" };
      }
    }
  } catch (e) {
    console.error("[desc] AI generation failed:", e.message);
  }

  return { description: "", descriptionSource: null };
}

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
    const { description, descriptionSource } = await fetchGameDescription(data.title, data.info);
    data.description = description;
    data.descriptionSource = descriptionSource; // "steam" | "rawg" | "ai" | null

    res.json({ success: true, data });
  } catch (err) {
    const status = err.response?.status || 500;
    res.status(status).json({ success: false, error: `Failed to fetch: ${err.message}` });
  }
};

// ── Image Suggest ─────────────────────────────────────────────────────────────

exports.ImageSuggest = async (req, res) => {
  const { gameName } = req.body;
  if (!gameName) return res.status(400).json({ success: false, error: "gameName is required" });

  const results = [];
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  };

  // ── Steam ─────────────────────────────────────────────────────────────────
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
          title: `${item.name} — Screenshot`,
          cover: s.path_full,
          capsule: s.path_thumbnail,
          hero: s.path_full,
          source: "steam_screenshot",
        }));
      } catch (_) {}
      results.push(
        { title: item.name, cover: `https://cdn.akamai.steamstatic.com/steam/apps/${id}/library_600x900.jpg`, capsule: `https://cdn.akamai.steamstatic.com/steam/apps/${id}/header.jpg`, hero: `https://cdn.akamai.steamstatic.com/steam/apps/${id}/library_hero.jpg`, source: "steam" },
        ...screenshots
      );
    }
  } catch (_) {}

  // ── RAWG ──────────────────────────────────────────────────────────────────
  try {
    const rawgRes = await axios.get(
      `https://api.rawg.io/api/games?search=${encodeURIComponent(gameName)}&page_size=5`,
      { timeout: 8000, headers }
    );
    const games = rawgRes.data?.results || [];
    for (const game of games) {
      if (!game.background_image) continue;
      const ssResults = (game.short_screenshots || []).slice(1, 5).map(ss => ({
        title: `${game.name} — Screenshot`, cover: ss.image, capsule: ss.image, hero: ss.image, source: "rawg_screenshot",
      }));
      results.push(
        { title: game.name, cover: game.background_image, capsule: game.background_image, hero: game.background_image, source: "rawg" },
        ...ssResults
      );
    }
  } catch (_) {}

  // ── Bing fallback ─────────────────────────────────────────────────────────
  if (results.length < 6) {
    try {
      const bingUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(gameName + " game cover art high quality")}&qft=+filterui:imagesize-large&form=IRFLTR`;
      const { data: html } = await axios.get(bingUrl, { timeout: 10000, headers });
      const $ = cheerio.load(html);
      $("a.iusc").each((_, el) => {
        try {
          const m = $(el).attr("m");
          if (m) {
            const parsed = JSON.parse(m);
            if (parsed.murl) results.push({ title: parsed.t || gameName, cover: parsed.murl, capsule: parsed.turl || parsed.murl, hero: parsed.murl, source: "bing" });
          }
        } catch (_) {}
      });
    } catch (_) {}
  }

  const seen = new Set();
  const unique = results.filter(r => {
    if (!r.cover || seen.has(r.cover)) return false;
    seen.add(r.cover);
    return true;
  });

  res.json({ success: true, results: unique });
};