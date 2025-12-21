const path = require("path");
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
app.use((err, req, res, next) => {
  console.error("Error:", err);

  // 处理 Sequelize 唯一约束错误（重复键错误）
  if (err.name === 'SequelizeUniqueConstraintError') {
    const field = err.errors && err.errors[0] ? err.errors[0].path : '字段';
    console.error(`唯一约束错误: ${field} 已存在`, {
      field: err.errors && err.errors[0] ? err.errors[0].path : null,
      value: err.errors && err.errors[0] ? err.errors[0].value : null,
    });
    // 返回 409 Conflict 状态码，表示资源冲突
    return res.status(409).json(errorResponse(`${field} 已存在，请勿重复创建`, 409));
  }

  // 处理数据库连接错误
  if (err.name === 'SequelizeDatabaseError' || err.original) {
    const originalError = err.original || err;

    // 数据库连接重置错误
    if (originalError.code === 'ECONNRESET' ||
      originalError.code === 'ECONNREFUSED' ||
      originalError.code === 'ETIMEDOUT' ||
      originalError.errno === -104) {
      console.error("数据库连接错误:", originalError.code, originalError.message);
      return res.status(503).json(errorResponse("数据库连接异常，请稍后重试", 503));
    }

    // 数据库恢复中
    if (originalError.message && (
      originalError.message.includes('resuming') ||
      originalError.message.includes('CynosDB') ||
      originalError.message.includes('恢复中')
    )) {
      return res.status(503).json(errorResponse("数据库正在恢复中，请稍后重试", 503));
    }

    // 其他数据库错误
    console.error("数据库错误详情:", {
      name: err.name,
      message: err.message,
      original: originalError.message,
      code: originalError.code,
      sql: err.sql
    });
  }

  // 默认错误处理
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
