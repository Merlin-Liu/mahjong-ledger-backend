const { DataTypes } = require("sequelize");

/**
 * 用户模型
 * 存储用户基本信息，支持微信 OpenID
 */
function defineUser(sequelize) {
  const User = sequelize.define("User", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    wxOpenId: {
      type: DataTypes.STRING(128),
      allowNull: true,
      unique: true,
      comment: "微信OpenID",
    },
    username: {
      type: DataTypes.STRING(64),
      allowNull: false,
      comment: "用户名",
    },
    avatarUrl: {
      type: DataTypes.STRING(512),
      allowNull: true,
      comment: "用户头像URL",
    },
  }, {
    tableName: "users",
    timestamps: true,
  });

  return User;
}

module.exports = defineUser;

