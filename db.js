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
  charset: 'utf8mb4',
  collate: 'utf8mb4_unicode_ci',
  dialectOptions: {
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
  },
});

// 初始化所有模型
const models = initModels(sequelize);

async function init() {

  try {
    // 测试数据库连接
    await sequelize.authenticate();
    console.log("数据库连接成功！");

    // 自动转换数据库和表的字符集为 utf8mb4（支持 emoji）
    try {
      // 1. 修改数据库字符集
      await sequelize.query("ALTER DATABASE nodejs_demo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci", {
        raw: true
      });
      console.log("数据库字符集已转换为 utf8mb4");

      // 2. 修改所有表的字符集
      const tables = ['users', 'rooms', 'room_members', 'transactions'];
      for (const table of tables) {
        try {
          await sequelize.query(`ALTER TABLE ${table} CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`, {
            raw: true
          });
          console.log(`表 ${table} 字符集已转换为 utf8mb4`);
        } catch (tableError) {
          // 如果表不存在，忽略错误（可能在首次创建时）
          if (tableError.message && tableError.message.includes("doesn't exist")) {
            console.log(`表 ${table} 不存在，跳过字符集转换`);
          } else {
            console.warn(`转换表 ${table} 字符集时出错:`, tableError.message);
          }
        }
      }
    } catch (charsetError) {
      // 字符集转换失败不影响后续操作，只记录警告
      console.warn("字符集转换警告（可能已转换过）:", charsetError.message);
    }

    // 同步数据库表结构，忽略不存在的约束错误
    try {
      await sequelize.sync({ alter: true });
      console.log("数据库表已重建完成！");
    } catch (syncError) {
      // 如果是不存在的约束错误，可以忽略（约束不存在时不需要删除）
      if (syncError.name === 'SequelizeUnknownConstraintError') {
        console.warn("警告: 尝试删除不存在的约束，已忽略:", syncError.constraint);
        // 继续执行，表结构可能已经正确
        console.log("数据库表同步完成（已忽略约束错误）！");
      } else {
        // 其他错误需要抛出
        throw syncError;
      }
    }
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
