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

/**
 * 清除所有表的数据
 * 注意：会删除所有数据，请谨慎使用！
 */
async function clearAllTables() {
  try {
    console.log("开始清除所有表的数据...");

    // 禁用外键检查，以便可以按任意顺序删除数据
    await sequelize.query("SET FOREIGN_KEY_CHECKS = 0;");

    // 使用 TRUNCATE TABLE 快速清除所有表的数据
    // 按依赖关系顺序清除（从子表到父表）

    // 1. 清除转账记录表
    await sequelize.query("TRUNCATE TABLE `transactions`;");
    console.log("✓ 已清除 transactions 表数据");

    // 2. 清除房间成员表
    await sequelize.query("TRUNCATE TABLE `room_members`;");
    console.log("✓ 已清除 room_members 表数据");

    // 3. 清除房间表
    await sequelize.query("TRUNCATE TABLE `rooms`;");
    console.log("✓ 已清除 rooms 表数据");

    // 4. 清除用户表
    await sequelize.query("TRUNCATE TABLE `users`;");
    console.log("✓ 已清除 users 表数据");

    // 恢复外键检查
    await sequelize.query("SET FOREIGN_KEY_CHECKS = 1;");

    console.log("所有表数据清除完成！");
  } catch (error) {
    // 确保恢复外键检查
    try {
      await sequelize.query("SET FOREIGN_KEY_CHECKS = 1;");
    } catch (e) {
      // 忽略恢复外键检查时的错误
    }
    console.error("清除表数据失败:", error);
    throw error;
  }
}

async function init() {

  try {
    // 测试数据库连接
    await sequelize.authenticate();
    console.log("数据库连接成功！");

    // 清除所有表的数据
    await clearAllTables();

    // 删除 room_members 表的唯一索引 unique_room_user（如果存在）
    // 这个索引阻止了用户多次加入和离开房间，需要删除以支持历史记录功能
    try {
      // MySQL 不支持 DROP INDEX IF EXISTS，需要先检查索引是否存在
      const [indexes] = await sequelize.query(`
        SHOW INDEX FROM \`room_members\` WHERE Key_name = 'unique_room_user';
      `);

      if (indexes && indexes.length > 0) {
        await sequelize.query(`
          DROP INDEX \`unique_room_user\` ON \`room_members\`;
        `);
        console.log("已删除唯一索引 unique_room_user");
      } else {
        console.log("唯一索引 unique_room_user 不存在，无需删除");
      }
    } catch (indexError) {
      // 如果删除索引失败，记录错误但继续执行
      console.error("删除唯一索引时出现错误:", indexError.message);
    }

    // 使用 force: true 重建所有表，确保表结构完全匹配模型定义
    // 由于已经清除了所有数据，重建表是安全的
    await sequelize.sync({ force: true });
    console.log("数据库表已重建完成！");
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
