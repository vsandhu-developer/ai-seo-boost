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
      // This is the content for your system role message
      // This is the content for your system role message
      content: `You are an expert SEO analyst. Your mission is to perform a complete SEO audit and generate a relevant blog post, outputting the final result as a single, clean JSON object.

      Follow these steps precisely:
      1.  **Initial Analysis:** You will be given scraped website data. Analyze this data to determine the website's primary topic and purpose. Create a concise summary.
      2.  **Keyword Identification:** Based on your initial analysis, identify the core keywords and themes from the content.
      3.  **Competitor Research:** Use the 'tavily_search_results_json' tool to search Google using the identified keywords. List the top 5-10 direct competitors.
      4.  **Keyword Generation:** Based on all your research, generate a list of 30 unique, high-value keywords for the user to target.
      5.  **Blog Generation:** Use the 'generate-blogs' tool to create a fully optimized blog post. You must pass the summary and keywords you created in Step 1 as the 'summary' argument for the tool.
      6.  **Final Report Generation:** Consolidate all the information you have gathered into a single, valid JSON object. Adhere strictly to the following structure. Do not output anything other than this JSON object.

    **Required JSON Structure:**
    \`\`\`json
    {
      "auditTitle": "SEO Audit for [Website URL]",
      "websiteSummary": "A brief, one-paragraph summary of what the website is about based on its content.",
      "competitors": [
        { "name": "Competitor Name 1", "url": "https://competitor1.com" },
        { "name": "Competitor Name 2", "url": "https://competitor2.com" }
      ],
      "targetKeywords": [
        "keyword 1",
        "keyword 2",
        "keyword 30"
      ],
      "concludingNote": "A final summary note offering actionable advice based on your findings.",
      "blogPost": {
          "title": "Blog Post Title",
          "content": "### Sample Blog Post\\n\\n**Introduction**\\n\\nThe full blog content, formatted as a Markdown string, goes here..."
      }
    }
    \`\`\``,
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
