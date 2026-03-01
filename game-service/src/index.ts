import "dotenv/config";
import express from "express";
import cors from "cors";
import planRoutes from "./routes/plan";
import buildRoutes from "./routes/build";
import modifyRoutes from "./routes/modify";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/plan", planRoutes);
app.use("/api/build", buildRoutes);
app.use("/api/modify", modifyRoutes);

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`Game service listening on port ${PORT}`);
});
