const defineUser = require("./User");
const defineRoom = require("./Room");
const defineRoomMember = require("./RoomMember");
const defineTransaction = require("./Transaction");

/**
 * 初始化所有模型并建立关联关系
 * @param {Sequelize} sequelize - Sequelize 实例
 * @returns {Object} 包含所有模型的对象
 */
function initModels(sequelize) {
  // 按顺序定义模型（注意依赖关系）
  const User = defineUser(sequelize);
  const Room = defineRoom(sequelize, User);
  const RoomMember = defineRoomMember(sequelize, Room, User);
  const Transaction = defineTransaction(sequelize, Room, User);

  // ==================== 模型关联关系 ====================

  // User 和 Room 的关系（一对多：一个用户可以是多个房间的房主）
  User.hasMany(Room, { foreignKey: "ownerId", as: "ownedRooms" });
  Room.belongsTo(User, { foreignKey: "ownerId", as: "owner" });

  // User 和 RoomMember 的关系（多对多：一个用户可以加入多个房间）
  User.hasMany(RoomMember, { foreignKey: "userId", as: "roomMemberships" });
  RoomMember.belongsTo(User, { foreignKey: "userId", as: "user" });

  // Room 和 RoomMember 的关系（一对多：一个房间可以有多个成员）
  Room.hasMany(RoomMember, { foreignKey: "roomId", as: "members" });
  RoomMember.belongsTo(Room, { foreignKey: "roomId", as: "room" });

  // User 和 Transaction 的关系（一对多：一个用户可以有多个转出记录）
  User.hasMany(Transaction, { foreignKey: "fromUserId", as: "sentTransactions" });
  Transaction.belongsTo(User, { foreignKey: "fromUserId", as: "fromUser" });

  // User 和 Transaction 的关系（一对多：一个用户可以有多个转入记录）
  User.hasMany(Transaction, { foreignKey: "toUserId", as: "receivedTransactions" });
  Transaction.belongsTo(User, { foreignKey: "toUserId", as: "toUser" });

  // Room 和 Transaction 的关系（一对多：一个房间可以有多个转账记录）
  Room.hasMany(Transaction, { foreignKey: "roomId", as: "transactions" });
  Transaction.belongsTo(Room, { foreignKey: "roomId", as: "room" });

  return {
    User,
    Room,
    RoomMember,
    Transaction,
  };
}

module.exports = initModels;

