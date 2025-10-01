import axios from "axios";
import * as cheerio from "cheerio";
import puppeteer from "puppeteer";

/**
 * Fetch static HTML page with Axios
 * @param {string} url
 * @returns {Promise<CheerioStatic|null>}
 */
async function fetchStaticPage(url: string) {
  try {
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
      },
      timeout: 10000,
    });
    return cheerio.load(data);
  } catch (error) {
    console.warn(`Static fetch failed for ${url}:`, error);
    return null;
  }
}

/**
 * Fetch SPA page rendered with JS using Puppeteer
 * @param {string} url
 * @returns {Promise<CheerioStatic>}
 */
async function fetchSPAPage(url: string) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle2" });
  const content = await page.content();
  await browser.close();
  return cheerio.load(content);
}

/**
 * Basic SEO computation
 * @param {CheerioStatic} $
 * @returns {Object}
 */
function computeBasicSeoScore($: any) {
  const h1Count = $("h1").length;
  const titleLength = $("title").text().trim().length;
  const metaDescription = $('meta[name="description"]').attr("content") || "";
  const metaLength = metaDescription.length;

  return {
    h1Count,
    titleLength,
    metaDescriptionLength: metaLength,
    missingH1: h1Count === 0,
    missingMetaDescription: metaLength === 0,
  };
}

/**
 * Scrape website (static or SPA)
 * @param {string} url
 * @param {boolean} isSPA - true if the site is a SPA
 * @returns {Promise<Object|null>}
 */
export async function scrapeWebsite(url: string, isSPA = false) {
  let $ = null;

  if (isSPA) {
    $ = await fetchSPAPage(url);
  } else {
    $ = await fetchStaticPage(url);
    if (!$) {
      // fallback to SPA if static fetch fails
      console.log("Falling back to SPA rendering...");
      $ = await fetchSPAPage(url);
    }
  }

  if (!$) return null;

  // Extract SEO and structure data
  const title = $("title").text().trim();

  const metaTags = $("meta")
    .map((i, el) => ({
      name: $(el).attr("name") || $(el).attr("property") || null,
      content: $(el).attr("content") || $(el).attr("value") || null,
    }))
    .get();

  const headers = ["h1", "h2", "h3"].reduce((acc: any, tag) => {
    acc[tag] = $(tag)
      .map((i, el) => $(el).text().trim())
      .get();
    return acc;
  }, {});

  const canonical = $('link[rel="canonical"]').attr("href") || null;

  const scripts = $("script")
    .map((i, el) => {
      const src = $(el).attr("src") || null;
      const type = $(el).attr("type") || null;
      const content =
        type === "application/ld+json" ? $(el).html()?.trim() : null;
      return { src, type, content };
    })
    .get();

  return {
    url,
    title,
    metaTags,
    headers,
    canonical,
    scripts,
    seoScore: computeBasicSeoScore($),
  };
}

// const url = "https://www.daily1blog.live/";

// const data = await scrapeWebsite(url, true);

// console.log(JSON.stringify(data, null, 2));
