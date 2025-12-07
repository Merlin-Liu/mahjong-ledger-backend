const express = require("express");
const { Room, RoomMember, Transaction, User } = require("../db");
const { successResponse, errorResponse, asyncHandler } = require("../utils");

const router = express.Router();

/**
 * 创建转账记录
 * POST /api/transactions
 * Body: { roomCode: string, fromUserId: number, toUserId: number, amount: number, description?: string }
 */
router.post("/", asyncHandler(async (req, res) => {
  const { roomCode, fromUserId, toUserId, amount, description } = req.body;

  if (!roomCode || !fromUserId || !toUserId || amount === undefined) {
    return res.status(400).json(errorResponse("参数不完整", 400));
  }

  if (amount <= 0) {
    return res.status(400).json(errorResponse("转账金额必须大于0", 400));
  }

  if (fromUserId === toUserId) {
    return res.status(400).json(errorResponse("不能向自己转账", 400));
  }

  // 查找房间
  const room = await Room.findOne({ where: { code: roomCode } });
  if (!room) {
    return res.status(404).json(errorResponse("房间不存在", 404));
  }

  if (room.status === "closed") {
    return res.status(400).json(errorResponse("房间已关闭，无法转账", 400));
  }

  // 验证两个用户都在房间中
  const fromMember = await RoomMember.findOne({
    where: {
      roomId: room.id,
      userId: fromUserId,
      leftAt: null,
    },
  });

  const toMember = await RoomMember.findOne({
    where: {
      roomId: room.id,
      userId: toUserId,
      leftAt: null,
    },
  });

  if (!fromMember) {
    return res.status(400).json(errorResponse("转出用户不在房间中", 400));
  }

  if (!toMember) {
    return res.status(400).json(errorResponse("转入用户不在房间中", 400));
  }

  // 创建转账记录
  const transaction = await Transaction.create({
    roomId: room.id,
    fromUserId,
    toUserId,
    amount: parseFloat(amount),
    description: description?.trim() || null,
  });

  // 加载关联数据
  await transaction.reload({
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
  });

  res.json(successResponse({
    id: transaction.id,
    roomId: transaction.roomId,
    roomCode: room.code,
    fromUser: {
      id: transaction.fromUser.id,
      username: transaction.fromUser.username,
      avatarUrl: transaction.fromUser.avatarUrl,
    },
    toUser: {
      id: transaction.toUser.id,
      username: transaction.toUser.username,
      avatarUrl: transaction.toUser.avatarUrl,
    },
    amount: parseFloat(transaction.amount),
    description: transaction.description,
    createdAt: transaction.createdAt,
  }));
}));

module.exports = router;

