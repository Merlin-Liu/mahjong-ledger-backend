// API工具函数
// 开发环境：使用 localhost（需要在微信开发者工具中关闭域名校验）
// 生产环境：需要配置为合法的 HTTPS 域名，并在微信小程序后台配置域名白名单
const BASE_URL = 'http://localhost:80'  // 开发环境使用 localhost

// 如果需要切换生产环境，请修改为：
// const BASE_URL = 'https://your-api-domain.com'

interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

// 通用请求函数
async function request<T = any>(
  url: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    data?: any
    header?: Record<string, string>
  } = {}
): Promise<T> {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${BASE_URL}${url}`,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        ...options.header,
      },
      success: (res) => {
        const response = res.data as ApiResponse<T>
        if (response.code === 0) {
          resolve(response.data)
        } else {
          reject(new Error(response.message || '请求失败'))
        }
      },
      fail: (err) => {
        reject(err)
      },
    })
  })
}

// 用户相关API
export const userApi = {
  // 创建或获取用户
  createOrGetUser(wxOpenId: string, username: string) {
    return request<{
      id: number
      wxOpenId: string | null
      username: string
      createdAt: string
    }>('/api/users', {
      method: 'POST',
      data: { wxOpenId, username },
    })
  },

  // 获取用户信息
  getUserInfo(userId: number) {
    return request<{
      id: number
      wxOpenId: string | null
      username: string
      createdAt: string
    }>(`/api/users/${userId}`)
  },

  // 获取微信OpenID（从请求头获取，仅云开发环境）
  getWxOpenId() {
    return request<string>('/api/wx_openid')
  },
  
  // 通过 code 换取 openid（推荐方式，适用于所有环境）
  getWxOpenIdByCode(code: string) {
    return request<{ openid: string; session_key: string }>('/api/wx_openid_by_code', {
      method: 'POST',
      data: { code },
    })
  },
}

// 房间相关API
export const roomApi = {
  // 创建房间
  createRoom(ownerId: number, name?: string) {
    return request<{
      id: number
      code: string
      name: string
      ownerId: number
      status: string
      createdAt: string
    }>('/api/rooms', {
      method: 'POST',
      data: { ownerId, name },
    })
  },

  // 获取房间信息
  getRoomInfo(code: string) {
    return request<{
      id: number
      code: string
      name: string
      owner: {
        id: number
        username: string
      }
      status: string
      members: Array<{
        id: number
        userId: number
        username: string
        joinedAt: string
      }>
      createdAt: string
    }>(`/api/rooms/${code}`)
  },

  // 加入房间
  joinRoom(code: string, userId: number, username?: string) {
    return request<{
      roomId: number
      roomCode: string
      userId: number
      username: string
      joinedAt: string
    }>(`/api/rooms/${code}/join`, {
      method: 'POST',
      data: { userId, username },
    })
  },

  // 离开房间
  leaveRoom(code: string, userId: number) {
    return request<{ message: string }>(`/api/rooms/${code}/leave`, {
      method: 'POST',
      data: { userId },
    })
  },

  // 关闭房间
  closeRoom(code: string, userId: number) {
    return request<{ message: string }>(`/api/rooms/${code}/close`, {
      method: 'POST',
      data: { userId },
    })
  },

  // 获取房间成员列表
  getRoomMembers(code: string) {
    return request<Array<{
      id: number
      userId: number
      username: string
      user: {
        id: number
        username: string
      }
      joinedAt: string
      leftAt: string | null
    }>>(`/api/rooms/${code}/members`)
  },
}

// 转账相关API
export const transactionApi = {
  // 创建转账记录
  createTransaction(
    roomCode: string,
    fromUserId: number,
    toUserId: number,
    amount: number,
    description?: string
  ) {
    return request<{
      id: number
      roomId: number
      roomCode: string
      fromUser: {
        id: number
        username: string
      }
      toUser: {
        id: number
        username: string
      }
      amount: number
      description: string
      createdAt: string
    }>('/api/transactions', {
      method: 'POST',
      data: { roomCode, fromUserId, toUserId, amount, description },
    })
  },

  // 获取房间转账记录
  getRoomTransactions(code: string) {
    return request<Array<{
      id: number
      fromUser: {
        id: number
        username: string
      }
      toUser: {
        id: number
        username: string
      }
      amount: number
      description: string
      createdAt: string
    }>>(`/api/rooms/${code}/transactions`)
  },
}

// 活动记录API
export const activityApi = {
  // 获取房间活动记录
  getRoomActivities(code: string) {
    return request<Array<{
      type: 'join' | 'leave' | 'transaction'
      userId?: number
      username?: string
      fromUserId?: number
      fromUsername?: string
      toUserId?: number
      toUsername?: string
      amount?: number
      timestamp: string
      message: string
    }>>(`/api/rooms/${code}/activities`)
  },
}

