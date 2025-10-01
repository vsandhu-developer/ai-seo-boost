import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { PuppeteerWebBaseLoader } from "@langchain/community/document_loaders/web/puppeteer";
import { SitemapLoader } from "@langchain/community/document_loaders/web/sitemap";
import { Document } from "@langchain/core/documents"; // For type safety
import * as cheerio from "cheerio";

// A more detailed interface for our extracted data
interface PageData {
  url: string;
  wordCount: number;
  meta: any;
  headings: any;
  links: { internal: string[]; external: string[] };
  images: { src?: string; alt?: string }[];
}

// A helper function to process a single HTML document
function processHtml(html: string, url: string): Omit<PageData, "url"> {
  const $ = cheerio.load(html);

  // Extract meta tags into a more useful format
  const metaTags = $("meta")
    .map((_, el) => {
      const tag = $(el);
      const attributes: Record<string, string> = {};
      // Loop over all attributes of the meta tag
      for (const [key, value] of Object.entries(tag.attr()!)) {
        attributes[key] = value;
      }
      return attributes;
    })
    .get();

  // Extract headings with their levels
  const headings = $("h1, h2, h3, h4, h5, h6")
    .map((_, el) => {
      const tag = $(el);
      return {
        level: tag.prop("tagName")?.toLowerCase(), // 'h1', 'h2', etc.
        text: tag.text().trim(),
      };
    })
    .get();

  // Extract links and categorize them
  const internalLinks: string[] = [];
  const externalLinks: string[] = [];
  const siteHost = new URL(url).hostname;
  $("a").each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      try {
        const linkUrl = new URL(href, url); // Resolve relative URLs
        if (linkUrl.hostname === siteHost) {
          internalLinks.push(linkUrl.href);
        } else {
          externalLinks.push(linkUrl.href);
        }
      } catch (error) {
        // Ignore invalid URLs like 'mailto:' or 'javascript:void(0)'
      }
    }
  });

  // Extract images and their alt text
  const images = $("img")
    .map((_, el) => {
      const tag = $(el);
      return {
        src: tag.attr("src"),
        alt: tag.attr("alt"),
      };
    })
    .get();

  // Get word count from the body text
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const wordCount = bodyText.split(" ").length;

  return {
    wordCount,
    meta: metaTags,
    headings,
    links: { internal: internalLinks, external: externalLinks },
    images,
  };
}

interface webScraperInterface {
  url: string;
  isSPA?: boolean;
  sitemap?: boolean;
}

// Main function updated to handle multiple docs from sitemap
export async function webScraperLanggraph({
  url,
  isSPA = false,
  sitemap = false,
}: webScraperInterface): Promise<PageData[]> {
  let loader: any; // Ideally use a BaseDocumentLoader type if available
  const results: PageData[] = [];

  try {
    if (sitemap) {
      loader = new SitemapLoader(url, {
        // You can add filters here if needed
        // filter: (url) => !url.includes('/some-path-to-ignore')
      });
    } else if (isSPA) {
      loader = new PuppeteerWebBaseLoader(url);
    } else {
      loader = new CheerioWebBaseLoader(url);
    }

    const docs: Document[] = await loader.load();

    // *** CRITICAL CHANGE: Loop through all documents loaded ***
    for (const doc of docs) {
      const pageUrl = doc.metadata.source || url;
      const processedData = processHtml(doc.pageContent, pageUrl);
      results.push({
        url: pageUrl,
        ...processedData,
      });
    }

    return results;
  } catch (error) {
    console.error(`Failed to scrape ${url}:`, error);
    return []; // Return an empty array on failure
  }
}
