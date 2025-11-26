const { Sequelize } = require("sequelize");
const initModels = require("./models");

// 从环境变量中读取数据库配置
const { MYSQL_USERNAME, MYSQL_PASSWORD, MYSQL_ADDRESS = "localhost:3306" } = process.env;

const [host, portStr] = MYSQL_ADDRESS.split(":");
const port = portStr ? parseInt(portStr, 10) : 3306;

// 创建 Sequelize 实例
const sequelize = new Sequelize("nodejs_demo", MYSQL_USERNAME, MYSQL_PASSWORD, {
  host: host || "localhost",
  port: port || 3306,
  dialect: "mysql",
  logging: false, // 可以设置为 console.log 来查看 SQL 查询
});

// 初始化所有模型
const models = initModels(sequelize);

// ==================== 数据库初始化 ====================

async function init() {
  try {
    // 测试数据库连接
    await sequelize.authenticate();
    console.log("数据库连接成功！");

    // 同步所有模型（创建表）
    await sequelize.sync({ alter: true });
    console.log("数据库模型同步成功！");
  } catch (error) {
    console.error("数据库初始化失败:", error);
    throw error;
  }
}

// 导出 sequelize 实例、模型和初始化方法
module.exports = {
  init,
  sequelize,
  ...models,
};
