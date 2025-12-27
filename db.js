const { Sequelize } = require("sequelize");
const initModels = require("./models");

// 从环境变量中读取数据库配置
const { MYSQL_USERNAME, MYSQL_PASSWORD, MYSQL_DATABASE, MYSQL_ADDRESS = "localhost:3306" } = process.env;

const [host, portStr] = MYSQL_ADDRESS.split(":");
const port = portStr ? parseInt(portStr, 10) : 3306;

// 创建 Sequelize 实例
const sequelize = new Sequelize(MYSQL_DATABASE, MYSQL_USERNAME, MYSQL_PASSWORD, {
  host,
  port,
  dialect: "mysql",
  logging: false, // 可以设置为 console.log 来查看 SQL 查询
  dialectOptions: {
    charset: 'utf8mb4',
    // 注意：collate 不应该放在 dialectOptions 中，会在连接后通过 SQL 设置
  },
  define: {
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
  },
  pool: {
    max: 10, // 最大连接数
    min: 0, // 最小连接数
    acquire: 30000, // 获取连接的最大等待时间（毫秒）
    idle: 10000, // 连接空闲的最大时间（毫秒）
    evict: 1000, // 检查空闲连接的间隔（毫秒）
  },
  retry: {
    max: 3, // 最大重试次数
  },
});

// 初始化所有模型
const models = initModels(sequelize);

async function init() {
  try {
    await sequelize.authenticate();
    console.log("数据库连接成功！");
  } catch (error) {
    console.error("\n❌ 数据库初始化失败！");
    console.error("错误类型:", error.name);
    console.error("错误信息:", error.message);
    throw error;
  }
}

// 导出 sequelize 实例、模型和初始化方法
module.exports = {
  init,
  sequelize,
  ...models,
};
