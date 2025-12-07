const express = require("express");
const { User, Room, RoomMember, Transaction } = require("../db");
const { generateRoomCode, successResponse, errorResponse, asyncHandler } = require("../utils");

const router = express.Router();

/**
 * 创建房间
 * POST /api/rooms
 * Body: { ownerId: number, name?: string }
 */
router.post("/", asyncHandler(async (req, res) => {
  const { ownerId, name } = req.body;

  if (!ownerId) {
    return res.status(400).json(errorResponse("房主ID不能为空", 400));
  }

  // 验证用户是否存在
  const owner = await User.findByPk(ownerId);
  if (!owner) {
    return res.status(404).json(errorResponse("用户不存在", 404));
  }

  // 生成唯一的房间码
  let code;
  let exists = true;
  while (exists) {
    code = generateRoomCode();
    const room = await Room.findOne({ where: { code } });
    exists = !!room;
  }

  // 创建房间
  const room = await Room.create({
    code,
    name: name?.trim() || null,
    ownerId,
    status: "active",
  });

  // 房主自动加入房间
  await RoomMember.create({
    roomId: room.id,
    userId: ownerId,
    username: owner.username,
    avatarUrl: owner.avatarUrl,
    joinedAt: new Date(),
  });

  // ====== 测试用，自动加入一个测试用户进入房间 ======
  const testUserAvatarUrl = 'https://himg.bdimg.com/sys/portraitn/item/public.1.88a49878.E-rOvrkJXaMlqINvh2SzAA?_d=29418018';
  let testUser = await User.findOne({
    where: {
      username: '测试用户',
      wxOpenId: 'test_user_openid' // 确保是测试用户，不是真实用户
    }
  });
  if (!testUser) {
    testUser = await User.create({
      wxOpenId: 'test_user_openid',
      username: '测试用户',
      avatarUrl: testUserAvatarUrl,
    });
  } else {
    // 如果测试用户已存在，确保头像是最新的
    if (testUser.avatarUrl !== testUserAvatarUrl) {
      testUser.avatarUrl = testUserAvatarUrl;
      await testUser.save();
    }
  }
  if (testUser.id !== ownerId) {
    await RoomMember.create({
      roomId: room.id,
      userId: testUser.id,
      username: testUser.username,
      avatarUrl: testUser.avatarUrl,
      joinedAt: new Date(),
    });
  }

  res.json(successResponse({
    id: room.id,
    code: room.code,
    name: room.name,
    ownerId: room.ownerId,
    status: room.status,
    createdAt: room.createdAt,
  }));
}));

/**
 * 获取房间信息
 * GET /api/rooms/:code
 */
router.get("/:code", asyncHandler(async (req, res) => {
  const { code } = req.params;

  const room = await Room.findOne({
    where: { code },
    include: [
      {
        model: User,
        as: "owner",
        attributes: ["id", "username", "avatarUrl"],
      },
      {
        model: RoomMember,
        as: "members",
        where: { leftAt: null },
        required: false,
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "username", "avatarUrl"],
          },
        ],
      },
    ],
  });

  if (!room) {
    return res.status(404).json(errorResponse("房间不存在", 404));
  }

  res.json(successResponse({
    id: room.id,
    code: room.code,
    name: room.name,
    owner: {
      id: room.owner.id,
      username: room.owner.username,
      avatarUrl: room.owner.avatarUrl,
    },
    status: room.status,
    members: room.members.map(m => ({
      id: m.user.id,
      userId: m.userId,
      username: m.username,
      user: {
        id: m.user.id,
        username: m.user.username,
        avatarUrl: m.user.avatarUrl,
      },
      joinedAt: m.joinedAt,
    })),
    createdAt: room.createdAt,
  }));
}));

/**
 * 加入房间
 * POST /api/rooms/:code/join
 * Body: { userId: number, username?: string }
 */
