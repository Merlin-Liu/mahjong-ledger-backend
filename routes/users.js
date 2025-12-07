const express = require("express");
const https = require("https");
const { User } = require("../db");
const { successResponse, errorResponse, asyncHandler } = require("../utils");

const router = express.Router();

/**
 * 创建或获取用户
 * POST /api/users
 * Body: { wxOpenId?: string, username: string }
 */
router.post("/", asyncHandler(async (req, res) => {
  const { wxOpenId, username, avatarUrl } = req.body;

  if (!username || username.trim() === "") {
    return res.status(400).json(errorResponse("用户名不能为空", 400));
  }

  let user;
  let isExistingUser = false;

  if (wxOpenId) {
    // 如果提供了微信OpenID，先查找是否已存在
    user = await User.findOne({ where: { wxOpenId } });
    if (user) {
      // 更新用户名和头像
      isExistingUser = true;
      user.username = username.trim();
      if (avatarUrl) {
        user.avatarUrl = avatarUrl;
      }
      await user.save();
    }
  }

  if (!user) {
    // 创建新用户
    user = await User.create({
      wxOpenId: wxOpenId || null,
      username: username.trim(),
      avatarUrl: avatarUrl || null,
    });
  }

  res.json(successResponse({
    id: user.id,
    wxOpenId: user.wxOpenId,
    username: user.username,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    isExistingUser, // 标识是否是已存在的用户（更新操作）
  }));
}));

/**
 * 获取用户信息
 * GET /api/users/:id
 */
router.get("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await User.findByPk(id);

  if (!user) {
    return res.status(404).json(errorResponse("用户不存在", 404));
  }

  res.json(successResponse({
    id: user.id,
    wxOpenId: user.wxOpenId,
    username: user.username,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  }));
}));

/**
 * 小程序调用，获取微信 Open ID
 * GET /api/wx_openid
 * 优先从请求头获取（云开发环境），如果没有则返回错误提示使用 code 方式
 */
router.get("/wx_openid", (req, res) => {
  if (req.headers["x-wx-source"] && req.headers["x-wx-openid"]) {
    res.send(req.headers["x-wx-openid"]);
  } else {
    res.status(400).json(errorResponse("请使用 POST /api/wx_openid_by_code 接口，通过 code 换取 openid", 400));
  }
});

/**
 * 通过 code 换取微信 OpenID
 * POST /api/wx_openid_by_code
 * Body: { code: string }
 */
router.post("/wx_openid_by_code", asyncHandler(async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json(errorResponse("code 不能为空", 400));
  }

  // 从环境变量获取小程序 appid 和 secret
  const appid = process.env.WX_APPID;
  const secret = process.env.WX_SECRET;

  if (!appid || !secret) {
    return res.status(500).json(errorResponse("服务器未配置小程序 appid 或 secret", 500));
  }

  try {
    // 调用微信接口换取 openid
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`;

    const response = await new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', (err) => {
        reject(err);
      });
    });

    const { openid, session_key, errcode, errmsg } = response;

    if (errcode) {
      return res.status(400).json(errorResponse(`微信接口错误: ${errmsg} (${errcode})`, 400));
    }

    if (!openid) {
      return res.status(400).json(errorResponse("未能获取到 openid", 400));
    }

    res.json(successResponse({ openid, session_key }));
  } catch (error) {
    console.error('换取 openid 失败:', error);
    res.status(500).json(errorResponse("换取 openid 失败: " + error.message, 500));
  }
}));

/**
 * 获取用户的房间历史
 * GET /api/users/:id/rooms
 */
router.get("/:id/rooms", asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findByPk(id);
  if (!user) {
    return res.status(404).json(errorResponse("用户不存在", 404));
  }

  const { Room, RoomMember, Transaction } = require("../db");

  // 获取用户加入过的所有房间
  const memberships = await RoomMember.findAll({
    where: { userId: id },
    include: [
      {
        model: Room,
        as: "room",
        include: [
          {
            model: User,
            as: "owner",
            attributes: ["id", "username", "avatarUrl"],
          },
        ],
      },
    ],
    order: [["joinedAt", "DESC"]],
  });

  // 获取每个房间的成员和转账记录
  const roomsData = await Promise.all(
    memberships.map(async (membership) => {
      const room = membership.room;

      // 获取房间所有成员
      const members = await RoomMember.findAll({
        where: { roomId: room.id },
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "username", "avatarUrl"],
          },
        ],
      });

      // 获取房间所有转账记录
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
      });

      return {
        room: {
          id: room.id,
          code: room.code,
          name: room.name,
          owner: {
            id: room.owner.id,
            username: room.owner.username,
            avatarUrl: room.owner.avatarUrl,
          },
          status: room.status,
          createdAt: room.createdAt,
        },
        membership: {
          username: membership.username,
          joinedAt: membership.joinedAt,
          leftAt: membership.leftAt,
        },
        members: members.map(m => ({
          userId: m.userId,
          username: m.username,
          joinedAt: m.joinedAt,
          leftAt: m.leftAt,
        })),
        transactions: transactions.map(t => ({
          fromUserId: t.fromUserId,
          fromUsername: t.fromUser.username,
          toUserId: t.toUserId,
          toUsername: t.toUser.username,
          amount: parseFloat(t.amount),
          description: t.description,
          createdAt: t.createdAt,
        })),
      };
    })
  );

  res.json(successResponse(roomsData));
}));

module.exports = router;

