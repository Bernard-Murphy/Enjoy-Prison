import "dotenv/config";
import express from "express";
import cors from "cors";
import indexRoutes from "./routes/index";
import searchRoutes from "./routes/search";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/index", indexRoutes);
app.use("/api/search", searchRoutes);

const PORT = process.env.PORT || 4002;
app.listen(PORT, () => {
  console.log(`Search service listening on port ${PORT}`);
});
