import { tool } from "@langchain/core/tools";
import { ChatGroq } from "@langchain/groq";
import { TavilySearch } from "@langchain/tavily";
import z from "zod";
import { scrapeWebsite } from "../utils/scrape.utils";

interface getSeoDataParams {
  url: string;
  // isSPA: boolean;
  // sitemap: boolean;
}

interface SearchToolParams {
  query: string;
}

interface GenerateBlogParams {
  summary: string;
  keywords: string[];
}

export const getSeoData = tool(
  async (params) => {
    const { url } = params as getSeoDataParams;
    const data = await scrapeWebsite(url);
    return JSON.stringify(data);
  },
  {
    name: "get-seo-information",
    description:
      "This tool can be to fetch all the information for website seo details.",
    schema: z.object({
      url: z.string().describe("You can pass the url of the website here"),
      // isSPA: z
      //   .boolean()
      //   .describe(
      //     "This is a argument in this you can pass true if the website is an SPA like build using react or something."
      //   ),
      // sitemap: z
      //   .boolean()
      //   .describe(
      //     "this can be true if user has requested for the sitemap analysis of the website"
      //   ),
    }),
  }
);

export const searchTool = tool(
  async (params) => {
    const { query } = params as SearchToolParams;
    const search = new TavilySearch({
      tavilyApiKey: process.env.TAVILY_SEARCH_API as string,
      maxResults: 10,
      topic: "general",
      searchDepth: "advanced",
    });

    const result = search.invoke({
      query: query,
    });

    return result;
  },
  {
    name: "tavily-search-results",
    description:
      "You can use this tool to get information about searches from internet.",
    schema: z.object({
      searchQuery: z
        .string()
        .describe(
          "You can apss the keywords for what you are searching on internet"
        ),
    }),
  }
);

export const generateBlogs = tool(
  async (params) => {
    const { summary, keywords } = params as GenerateBlogParams;
    const llm = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: "openai/gpt-oss-120b",
      temperature: 0,
    });

    const response = await llm.invoke([
      {
        role: "system",
        content: `You are a senior content strategist and expert software engineer. Your mission is to write an engaging, insightful, and SEO-optimized blog post of approximately 800-1000 words.

          **Target Audience:** Tech executives, CTOs, and non-technical founders in Canada. The tone should be professional, authoritative, and direct.

          **Your Task:**
          You will be given a summary of a specific company and a list of target keywords. Your goal is to write a blog post that:
          1.  **Addresses a broad industry topic** relevant to the target audience.
          2.  **Seamlessly integrates the provided target keywords** naturally throughout the text.
          3.  **Subtly positions the company** (from the summary) as a thought leader and an ideal solution to the problems discussed. Do not just write an advertisement; provide genuine value.

          **Required Blog Structure:**
          - **Engaging Title:** Create a compelling title that includes the primary keyword.
          - **Introduction (The Hook):** Start with a relatable problem or a powerful statistic.
          - **The Body (The Value):** Discuss the general industry topic, using the company's services as examples.
          - **Conclusion & Call to Action (CTA):** Summarize the key takeaways and encourage readers to contact the company.`,
      },
      {
        role: "user",

        content: `Here is the company information and the keywords to target:

          **Company Summary:**
          ${summary}

          **Target Keywords:**
          - ${keywords.join("\n- ")}`,
      },
    ]);

    const blogContent = await response.content;

    console.log(blogContent);

    return blogContent;
  },
  {
    name: "generate-blogs",
    description:
      "You can use this tool to generate the blogs by using the given keywords and information.",
    schema: z.object({
      summary: z
        .string()
        .describe(
          "Here you can pass the summary information of the website and then you can generate a blog for that website."
        ),
      keywords: z
        .array(z.string())
        .describe("An array of 5-10 primary keywords the blog must target."),
    }),
  }
);
