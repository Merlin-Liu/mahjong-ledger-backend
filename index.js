const fs = require("fs");
const path = require("path");
const envFile = process.env.NODE_ENV === "production" ? ".prod.env" : ".local.env";
const envPath = path.join(__dirname, envFile);
if (fs.existsSync(envPath)) {
  require("dotenv").config({ path: envPath });
}

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { init: initDB } = require("./db");
const { errorResponse } = require("./utils");

// 导入路由
const usersRouter = require("./routes/users");
const roomsRouter = require("./routes/rooms");
const transactionsRouter = require("./routes/transactions");
const qrcodeRouter = require("./routes/qrcode");

const logger = morgan("tiny");

const app = express();

// 中间件
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors());
app.use(logger);

// 首页
app.get("/", async (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// 注册路由
app.use("/api/users", usersRouter);
app.use("/api/rooms", roomsRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/qrcode", qrcodeRouter);

// 全局错误处理中间件
app.use((err, req, res) => {
  console.error("Error:", err);
  const statusCode = err.statusCode || 500;
  const message = err.message || "服务器内部错误";
  res.status(statusCode).json(errorResponse(message, statusCode));
});

const port = process.env.PORT || 80;

async function bootstrap() {
  try {
    await initDB();
    app.listen(port, () => {
      console.log(`服务器启动成功，端口: ${port}`);
    });
  } catch (error) {
    console.error("启动失败:", error);
    process.exit(1);
  }
}

bootstrap();
