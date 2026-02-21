import express from "express";
import cors from "cors";
import subjectsRouter from "./routes/subjects";
import securityMiddleware from "./middleware/security";

const app = express();
const PORT = 8000;

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);
app.use(express.json());

app.use(securityMiddleware);

app.get("/", (req, res) => res.send("Hello World"));

app.use("/api/subjects", subjectsRouter);
app.set("trust proxy", true);

app.listen(PORT, () => {
  console.log(`Server running on port http://localhost:${PORT}`);
});
