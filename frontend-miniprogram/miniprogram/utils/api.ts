// API工具函数 - 使用微信云托管
// 云环境配置
const CLOUD_ENV = 'prod-7grjmb7rc97903a2'  // 云环境ID
const CLOUD_SERVICE = 'express-xewk'  // 云托管服务名称

interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

// 通用请求函数 - 使用微信云托管 callContainer
async function request<T = any>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    data?: any
    header?: Record<string, string>
  } = {}
): Promise<T> {
  return new Promise((resolve, reject) => {
    // 在请求前打印日志
    const method = options.method || 'GET'
    const requestData = options.data || {}
    console.log(`[API请求] ${method} ${path}`, {
      method,
      path,
      data: requestData,
      header: options.header,
    })
    
    // 使用类型断言，因为 callContainer 可能不在类型定义中
    const cloud = wx.cloud as any
    cloud.callContainer({
      config: {
        env: CLOUD_ENV
      },
      path: path,
      header: {
        'X-WX-SERVICE': CLOUD_SERVICE,
        'content-type': 'application/json',
        ...options.header,
      },
      method: options.method || 'GET',
      data: options.data || {},
      success: (res: any) => {
        // 云托管返回的数据结构可能不同，需要适配
        const response = res.data as ApiResponse<T>
        if (response.code === 0) {
          resolve(response.data)
        } else {
          // 处理数据库相关错误
          const errorMessage = response.message || '请求失败'
          if (errorMessage.includes('resuming') || 
              errorMessage.includes('CynosDB') ||
              errorMessage.includes('数据库正在恢复中')) {
            reject(new Error('数据库正在恢复中，请稍后重试'))
          } else if (errorMessage.includes('数据库连接异常') ||
                     errorMessage.includes('连接异常')) {
            reject(new Error('数据库连接异常，请稍后重试'))
          } else {
            reject(new Error(errorMessage))
          }
        }
      },
      fail: (err: any) => {
        console.error('API请求失败:', err)
        const errorMsg = err.errMsg || '请求失败'
        // 处理数据库相关错误
        if (errorMsg.includes('resuming') || 
            errorMsg.includes('CynosDB') ||
            errorMsg.includes('数据库正在恢复中')) {
          reject(new Error('数据库正在恢复中，请稍后重试'))
        } else if (errorMsg.includes('数据库连接异常') ||
                   errorMsg.includes('连接异常') ||
                   errorMsg.includes('ECONNRESET')) {
          reject(new Error('数据库连接异常，请稍后重试'))
        } else {
          reject(new Error(errorMsg))
        }
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

  // 获取用户的房间历史
  getUserRooms(userId: number) {
    return request<Array<{
      room: {
        id: number
        code: string
        name: string
        owner: {
          id: number
          username: string
        }
        status: string
        createdAt: string
      }
      membership: {
        username: string
        joinedAt: string
        leftAt: string | null
      }
    }>>(`/api/users/${userId}/rooms`)
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

  // 获取房间完整状态（成员、转账记录、活动记录）
  getRoomStatus(code: string) {
    return request<{
      members: Array<{
        id: number
        userId: number
        username: string
        user: {
          id: number
          username: string
        }
        joinedAt: string
        leftAt: string | null
      }>
      transactions: Array<{
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
      }>
      activities: Array<{
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
      }>
    }>(`/api/rooms/${code}/status`)
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