router.post("/:code/join", asyncHandler(async (req, res) => {
  const { code } = req.params;
  const { userId, username } = req.body;

  if (!userId) {
    return res.status(400).json(errorResponse("用户ID不能为空", 400));
  }

  // 查找房间
  const room = await Room.findOne({ where: { code } });
  if (!room) {
    return res.status(404).json(errorResponse("房间不存在", 404));
  }

  if (room.status === "closed") {
    return res.status(400).json(errorResponse("房间已关闭", 400));
  }

  // 查找用户
  const user = await User.findByPk(userId);
  if (!user) {
    return res.status(404).json(errorResponse("用户不存在", 404));
  }

  // 检查是否已经在房间中
  const existingMember = await RoomMember.findOne({
    where: {
      roomId: room.id,
      userId,
      leftAt: null,
    },
  });

  if (existingMember) {
    return res.status(400).json(errorResponse("您已经在房间中", 400));
  }

  // 检查之前是否加入过（已离开）
  const previousMember = await RoomMember.findOne({
    where: {
      roomId: room.id,
      userId,
    },
    order: [["createdAt", "DESC"]],
  });

  let member;
  if (previousMember && previousMember.leftAt) {
    // 重新加入
    previousMember.leftAt = null;
    previousMember.joinedAt = new Date();
    previousMember.username = username?.trim() || user.username;
    await previousMember.save();
    member = previousMember;
  } else {
    // 首次加入
    member = await RoomMember.create({
      roomId: room.id,
      userId,
      username: username?.trim() || user.username,
      joinedAt: new Date(),
    });
  }

  res.json(successResponse({
    roomId: room.id,
    roomCode: room.code,
    userId: member.userId,
    username: member.username,
    joinedAt: member.joinedAt,
  }));
}));

/**
 * 离开房间
 * POST /api/rooms/:code/leave
 * Body: { userId: number }
 */
router.post("/:code/leave", asyncHandler(async (req, res) => {
  const { code } = req.params;
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json(errorResponse("用户ID不能为空", 400));
  }

  const room = await Room.findOne({ where: { code } });
  if (!room) {
    return res.status(404).json(errorResponse("房间不存在", 404));
  }

  const member = await RoomMember.findOne({
    where: {
      roomId: room.id,
      userId,
      leftAt: null,
    },
  });

  if (!member) {
    return res.status(404).json(errorResponse("您不在房间中", 404));
  }

  member.leftAt = new Date();
  await member.save();

  res.json(successResponse({ message: "已离开房间" }));
}));

/**
 * 关闭房间
 * POST /api/rooms/:code/close
 * Body: { userId: number }
 */
router.post("/:code/close", asyncHandler(async (req, res) => {
  const { code } = req.params;
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json(errorResponse("用户ID不能为空", 400));
  }

  const room = await Room.findOne({ where: { code } });
  if (!room) {
    return res.status(404).json(errorResponse("房间不存在", 404));
  }

  if (room.ownerId !== userId) {
    return res.status(403).json(errorResponse("只有房主可以关闭房间", 403));
  }

  if (room.status === "closed") {
    return res.status(400).json(errorResponse("房间已经关闭", 400));
  }

  room.status = "closed";
  await room.save();

  res.json(successResponse({ message: "房间已关闭" }));
}));

/**
 * 获取房间成员列表
 * GET /api/rooms/:code/members
 */
router.get("/:code/members", asyncHandler(async (req, res) => {
  const { code } = req.params;

  const room = await Room.findOne({ where: { code } });
  if (!room) {
    return res.status(404).json(errorResponse("房间不存在", 404));
  }

  const members = await RoomMember.findAll({
    where: { roomId: room.id },
    include: [
      {
        model: User,
        as: "user",
        attributes: ["id", "username", "avatarUrl"],
      },
    ],
    order: [["joinedAt", "ASC"]],
  });

  res.json(successResponse(members.map(m => ({
    id: m.id,
    userId: m.userId,
    username: m.username,
    user: {
      id: m.user.id,
      username: m.user.username,
      avatarUrl: m.user.avatarUrl,
    },
    joinedAt: m.joinedAt,
    leftAt: m.leftAt,
  }))));
}));

/**
 * 获取房间转账记录
 * GET /api/rooms/:code/transactions
 */
router.get("/:code/transactions", asyncHandler(async (req, res) => {
  const { code } = req.params;

  const room = await Room.findOne({ where: { code } });
  if (!room) {
    return res.status(404).json(errorResponse("房间不存在", 404));
  }

  const transactions = await Transaction.findAll({
    where: { roomId: room.id },
    include: [
      {
        model: User,
        as: "fromUser",
        attributes: ["id", "username", "avatarUrl"],
      },
      {
        model: User,
        as: "toUser",
        attributes: ["id", "username", "avatarUrl"],
      },
    ],
    order: [["createdAt", "DESC"]],
  });

  res.json(successResponse(transactions.map(t => ({
    id: t.id,
    fromUser: {
      id: t.fromUser.id,
      username: t.fromUser.username,
      avatarUrl: t.fromUser.avatarUrl,
    },
    toUser: {
      id: t.toUser.id,
      username: t.toUser.username,
      avatarUrl: t.toUser.avatarUrl,
    },
    amount: parseFloat(t.amount),
    description: t.description,
    createdAt: t.createdAt,
  }))));
}));

/**
 * 获取房间活动记录（进入/离开/转账）
 * GET /api/rooms/:code/activities
 */
