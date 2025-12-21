const express = require("express");
const https = require("https");
const { Sequelize } = require("sequelize");
const { User } = require("../db");
const { successResponse, errorResponse, asyncHandler } = require("../utils");

const router = express.Router();

const APP_ID = 'wx7c3b8743a2240ef6';
const APP_SECRET = '19833ddf5ecbd4bdaa3eaff56b848a58';
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
    // 创建新用户，使用 findOrCreate 避免并发时的重复键错误
    try {
      if (wxOpenId) {
        // 如果有 wxOpenId，使用 findOrCreate
        const [createdUser, created] = await User.findOrCreate({
          where: { wxOpenId },
          defaults: {
            username: username.trim(),
            avatarUrl: avatarUrl || null,
          },
        });
        user = createdUser;
        isExistingUser = !created;
        
        // 如果用户已存在，更新用户名和头像
        if (!created) {
          user.username = username.trim();
          if (avatarUrl) {
            user.avatarUrl = avatarUrl;
          }
          await user.save();
        }
      } else {
        // 如果没有 wxOpenId，直接创建
        user = await User.create({
          wxOpenId: null,
          username: username.trim(),
          avatarUrl: avatarUrl || null,
        });
      }
    } catch (error) {
      // 如果仍然出现重复键错误（并发情况），再次尝试查找
      if (error.name === 'SequelizeUniqueConstraintError' && wxOpenId) {
        user = await User.findOne({ where: { wxOpenId } });
        if (user) {
          isExistingUser = true;
          user.username = username.trim();
          if (avatarUrl) {
            user.avatarUrl = avatarUrl;
          }
          await user.save();
        } else {
          // 如果还是找不到，抛出原始错误
          throw error;
        }
      } else {
        throw error;
      }
    }
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

  try {
    // 调用微信接口换取 openid
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${APP_ID}&secret=${APP_SECRET}&js_code=${code}&grant_type=authorization_code`;

    const response = await new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (e) {
            console.error('解析微信接口响应失败:', e, '原始数据:', data);
            reject(new Error('解析微信接口响应失败: ' + e.message));
          }
        });
      }).on('error', (err) => {
        console.error('请求微信接口失败:', err);
        reject(err);
      });
    });

    const { openid, session_key, errcode, errmsg } = response;

    if (errcode) {
      console.error('微信接口返回错误:', { errcode, errmsg, code });
      return res.status(400).json(errorResponse(`微信接口错误: ${errmsg} (${errcode})`, 400));
    }

    if (!openid) {
      console.error('未能获取到 openid:', response);
      return res.status(400).json(errorResponse("未能获取到 openid", 400));
    }

    res.json(successResponse({ openid, session_key }));
  } catch (error) {
    console.error('换取 openid 失败:', {
      error: error.message,
      stack: error.stack,
      code: code ? '已提供' : '未提供'
    });
    res.status(500).json(errorResponse("换取 openid 失败: " + (error.message || '未知错误'), 500));
  }
}));

/**
 * 获取用户的房间历史
 * GET /api/users/:id/rooms
 * Query参数: months (可选，默认3) - 查询近N个月的数据
 */
router.get("/:id/rooms", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const months = parseInt(req.query.months) || 3; // 默认查询近3个月

  const user = await User.findByPk(id);
  if (!user) {
    return res.status(404).json(errorResponse("用户不存在", 404));
  }

  const { Room, RoomMember, Transaction } = require("../db");

  // 计算N个月前的日期
  const monthsAgo = new Date();
  monthsAgo.setMonth(monthsAgo.getMonth() - months);

  // 获取用户加入过的所有房间（优先显示当前还在的房间）
  const allMemberships = await RoomMember.findAll({
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
    order: [
      // 先按是否还在房间排序（leftAt为null的在前，使用CASE WHEN实现）
      [Sequelize.literal('CASE WHEN leftAt IS NULL THEN 0 ELSE 1 END'), 'ASC'],
      // 再按加入时间排序
      ["joinedAt", "DESC"],
    ],
  });

  // 过滤出近N个月内创建或加入的房间
  const filteredMemberships = allMemberships.filter((membership) => {
    const roomCreatedAt = new Date(membership.room.createdAt);
    const joinedAt = new Date(membership.joinedAt);
    return roomCreatedAt >= monthsAgo || joinedAt >= monthsAgo;
  });

  // 按房间 ID 去重，保留每个房间最新的 membership 记录
  const membershipMap = new Map();
  filteredMemberships.forEach((membership) => {
    const roomId = membership.room.id;
    const existing = membershipMap.get(roomId);

    // 如果房间不存在，或者当前记录的加入时间更新，则更新
    if (!existing || new Date(membership.joinedAt) > new Date(existing.joinedAt)) {
      membershipMap.set(roomId, membership);
    }
  });

  // 转换为数组，按加入时间降序排序
  const memberships = Array.from(membershipMap.values()).sort((a, b) => {
    const timeA = new Date(a.joinedAt).getTime();
    const timeB = new Date(b.joinedAt).getTime();
    return timeB - timeA; // 最新的在前
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

