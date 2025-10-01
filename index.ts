import type { AIMessage } from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { ChatGroq } from "@langchain/groq";
import { MessagesAnnotation, StateGraph } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { generateBlogs, getSeoData, searchTool } from "./src/tools/llm.tools";

const tools: StructuredToolInterface[] = [
  getSeoData,
  searchTool,
  generateBlogs,
];
const toolNode = new ToolNode(tools);

// export const llm = new ChatGoogleGenerativeAI({
//   apiKey: process.env.GEMINI_API_KEY as string,
//   model: "gemini-2.5-pro",
// }).bindTools(tools);

export const llm = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY as string,
  model: "openai/gpt-oss-20b",
  temperature: 0,
}).bindTools(tools);

async function callModel(state: typeof MessagesAnnotation.State) {
  const response = await llm.invoke([
    {
      role: "system",
      content:
        'You are an expert SEO analyst and strategist. Your mission is to perform a complete, data-driven SEO audit for a given URL and generate a strategic content plan. You must follow the steps below in order, use your tools when instructed, and output the final result as a single, clean JSON object without any other text.\n\n**Step-by-Step Instructions:**\n\n1.  **Data Acquisition:** You will be given a website URL. Your absolute first step is to use the `get-seo-information` tool with that URL to get the website\'s scraped data.\n\n2.  **Initial Analysis:** Analyze the scraped data. Create a concise summary of the business, its primary services, location, and target audience. Identify 2-3 broad \'seed\' keywords from this analysis to use for competitor research.\n\n3.  **Competitor Research:** Use the `tavily_search_results_json` tool with the \'seed\' keywords you just identified. Your goal is to find the top 5-7 ranking competitor websites. **You must use the search tool and not invent competitors.** From the search results, list the URLs and names of the top competitors.\n\n4.  **Strategic Keyword Generation:** Based on your analysis of the user\'s site and the competitor data from your search, generate two distinct lists of keywords:\n    * **A. Must-Have Keywords (10):** Analyze the titles and content of the top competitors you found. Identify and list the 10 most important, high-volume keywords that these top sites are ranking for. These are the foundational keywords for the industry.\n    * **B. Nice-to-Have Keywords (20):** Based on the user\'s website summary, generate 20 long-tail, location-specific, or question-based keywords. Combine themes from the \'must-have\' list with specific details about the user\'s business (e.g., \'AI automation for startups in Toronto\', \'how much does custom software cost in Canada?\').\n\n5.  **Blog Generation:** Use the `generate-blogs` tool to create one fully optimized blog post. For the tool\'s `keywords` argument, you must pass an array containing 2-3 of the most important \'must-have\' keywords and 1-2 relevant \'nice-to-have\' keywords.\n\n6.  **Final Report Generation:** Consolidate all the information you have gathered into a single, valid JSON object. Adhere strictly to the structure below. Do not output anything else.\n\n**Required JSON Structure:**\n```json\n{\n  "auditTitle": "SEO Audit for [Website URL]",\n  "websiteSummary": "A brief, one-paragraph summary of what the website is about, including its main services and target audience.",\n  "competitors": [\n    { "name": "Competitor Name 1", "url": "[https://competitor1.com](https://competitor1.com)" },\n    { "name": "Competitor Name 2", "url": "[https://competitor2.com](https://competitor2.com)" }\n  ],\n  "targetKeywords": {\n    "mustHave": [\n      "high-competition keyword 1",\n      "high-competition keyword 2",\n      "high-competition keyword 10"\n    ],\n    "niceToHave": [\n      "long-tail or local keyword 1",\n      "long-tail or local keyword 2",\n      "long-tail or local keyword 20"\n    ]\n  },\n  "concludingNote": "A final summary note offering actionable advice based on the competitor and keyword findings.",\n  "blogPost": {\n      "title": "Generated Blog Post Title",\n      "content": "### Title\\n\\n**Introduction**\\n\\nThe full blog content, formatted as a Markdown string, goes here..."\n  }\n}\n```',
    },
    ...state.messages,
  ]);

  return { messages: [response] };
}

async function shouldContinue({ messages }: typeof MessagesAnnotation.State) {
  const lastMessage = messages[messages.length - 1] as AIMessage;

  if (lastMessage.tool_calls?.length) {
    return "tools";
  }

  return "__end__";
}

const workflow = new StateGraph(MessagesAnnotation)
  .addNode("agent", callModel)
  .addNode("tools", toolNode)
  .addEdge("__start__", "agent")
  .addEdge("tools", "agent")
  .addConditionalEdges("agent", shouldContinue);

const app = workflow.compile();

export async function main(websiteUrl: string) {
  console.log("Starting main for:", websiteUrl);

  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is missing in environment!");
  }

  try {
    const response = await app.invoke({
      messages: [
        {
          role: "user",
          content: `This is the url of my website ${websiteUrl} please check the website and please check let me know the complete information`,
        },
      ],
    });

    // console.log("Invoke response:", response);

    const lastMessage =
      response.messages[response.messages.length - 1]?.content;
    return JSON.stringify(lastMessage);
  } catch (err) {
    console.error("Error in main:", err);
    throw err; // rethrow to catch in self-invoking function
  }
}

main("https://codepaper.com/");