router.get("/:code/activities", asyncHandler(async (req, res) => {
  const { code } = req.params;

  const room = await Room.findOne({ where: { code } });
  if (!room) {
    return res.status(404).json(errorResponse("房间不存在", 404));
  }

  const { Transaction } = require("../db");
  const activities = [];

  // 获取成员加入/离开记录
  const members = await RoomMember.findAll({
    where: { roomId: room.id },
    include: [
      {
        model: User,
        as: "user",
        attributes: ["id", "username"],
      },
    ],
    order: [["joinedAt", "ASC"]],
  });

  members.forEach(member => {
    activities.push({
      type: "join",
      userId: member.userId,
      username: member.username,
      timestamp: member.joinedAt,
      message: `${member.username} 进入了房间`,
    });

    if (member.leftAt) {
      activities.push({
        type: "leave",
        userId: member.userId,
        username: member.username,
        timestamp: member.leftAt,
        message: `${member.username} 离开了房间`,
      });
    }
  });

  // 获取转账记录
  const transactions = await Transaction.findAll({
    where: { roomId: room.id },
    include: [
      {
        model: User,
        as: "fromUser",
        attributes: ["id", "username", "avatarUrl"],
      },
      {
        model: User,
        as: "toUser",
        attributes: ["id", "username", "avatarUrl"],
      },
    ],
    order: [["createdAt", "ASC"]],
  });

  transactions.forEach(transaction => {
    activities.push({
      type: "transaction",
      fromUserId: transaction.fromUserId,
      fromUsername: transaction.fromUser.username,
      toUserId: transaction.toUserId,
      toUsername: transaction.toUser.username,
      amount: parseFloat(transaction.amount),
      timestamp: transaction.createdAt,
      message: `${transaction.fromUser.username} 向 ${transaction.toUser.username} 转账 ${transaction.amount} 元`,
    });
  });

  // 按时间排序
  activities.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  res.json(successResponse(activities));
}));

/**
 * 获取房间完整状态（成员、转账记录、活动记录）
 * GET /api/rooms/:code/status
 */
router.get("/:code/status", asyncHandler(async (req, res) => {
  const { code } = req.params;

  const room = await Room.findOne({ where: { code } });
  if (!room) {
    return res.status(404).json(errorResponse("房间不存在", 404));
  }

  // 获取成员列表
  const members = await RoomMember.findAll({
    where: { roomId: room.id },
    include: [
      {
        model: User,
        as: "user",
        attributes: ["id", "username", "avatarUrl"],
      },
    ],
    order: [["joinedAt", "ASC"]],
  });

  // 获取转账记录
  const transactions = await Transaction.findAll({
    where: { roomId: room.id },
    include: [
      {
        model: User,
        as: "fromUser",
        attributes: ["id", "username", "avatarUrl"],
      },
      {
        model: User,
        as: "toUser",
        attributes: ["id", "username", "avatarUrl"],
      },
    ],
    order: [["createdAt", "DESC"]],
  });

  // 获取活动记录
  const activities = [];

  members.forEach(member => {
    activities.push({
      type: "join",
      userId: member.userId,
      username: member.username,
      timestamp: member.joinedAt,
      message: `${member.username} 进入了房间`,
    });

    if (member.leftAt) {
      activities.push({
        type: "leave",
        userId: member.userId,
        username: member.username,
        timestamp: member.leftAt,
        message: `${member.username} 离开了房间`,
      });
    }
  });

  transactions.forEach(transaction => {
    activities.push({
      type: "transaction",
      fromUserId: transaction.fromUserId,
      fromUsername: transaction.fromUser.username,
      toUserId: transaction.toUserId,
      toUsername: transaction.toUser.username,
      amount: parseFloat(transaction.amount),
      timestamp: transaction.createdAt,
      message: `${transaction.fromUser.username} 向 ${transaction.toUser.username} 转账 ${transaction.amount} 元`,
    });
  });

  // 按时间排序
  activities.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  res.json(successResponse({
    members: members.map(m => ({
      id: m.id,
      userId: m.userId,
      username: m.username,
      user: {
        id: m.user.id,
        username: m.user.username,
        avatarUrl: m.user.avatarUrl,
      },
      joinedAt: m.joinedAt,
      leftAt: m.leftAt,
    })),
    transactions: transactions.map(t => ({
      id: t.id,
      fromUser: {
        id: t.fromUser.id,
        username: t.fromUser.username,
        avatarUrl: t.fromUser.avatarUrl,
      },
      toUser: {
        id: t.toUser.id,
        username: t.toUser.username,
        avatarUrl: t.toUser.avatarUrl,
      },
      amount: parseFloat(t.amount),
      description: t.description,
      createdAt: t.createdAt,
    })),
    activities,
  }));
}));

module.exports = router;

