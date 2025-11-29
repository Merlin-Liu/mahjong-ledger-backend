# 打牌记账应用 API 文档

## 基础信息

- Base URL: `http://localhost:80` (本地开发)
- 响应格式: JSON
- 统一响应结构:
  ```json
  {
    "code": 0,        // 0表示成功，其他值表示错误
    "message": "success",
    "data": {}        // 响应数据
  }
  ```

## 用户相关 API

### 1. 创建或获取用户

**POST** `/api/users`

**请求体:**
```json
{
  "wxOpenId": "optional_wechat_openid",
  "username": "用户名"
}
```

**响应:**
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "wxOpenId": null,
    "username": "张三",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 2. 获取用户信息

**GET** `/api/users/:id`

**响应:**
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "wxOpenId": null,
    "username": "张三",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 3. 获取微信 OpenID

**GET** `/api/wx_openid`

**说明:** 仅在小程序云开发环境中可用，从请求头中获取微信 OpenID

**响应:**
```
openid字符串
```

### 4. 通过 Code 换取微信 OpenID（推荐）

**POST** `/api/wx_openid_by_code`

**请求体:**
```json
{
  "code": "微信登录凭证code"
}
```

**说明:** 通过 `wx.login()` 获取的 code 换取 openid，适用于所有环境

**响应:**
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "openid": "用户的唯一标识",
    "session_key": "会话密钥"
  }
}
```

**注意:** 需要在后端环境变量中配置 `WX_APPID` 和 `WX_SECRET`

---

## 房间相关 API

### 1. 创建房间

**POST** `/api/rooms`

**请求体:**
```json
{
  "ownerId": 1,
  "name": "房间名称（可选）"
}
```

**响应:** 
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "code": "123456",
    "name": "我的房间",
    "ownerId": 1,
    "status": "active",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 2. 获取房间信息

**GET** `/api/rooms/:code`

**响应:**
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "code": "123456",
    "name": "我的房间",
    "owner": {
      "id": 1,
      "username": "张三"
    },
    "status": "active",
    "members": [
      {
        "id": 1,
        "userId": 1,
        "username": "张三",
        "joinedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 3. 加入房间

**POST** `/api/rooms/:code/join`

**请求体:**
```json
{
  "userId": 2,
  "username": "在房间中的用户名（可选，默认使用用户表中的用户名）"
}
```

**响应:**
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "roomId": 1,
    "roomCode": "123456",
    "userId": 2,
    "username": "李四",
    "joinedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 4. 离开房间

**POST** `/api/rooms/:code/leave`

**请求体:**
```json
{
  "userId": 2
}
```

**响应:**
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "message": "已离开房间"
  }
}
```

### 5. 关闭房间

**POST** `/api/rooms/:code/close`

**请求体:**
```json
{
  "userId": 1
}
```

**说明:** 只有房主可以关闭房间

**响应:**
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "message": "房间已关闭"
  }
}
```

### 6. 获取房间成员列表

**GET** `/api/rooms/:code/members`

**响应:**
```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": 1,
      "userId": 1,
      "username": "张三",
      "user": {
        "id": 1,
        "username": "张三"
      },
      "joinedAt": "2024-01-01T00:00:00.000Z",
      "leftAt": null
    }
  ]
}
```

---

## 转账相关 API

### 1. 创建转账记录

**POST** `/api/transactions`

**请求体:**
```json
{
  "roomCode": "123456",
  "fromUserId": 1,
  "toUserId": 2,
  "amount": 100.50,
  "description": "转账说明（可选）"
}
```

**响应:**
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "roomId": 1,
    "roomCode": "123456",
    "fromUser": {
      "id": 1,
      "username": "张三"
    },
    "toUser": {
      "id": 2,
      "username": "李四"
    },
    "amount": 100.50,
    "description": "转账说明",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 2. 获取房间转账记录

**GET** `/api/rooms/:code/transactions`

**响应:**
```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": 1,
      "fromUser": {
        "id": 1,
        "username": "张三"
      },
      "toUser": {
        "id": 2,
        "username": "李四"
      },
      "amount": 100.50,
      "description": "转账说明",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

## 活动记录和房间历史 API

### 1. 获取房间活动记录

**GET** `/api/rooms/:code/activities`

**说明:** 返回房间内所有的活动记录，包括：进入房间、离开房间、转账

**响应:**
```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "type": "join",
      "userId": 1,
      "username": "张三",
      "timestamp": "2024-01-01T00:00:00.000Z",
      "message": "张三 进入了房间"
    },
    {
      "type": "transaction",
      "fromUserId": 1,
      "fromUsername": "张三",
      "toUserId": 2,
      "toUsername": "李四",
      "amount": 100.50,
      "timestamp": "2024-01-01T01:00:00.000Z",
      "message": "张三 向 李四 转账 100.5 元"
    },
    {
      "type": "leave",
      "userId": 2,
      "username": "李四",
      "timestamp": "2024-01-01T02:00:00.000Z",
      "message": "李四 离开了房间"
    }
  ]
}
```

### 2. 获取用户的房间历史

**GET** `/api/users/:id/rooms`

**说明:** 返回用户加入过的所有房间，包括房间信息、成员列表、转账记录

**响应:**
```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "room": {
        "id": 1,
        "code": "123456",
        "name": "我的房间",
        "owner": {
          "id": 1,
          "username": "张三"
        },
        "status": "active",
        "createdAt": "2024-01-01T00:00:00.000Z"
      },
      "membership": {
        "username": "李四",
        "joinedAt": "2024-01-01T00:30:00.000Z",
        "leftAt": null
      },
      "members": [
        {
          "userId": 1,
          "username": "张三",
          "joinedAt": "2024-01-01T00:00:00.000Z",
          "leftAt": null
        },
        {
          "userId": 2,
          "username": "李四",
          "joinedAt": "2024-01-01T00:30:00.000Z",
          "leftAt": null
        }
      ],
      "transactions": [
        {
          "fromUserId": 1,
          "fromUsername": "张三",
          "toUserId": 2,
          "toUsername": "李四",
          "amount": 100.50,
          "description": "转账说明",
          "createdAt": "2024-01-01T01:00:00.000Z"
        }
      ]
    }
  ]
}
```

---

## 错误码说明

- `0`: 成功
- `400`: 请求参数错误
- `403`: 权限不足
- `404`: 资源不存在
- `500`: 服务器内部错误

## 使用示例

### 完整流程示例

1. **创建用户**
```bash
curl -X POST http://localhost:80/api/users \
  -H "Content-Type: application/json" \
  -d '{"username": "张三"}'
```

2. **创建房间**
```bash
curl -X POST http://localhost:80/api/rooms \
  -H "Content-Type: application/json" \
  -d '{"ownerId": 1, "name": "我的房间"}'
```

3. **加入房间**
```bash
curl -X POST http://localhost:80/api/rooms/123456/join \
  -H "Content-Type: application/json" \
  -d '{"userId": 2, "username": "李四"}'
```

4. **创建转账**
```bash
curl -X POST http://localhost:80/api/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "roomCode": "123456",
    "fromUserId": 1,
    "toUserId": 2,
    "amount": 100.50,
    "description": "打牌输的钱"
  }'
```

5. **查看房间活动**
```bash
curl http://localhost:80/api/rooms/123456/activities
```
