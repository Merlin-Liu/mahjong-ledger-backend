const { DataTypes } = require("sequelize");

/**
 * 转账记录模型
 * 存储房间内用户之间的转账记录
 */
function defineTransaction(sequelize, Room, User) {
  const Transaction = sequelize.define("Transaction", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    roomId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Room,
        key: "id",
      },
      comment: "房间ID",
    },
    fromUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: "id",
      },
      comment: "转出用户ID",
    },
    toUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: "id",
      },
      comment: "转入用户ID",
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "转账金额（元）",
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "转账描述",
    },
  }, {
    tableName: "transactions",
    timestamps: true,
  });

  return Transaction;
}

module.exports = defineTransaction;

