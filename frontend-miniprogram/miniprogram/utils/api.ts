// API工具函数 - 支持本地开发和生产环境
// ============================================
// 环境配置：设置为 true 使用本地开发环境，false 使用云托管生产环境
// ============================================
const IS_LOCAL_DEV = false  // 本地开发环境开关
const LOCAL_API_BASE_URL = 'http://localhost:80'  // 本地开发API地址

// 云托管配置
const CLOUD_ENV = 'prod-7grjmb7rc97903a2'  // 云环境ID
const CLOUD_SERVICE = 'express-xewk'  // 云托管服务名称

interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

// 统一的错误处理函数
function handleApiError(error: string | Error): Error {
  const errorMessage = typeof error === 'string' ? error : error.message || '请求失败'
  
  // 处理数据库相关错误
  if (errorMessage.includes('resuming') || 
      errorMessage.includes('CynosDB') ||
      errorMessage.includes('数据库正在恢复中')) {
    return new Error('数据库正在恢复中，请稍后重试')
  } else if (errorMessage.includes('数据库连接异常') ||
             errorMessage.includes('连接异常') ||
             errorMessage.includes('ECONNRESET')) {
    return new Error('数据库连接异常，请稍后重试')
  }
  
  return new Error(errorMessage)
}

// 本地开发环境请求函数 - 使用 wx.request
function requestLocal<T = any>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    data?: any
    header?: Record<string, string>
  } = {}
): Promise<T> {
  return new Promise((resolve, reject) => {
    const method = options.method || 'GET'
    const url = `${LOCAL_API_BASE_URL}${path}`
    
    console.log(`[本地API请求] ${method} ${url}`, {
      method,
      path,
      data: options.data,
      header: options.header,
    })
    
    wx.request({
      url,
      method: method as any,
      data: options.data || {},
      header: {
        'content-type': 'application/json',
        ...options.header,
      },
      success: (res) => {
        const response = res.data as ApiResponse<T>
        if (response.code === 0) {
          resolve(response.data)
        } else {
          reject(handleApiError(response.message || '请求失败'))
        }
      },
      fail: (err) => {
        console.error('[本地API请求失败]', err)
        reject(handleApiError(err.errMsg || '请求失败'))
      },
    })
  })
}

// 生产环境请求函数 - 使用微信云托管 callContainer
function requestCloud<T = any>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    data?: any
    header?: Record<string, string>
  } = {}
): Promise<T> {
  return new Promise((resolve, reject) => {
    const method = options.method || 'GET'
    
    console.log(`[云托管API请求] ${method} ${path}`, {
      method,
      path,
      data: options.data,
      header: options.header,
    })
    
    // 使用类型断言，因为 callContainer 可能不在类型定义中
    const cloud = wx.cloud as any
    cloud.callContainer({
      config: {
        env: CLOUD_ENV,
      },
      path: path,
      header: {
        'X-WX-SERVICE': CLOUD_SERVICE,
        'content-type': 'application/json',
        ...options.header,
      },
      method: method,
      data: options.data || {},
      success: (res: any) => {
        const response = res.data as ApiResponse<T>
        if (response.code === 0) {
          resolve(response.data)
        } else {
          reject(handleApiError(response.message || '请求失败'))
        }
      },
      fail: (err: any) => {
        console.error('[云托管API请求失败]', err)
        reject(handleApiError(err.errMsg || '请求失败'))
      },
    })
  })
}

// 通用请求函数 - 根据环境配置自动选择请求方式
async function request<T = any>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    data?: any
    header?: Record<string, string>
  } = {}
): Promise<T> {
  if (IS_LOCAL_DEV) {
    return requestLocal<T>(path, options)
  } else {
    return requestCloud<T>(path, options)
  }
}

// 用户相关API
export const userApi = {
  // 创建或获取用户
  createOrGetUser(wxOpenId: string, username: string, avatarUrl?: string) {
    return request<{
      id: number
      wxOpenId: string | null
      username: string
      avatarUrl: string | null
      createdAt: string
      isExistingUser: boolean  // 是否是已存在的用户（更新操作）
    }>('/api/users', {
      method: 'POST',
      data: { wxOpenId, username, avatarUrl },
    })
  },

  // 获取用户信息
  getUserInfo(userId: number) {
    return request<{
      id: number
      wxOpenId: string | null
      username: string
      avatarUrl: string | null
      createdAt: string
    }>(`/api/users/${userId}`)
  },

  // 获取用户的房间历史
  getUserRooms(userId: number, months: number = 3) {
    return request<Array<{
      room: {
        id: number
        code: string
        name: string
        owner: {
          id: number
          username: string
          avatarUrl: string | null
        }
        status: string
        createdAt: string
      }
      membership: {
        username: string
        joinedAt: string
        leftAt: string | null
      }
    }>>(`/api/users/${userId}/rooms?months=${months}`)
  },

  // 获取微信OpenID（从请求头获取，仅云开发环境）
  getWxOpenId() {
    return request<string>('/api/wx_openid')
  },
  
  // 通过 code 换取 openid（推荐方式，适用于所有环境）
  getWxOpenIdByCode(code: string) {
    return request<{ openid: string; session_key: string }>('/api/users/wx_openid_by_code', {
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
        avatarUrl: string | null
      }
      status: string
      members: Array<{
        id: number
        userId: number
        username: string
        user: {
          id: number
          username: string
          avatarUrl: string | null
        }
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
        avatarUrl: string | null
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
          avatarUrl: string | null
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
        avatarUrl: string | null
      }
      toUser: {
        id: number
        username: string
        avatarUrl: string | null
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
        avatarUrl: string | null
      }
      toUser: {
        id: number
        username: string
        avatarUrl: string | null
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

// 二维码 API
export const qrcodeApi = {
  /**
   * 生成小程序二维码
   * @param page 页面路径，例如 'pages/room/room'
   * @param scene 场景值，最大32个字符，例如 'code=123456'
   * @param width 二维码宽度，默认 430
   */
  generateQRCode(page: string, scene: string, width: number = 430) {
    return request<{
      base64: string
      contentType: string
    }>('/api/qrcode/generate', {
      method: 'POST',
      data: {
        page,
        scene,
        width
      }
    })
  },
}

