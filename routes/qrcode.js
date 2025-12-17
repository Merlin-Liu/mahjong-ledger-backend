const express = require("express");
const https = require("https");
const { successResponse, errorResponse, asyncHandler } = require("../utils");

const router = express.Router();

// 从环境变量或配置中获取微信小程序配置
const APP_ID = process.env.WX_APPID || 'wx7c3b8743a2240ef6';
const APP_SECRET = process.env.WX_SECRET || '19833ddf5ecbd4bdaa3eaff56b848a58';

// access_token 缓存（简单实现，生产环境建议使用 Redis）
let accessTokenCache = {
  token: null,
  expiresAt: 0
};

/**
 * 获取微信 access_token
 * 文档: https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/mp-access-token/getAccessToken.html
 */
async function getAccessToken() {
  // 如果缓存有效，直接返回
  if (accessTokenCache.token && Date.now() < accessTokenCache.expiresAt) {
    return accessTokenCache.token;
  }

  return new Promise((resolve, reject) => {
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APP_ID}&secret=${APP_SECRET}`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const { access_token, expires_in, errcode, errmsg } = parsed;
          
          if (errcode) {
            console.error('获取 access_token 失败:', { errcode, errmsg });
            reject(new Error(`获取 access_token 失败: ${errmsg} (${errcode})`));
            return;
          }

          if (!access_token) {
            reject(new Error('未能获取到 access_token'));
            return;
          }

          // 缓存 token，提前 5 分钟过期
          accessTokenCache.token = access_token;
          accessTokenCache.expiresAt = Date.now() + (expires_in - 300) * 1000;

          resolve(access_token);
        } catch (e) {
          console.error('解析 access_token 响应失败:', e, '原始数据:', data);
          reject(new Error('解析 access_token 响应失败: ' + e.message));
        }
      });
    }).on('error', (err) => {
      console.error('请求 access_token 失败:', err);
      reject(err);
    });
  });
}

/**
 * 生成小程序二维码
 * POST /api/qrcode/generate
 * Body: { page: string, scene: string, width?: number }
 * 
 * 参数说明:
 * - page: 小程序页面路径，例如 'pages/room/room'，不能携带参数
 * - scene: 场景值，最大32个可见字符，参数会作为 query.scene 传递给小程序
 * - width: 二维码宽度，单位 px，默认 430，最小 280，最大 1280
 */
router.post("/generate", asyncHandler(async (req, res) => {
  const { page, scene, width = 430 } = req.body;

  // 参数验证
  if (!page) {
    return res.status(400).json(errorResponse("页面路径不能为空", 400));
  }

  if (!scene) {
    return res.status(400).json(errorResponse("场景值不能为空", 400));
  }

  // scene 长度验证（最大32个可见字符）
  if (scene.length > 32) {
    return res.status(400).json(errorResponse("场景值不能超过32个字符", 400));
  }

  // width 范围验证
  if (width < 280 || width > 1280) {
    return res.status(400).json(errorResponse("二维码宽度必须在 280-1280 之间", 400));
  }

  try {
    // 获取 access_token
    const accessToken = await getAccessToken();

    // 调用微信 getUnlimitedQRCode API
    const apiUrl = `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${accessToken}`;
    
    // 构建请求体
    const requestData = JSON.stringify({
      page: page,
      scene: scene,
      width: width,
      check_path: true, // 检查页面是否存在
      env_version: 'release' // 正式版
    });

    // 发送 POST 请求
    const qrCodeBuffer = await new Promise((resolve, reject) => {
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestData)
        }
      };

      const req = https.request(apiUrl, options, (res) => {
        const chunks = [];
        
        res.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          
          // 检查是否是错误响应（JSON 格式）
          try {
            const jsonResponse = JSON.parse(buffer.toString());
            if (jsonResponse.errcode) {
              console.error('生成二维码失败:', jsonResponse);
              reject(new Error(`生成二维码失败: ${jsonResponse.errmsg} (${jsonResponse.errcode})`));
              return;
            }
          } catch (e) {
            // 不是 JSON，说明是图片 buffer，正常情况
          }
          
          // 返回图片 buffer
          resolve(buffer);
        });
      });

      req.on('error', (err) => {
        console.error('请求二维码 API 失败:', err);
        reject(err);
      });

      req.write(requestData);
      req.end();
    });

    // 将 buffer 转换为 base64
    const base64 = qrCodeBuffer.toString('base64');

    // 返回 base64 编码的图片数据
    res.json(successResponse({
      base64: base64,
      contentType: 'image/png'
    }));

  } catch (error) {
    console.error('生成二维码失败:', error);
    res.status(500).json(errorResponse("生成二维码失败: " + (error.message || '未知错误'), 500));
  }
}));

module.exports = router;



