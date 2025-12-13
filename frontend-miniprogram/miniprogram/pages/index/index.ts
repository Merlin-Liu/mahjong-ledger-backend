// index.ts
import { userApi, roomApi } from '../../utils/api'
import { getUserUniqueId, uploadFileToCloud } from '../../utils/util'

interface IAppOption {
  globalData: {
    userInfo: {
      id: number
      username: string
      avatarUrl: string
      nickName: string
    } | null
    uniqueUserId: string | null  // 用户唯一ID（本地生成）
  }
}

const app = getApp<IAppOption>()
const defaultAvatarUrl = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

Page({
  data: {
    userInfo: {
      avatarUrl: defaultAvatarUrl,
      nickName: '',
    },
    userId: 0,
    loading: false,
    roomCodeInput: '',  // 房间号输入框
    showUserDialog: false,  // 显示用户信息输入对话框
    dialogNickName: '',  // 对话框中的昵称
    dialogAvatarUrl: defaultAvatarUrl,  // 对话框中的头像
    pendingAction: null as (() => Promise<void>) | null,  // 待执行的操作
    dialogConfirmBtn: { content: '创建', disabled: true },  // 确认按钮配置
    recentRooms: [] as Array<{
      id: number  // 房间 ID，用于 wx:key
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
      isOwner: boolean
      formattedCreatedAt: string
    }>,  // 最近的房间列表
    loadingRooms: false,  // 加载房间列表的状态
    isFirstLoad: true,  // 是否是首次加载
  },

  onLoad() {
    // 只加载用户信息用于显示，不阻止功能使用
    this.loadUserInfo()
    // 首次加载时，在 onLoad 中不调用 loadRecentRooms，避免与 onShow 重复调用
    // 房间列表会在 onShow 中加载
  },

  onShow() {
    // 每次显示页面时刷新用户信息和房间列表
    this.loadUserInfo()
    
    // 如果是首次加载，标记为已加载，避免重复调用
    if (this.data.isFirstLoad) {
      this.setData({ isFirstLoad: false })
      // 首次加载时，延迟一下确保用户信息已加载完成
      setTimeout(() => {
        this.loadRecentRooms()
      }, 100)
    } else {
      // 非首次加载（从后台回来），直接刷新
      this.loadRecentRooms()
    }
  },

  // 加载用户信息（仅用于显示）
  loadUserInfo() {
    const appUserInfo = (app.globalData as IAppOption['globalData']).userInfo
    if (appUserInfo && appUserInfo.id) {
      this.setData({
        userInfo: {
          avatarUrl: appUserInfo.avatarUrl || defaultAvatarUrl,
          nickName: appUserInfo.nickName || appUserInfo.username || '',
        },
        userId: appUserInfo.id,
      })
    } else {
      // 尝试从本地存储获取
      const storedUserInfo = wx.getStorageSync('userInfo') as any
      if (storedUserInfo && storedUserInfo.id) {
        this.setData({
          userInfo: {
            avatarUrl: storedUserInfo.avatarUrl || defaultAvatarUrl,
            nickName: storedUserInfo.nickName || storedUserInfo.username || '',
          },
          userId: storedUserInfo.id,
        })
        app.globalData.userInfo = storedUserInfo
      } else {
        // 没有用户信息，显示默认值
        this.setData({
          userInfo: {
            avatarUrl: defaultAvatarUrl,
            nickName: '',
          },
          userId: 0,
        })
      }
    }
  },

  // 加载最近的房间列表（最多5个）
  async loadRecentRooms() {
    // 如果正在加载，避免重复请求
    if (this.data.loadingRooms) {
      return
    }

    // 检查是否有用户ID
    if (!this.data.userId || this.data.userId === 0) {
      // 没有用户信息，清空房间列表
      this.setData({ recentRooms: [] })
      return
    }

    const userId = this.data.userId
    this.setData({ loadingRooms: true })

    try {
      const roomsData = await userApi.getUserRooms(userId, 3)
      
      // 处理房间数据，添加格式化时间和是否房主标志
      // 确保只显示用户创建或加入过的房间（后端已过滤，这里再次验证）
      // 按房间 ID 去重，保留最新的记录（按加入时间排序）
      const roomMap = new Map<number, typeof roomsData[0]>()
      
      roomsData
        .filter((item) => {
          // 验证：用户必须是房主，或者有membership记录（表示加入过）
          const isOwner = item.room.owner.id === userId
          const hasMembership = item.membership && item.membership.joinedAt
          return isOwner || hasMembership
        })
        .forEach((item) => {
          const roomId = item.room.id
          const existing = roomMap.get(roomId)
          
          // 如果房间不存在，或者当前记录的加入时间更新，则更新
          if (!existing || new Date(item.membership.joinedAt) > new Date(existing.membership.joinedAt)) {
            roomMap.set(roomId, item)
          }
        })
      
      // 转换为数组，按加入时间排序，取前5个
      const rooms = Array.from(roomMap.values())
        .sort((a, b) => {
          // 按加入时间降序排序（最新的在前）
          const timeA = new Date(a.membership.joinedAt).getTime()
          const timeB = new Date(b.membership.joinedAt).getTime()
          return timeB - timeA
        })
        .slice(0, 5) // 只取前5个
        .map((item) => {
          const isOwner = item.room.owner.id === userId
          const createdAt = new Date(item.room.createdAt)
          const formattedCreatedAt = this.formatDate(createdAt)
          
          return {
            id: item.room.id, // 添加唯一 id 用于 wx:key
            room: item.room,
            isOwner,
            formattedCreatedAt,
          }
        })

      this.setData({ recentRooms: rooms, loadingRooms: false })
    } catch (err: any) {
      console.error('加载房间列表失败:', err)
      // 加载失败不影响页面使用，静默处理
      this.setData({ recentRooms: [], loadingRooms: false })
    }
  },

  // 格式化日期
  formatDate(date: Date): string {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) {
      return '今天'
    } else if (days === 1) {
      return '昨天'
    } else if (days < 7) {
      return `${days}天前`
    } else if (days < 30) {
      const weeks = Math.floor(days / 7)
      return `${weeks}周前`
    } else {
      const months = Math.floor(days / 30)
      return `${months}个月前`
    }
  },

  // 点击房间卡片（从组件触发）
  onRecentRoomTap(e: any) {
    const { roomCode } = e.detail
    if (roomCode) {
      wx.navigateTo({
        url: `/pages/room/room?code=${roomCode}`,
      })
    }
  },

  // 检查用户信息，如果没有则弹出对话框
  async checkAndCreateUser(action: () => Promise<void>) {
    if (this.data.userId) {
      // 已有用户信息，直接执行操作
      await action()
      return
    }

    // 没有用户信息，保存待执行的操作并弹出对话框
    this.setData({
      pendingAction: action,
      showUserDialog: true,
      dialogNickName: '',
      dialogAvatarUrl: defaultAvatarUrl,
      dialogConfirmBtn: {
        content: '创建',
        disabled: true,
      },
    })
  },

  // 对话框中选择头像
  async onDialogChooseAvatar(e: any) {
    const { avatarUrl } = e.detail
    
    // avatarUrl 是临时文件路径，如 wxfile://tmp_xxx.jpg
    // 需要上传到云存储获取CDN URL
    wx.showLoading({ title: '上传中...' })
    
    try {
      // 上传到云存储，获取CDN URL
      const cdnUrl = await uploadFileToCloud(avatarUrl)
      
      // 更新对话框中的头像URL为CDN地址
      this.setData({
        dialogAvatarUrl: cdnUrl,
      })
      
      wx.hideLoading()
      wx.showToast({
        title: '头像选择成功',
        icon: 'success',
        duration: 1500,
      })
    } catch (err: any) {
      wx.hideLoading()
      console.error('上传头像失败:', err)
      wx.showToast({
        title: err.message || '上传头像失败',
        icon: 'none',
        duration: 2000,
      })
      // 即使上传失败，也显示临时文件（至少可以看到预览）
      this.setData({
        dialogAvatarUrl: avatarUrl,
      })
    }
  },

  // 对话框输入昵称
  onDialogNickNameInput(e: any) {
    const value = e.detail?.value ?? e.detail ?? ''
    const nickName = typeof value === 'string' ? value : ''
    const trimmedNickName = nickName.trim()
    
    this.setData({
      dialogNickName: nickName,
      dialogConfirmBtn: {
        content: '创建',
        disabled: !trimmedNickName || trimmedNickName.length === 0,
      },
    })
  },

  // 关闭对话框
  onDialogClose() {
    this.setData({
      showUserDialog: false,
      pendingAction: null,
    })
  },

  // 确认创建用户
  async onDialogConfirm() {
    const { dialogNickName, dialogAvatarUrl, dialogConfirmBtn } = this.data
    
    // 如果按钮被禁用，直接返回
    if (dialogConfirmBtn.disabled) {
      return
    }
    
    if (!dialogNickName || !dialogNickName.trim()) {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none',
      })
      return
    }

    if (dialogAvatarUrl === defaultAvatarUrl) {
      wx.showToast({
        title: '请选择头像',
        icon: 'none',
      })
      return
    }

    try {
      // 创建用户
      await this.createOrUpdateUser(dialogNickName.trim(), dialogAvatarUrl)
      
      // 关闭对话框
      this.setData({
        showUserDialog: false,
      })

      // 执行待执行的操作
      const action = this.data.pendingAction
      if (action) {
        this.setData({ pendingAction: null })
        await action()
      }
    } catch (err: any) {
      console.error('创建用户失败:', err)
      wx.showToast({
        title: err.message || '创建用户失败',
        icon: 'none',
      })
    }
  },


  // 创建或更新用户
  async createOrUpdateUser(username: string, avatarUrl: string) {
    // 获取微信真实 OpenID
    let wxOpenId: string | null = null
    
    try {
      // 先尝试从本地存储获取已保存的 openid
      wxOpenId = wx.getStorageSync('wxOpenId')
      
      // 如果没有，则通过 wx.login 获取
      if (!wxOpenId) {
        // 显示加载提示
        wx.showToast({
          title: '正在获取用户信息...',
          icon: 'loading',
          duration: 2000,
        })
        
        const loginRes = await new Promise<any>((resolve, reject) => {
          wx.login({
            success: resolve,
            fail: reject,
          })
        })
        
        if (loginRes.code) {
          // 通过 code 换取 openid
          const openIdRes = await userApi.getWxOpenIdByCode(loginRes.code)
          wxOpenId = openIdRes.openid
          
          // 保存 openid 到本地存储
          wx.setStorageSync('wxOpenId', wxOpenId)
          
          // 显示成功提示
          wx.showToast({
            title: '获取用户信息成功',
            icon: 'success',
            duration: 1500,
          })
        }
      }
    } catch (err: any) {
      // 记录详细的错误信息，方便调试
      const errorMessage = err.message || err.errMsg || '未知错误'
      console.error('获取微信 OpenID 失败:', {
        error: errorMessage,
        details: err,
        hint: '如果是本地开发，请确保后端已配置 WX_APPID 和 WX_SECRET 环境变量'
      })
      
      // 显示错误提示
      wx.showToast({
        title: '获取用户信息失败',
        icon: 'none',
        duration: 2000,
      })
      
      // 如果获取 openid 失败，使用本地生成的唯一ID作为降级方案
      const globalData = app.globalData as IAppOption['globalData']
      wxOpenId = globalData.uniqueUserId || getUserUniqueId()
      console.log('使用本地生成的唯一ID作为降级方案:', wxOpenId)
    }
    
    // 使用微信 OpenID（或降级方案）作为 wxOpenId 传给后端
    const userData = await userApi.createOrGetUser(wxOpenId || '', username, avatarUrl)
    
    // 如果是已存在的用户（更新操作），显示提示
    if (userData.isExistingUser) {
      wx.showToast({
        title: '欢迎回来，已更新您的信息',
        icon: 'success',
        duration: 2000,
      })
    }
    
    const userInfo: IAppOption['globalData']['userInfo'] = {
      id: userData.id,
      username: userData.username,
      avatarUrl,
      nickName: username,
    }
    
    this.setData({
      userId: userData.id,
      userInfo: {
        avatarUrl,
        nickName: username,
      },
    })
    
    // 保存到全局和本地存储
    app.globalData.userInfo = userInfo
    wx.setStorageSync('userInfo', userInfo)
    
    // 用户创建或更新后，重新加载房间列表
    this.loadRecentRooms()
  },

  // 开房间
  async createRoom() {
    if (this.data.loading) return

    await this.checkAndCreateUser(async () => {
      this.setData({ loading: true })
      wx.showLoading({ title: '创建中...' })

      try {
        const room = await roomApi.createRoom(this.data.userId, '我的房间')
        wx.hideLoading()
        wx.showToast({
          title: '房间创建成功',
          icon: 'success',
        })
        
        // 跳转到房间页面
        setTimeout(() => {
          wx.redirectTo({
            url: `/pages/room/room?code=${room.code}`,
          })
        }, 1000)
      } catch (err: any) {
        wx.hideLoading()
        console.error('创建房间失败:', err)
        const errorMessage = err.message || '创建房间失败'
        
        // 如果是数据库相关错误，提供重试选项
        if (errorMessage.includes('数据库正在恢复中') || 
            errorMessage.includes('数据库连接异常') ||
            errorMessage.includes('resuming')) {
          const isConnecting = errorMessage.includes('连接异常')
          wx.showModal({
            title: '提示',
            content: isConnecting 
              ? '数据库连接异常，请稍后重试。是否立即重试？'
              : '数据库正在恢复中，请稍后重试。是否立即重试？',
            confirmText: '重试',
            cancelText: '取消',
            success: (res) => {
              if (res.confirm) {
                // 延迟2秒后重试
                setTimeout(() => {
                  this.createRoom()
                }, 2000)
              } else {
                this.setData({ loading: false })
              }
            },
          })
        } else {
          wx.showToast({
            title: errorMessage,
            icon: 'none',
            duration: 3000,
          })
          this.setData({ loading: false })
        }
      }
    })
  },

  // 输入房间号
  onRoomCodeInput(e: any) {
    const value = e.detail.value
    this.setData({
      roomCodeInput: value  // 不立即trim，保留用户输入，在提交时再trim
    })
  },

  // 通过房间号加入房间
  async joinRoomByCode() {
    const roomCode = this.data.roomCodeInput.trim()
    
    if (!roomCode) {
      wx.showToast({
        title: '请输入房间号',
        icon: 'none',
      })
      return
    }

    if (this.data.loading) return

    await this.checkAndCreateUser(async () => {
      this.setData({ loading: true })
      wx.showLoading({ title: '加入中...' })

      try {
        // 先获取房间信息
        await roomApi.getRoomInfo(roomCode)
        
        // 加入房间
        await roomApi.joinRoom(roomCode, this.data.userId)
        
        wx.hideLoading()
        wx.showToast({
          title: '加入房间成功',
          icon: 'success',
        })
        
        // 清空输入框
        this.setData({ roomCodeInput: '' })
        
        // 跳转到房间页面
        setTimeout(() => {
          wx.redirectTo({
            url: `/pages/room/room?code=${roomCode}`,
          })
        }, 1000)
      } catch (err: any) {
        wx.hideLoading()
        console.error('加入房间失败:', err)
        const errorMessage = err.message || '加入房间失败'
        
        // 如果已经在房间中，直接跳转到房间页面
        if (errorMessage.includes('已经在房间中') || errorMessage.includes('已在房间中')) {
          // 清空输入框
          this.setData({ roomCodeInput: '', loading: false })
          // 直接跳转到房间页面
          wx.redirectTo({
            url: `/pages/room/room?code=${roomCode}`,
          })
          return
        }
        
        // 如果是数据库相关错误，提供重试选项
        if (errorMessage.includes('数据库正在恢复中') || 
            errorMessage.includes('数据库连接异常') ||
            errorMessage.includes('resuming')) {
          const isConnecting = errorMessage.includes('连接异常')
          wx.showModal({
            title: '提示',
            content: isConnecting 
              ? '数据库连接异常，请稍后重试。是否立即重试？'
              : '数据库正在恢复中，请稍后重试。是否立即重试？',
            confirmText: '重试',
            cancelText: '取消',
            success: (res) => {
              if (res.confirm) {
                setTimeout(() => {
                  this.joinRoomByCode()
                }, 2000)
              } else {
                this.setData({ loading: false })
              }
            },
          })
        } else {
          wx.showToast({
            title: errorMessage,
            icon: 'none',
            duration: 3000,
          })
          this.setData({ loading: false })
        }
      }
    })
  },

  // 跳转到房间列表
  goToRoomList() {
    wx.navigateTo({
      url: '/pages/room-list/room-list',
    })
  },

  // 扫码进入房间
  scanCode() {
    this.checkAndCreateUser(async () => {
      wx.scanCode({
        success: async (res) => {
        const roomCode = res.result
        if (!roomCode) {
          wx.showToast({
            title: '无效的房间号',
            icon: 'none',
          })
          return
        }

        wx.showLoading({ title: '加入中...' })
        try {
          // 先获取房间信息
          await roomApi.getRoomInfo(roomCode)
          
          // 加入房间
          await roomApi.joinRoom(roomCode, this.data.userId)
          
          wx.hideLoading()
          wx.showToast({
            title: '加入房间成功',
            icon: 'success',
          })
          
          // 跳转到房间页面
          setTimeout(() => {
            wx.redirectTo({
              url: `/pages/room/room?code=${roomCode}`,
            })
          }, 1000)
        } catch (err: any) {
          wx.hideLoading()
          console.error('加入房间失败:', err)
          const errorMessage = err.message || '加入房间失败'
          
          // 如果已经在房间中，直接跳转到房间页面
          if (errorMessage.includes('已经在房间中') || errorMessage.includes('已在房间中')) {
            wx.redirectTo({
              url: `/pages/room/room?code=${roomCode}`,
            })
          } else if (errorMessage.includes('数据库正在恢复中') || 
                     errorMessage.includes('数据库连接异常') ||
                     errorMessage.includes('resuming')) {
            // 数据库相关错误，提供重试选项
            const isConnecting = errorMessage.includes('连接异常')
            wx.showModal({
              title: '提示',
              content: isConnecting 
                ? '数据库连接异常，请稍后重试。是否立即重试？'
                : '数据库正在恢复中，请稍后重试。是否立即重试？',
              confirmText: '重试',
              cancelText: '取消',
              success: (res) => {
                if (res.confirm) {
                  setTimeout(() => {
                    this.scanCode()
                  }, 2000)
                }
              },
            })
          } else {
            wx.showToast({
              title: errorMessage,
              icon: 'none',
            })
          }
        }
      },
      fail: (err) => {
        console.error('扫码失败:', err)
        if (err.errMsg !== 'scanCode:fail cancel') {
          wx.showToast({
            title: '扫码失败',
            icon: 'none',
          })
        }
      },
    })
    })
  },

  // 分享小程序给好友
  onShareAppMessage() {
    return {
      title: '打牌记账 - 一起来记账吧！',
      path: '/pages/index/index',
      imageUrl: '/images/share/share-card.png', // 自定义分享图片
    }
  },
})

