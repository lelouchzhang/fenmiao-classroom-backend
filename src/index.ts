import AgentAPI from "apminsight";
AgentAPI.config();
import express from "express";
import cors from "cors";

import { auth } from "./lib/auth.js";
import { toNodeHandler } from "better-auth/node";
// import securityMiddleware from "./middleware/security.js";
import subjectsRouter from "./routes/subjects.js";
import usersRouter from "./routes/users.js";
import classesRouter from "./routes/classes.js";
import departmentsRouter from "./routes/departments.js";
import statsRouter from "./routes/stats.js";
import enrollmentsRouter from "./routes/enrollments.js";

const app = express();
const PORT = 8000;

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);
app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());

// app.use(securityMiddleware);

app.get("/", (req, res) => res.send("Hello World"));

app.use("/api/subjects", subjectsRouter);
app.use("/api/users", usersRouter);
app.use("/api/classes", classesRouter);
app.use("/api/departments", departmentsRouter);
app.use("/api/stats", statsRouter);
app.use("/api/enrollments", enrollmentsRouter);

app.set("trust proxy", true);

app.listen(PORT, () => {
  // console.log(`Server running on port http://localhost:${PORT}`);
  console.log(`...Classroom后端已启动`);
});
