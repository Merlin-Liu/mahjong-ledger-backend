const { DataTypes } = require("sequelize");

/**
 * 房间模型
 * 存储房间信息，包含房间码、房主、状态等
 */
function defineRoom(sequelize, User) {
  const Room = sequelize.define("Room", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    code: {
      type: DataTypes.STRING(16),
      allowNull: false,
      unique: true,
      comment: "房间邀请码",
    },
    name: {
      type: DataTypes.STRING(64),
      allowNull: true,
      comment: "房间名称",
    },
    ownerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: "id",
      },
      comment: "房主ID",
    },
    status: {
      type: DataTypes.ENUM("active", "closed"),
      allowNull: false,
      defaultValue: "active",
      comment: "房间状态：active-活跃, closed-已关闭",
    },
  }, {
    tableName: "rooms",
    timestamps: true,
  });

  return Room;
}

module.exports = defineRoom;

