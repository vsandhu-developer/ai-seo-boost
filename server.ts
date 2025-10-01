import cors from "cors";
import express, {
  urlencoded,
  type Application,
  type Request,
  type Response,
} from "express";
import { main } from ".";
const app: Application = express();

app.use(express.json());
app.use(urlencoded({ extended: false }));

app.use(
  cors({
    origin: "http://localhost:5173",
  })
);

app.get("/", (req: Request, res: Response) => {
  res.json({ message: "Server is running" });
});

app.post("/getInfo", async (req: Request, res: Response) => {
  try {
    const websiteUrl = req.body.websiteUrl;

    const result = await main(websiteUrl as string);

    return res.status(200).json({ result: result });
  } catch (error) {
    console.log(error);
    return res.status(400).json({ message: "An Error Occured" });
  }
});

app.listen(3000, () => console.log("Server is up"));
