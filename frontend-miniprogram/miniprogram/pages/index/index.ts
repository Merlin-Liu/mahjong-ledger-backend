// index.ts
import { userApi, roomApi } from '../../utils/api'
import { getUserUniqueId } from '../../utils/util'

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
    hasUserInfo: false,
    userId: 0,
    loading: false,
  },

  onLoad() {
    this.initUserInfo()
  },

  onShow() {
    // 每次显示页面时刷新用户信息
    this.initUserInfo()
  },

  // 初始化用户信息
  async initUserInfo() {
    const appUserInfo = (app.globalData as IAppOption['globalData']).userInfo
    if (appUserInfo && appUserInfo.id) {
      this.setData({
        userInfo: {
          avatarUrl: appUserInfo.avatarUrl || defaultAvatarUrl,
          nickName: appUserInfo.nickName || appUserInfo.username || '',
        },
        userId: appUserInfo.id,
        hasUserInfo: true,
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
          hasUserInfo: true,
        })
        app.globalData.userInfo = storedUserInfo
      }
    }
  },

  // 选择头像
  async onChooseAvatar(e: any) {
    const { avatarUrl } = e.detail
    this.setData({
      'userInfo.avatarUrl': avatarUrl,
    })
    
    // 如果头像和昵称都有了，自动创建用户
    if (avatarUrl && this.data.userInfo.nickName) {
      await this.createOrUpdateUser(this.data.userInfo.nickName, avatarUrl)
    }
  },

  // 输入昵称
  async onInputChange(e: any) {
    const nickName = e.detail.value
    this.setData({
      'userInfo.nickName': nickName,
    })
    
    // 如果头像和昵称都有了，自动创建用户
    if (nickName && this.data.userInfo.avatarUrl && this.data.userInfo.avatarUrl !== defaultAvatarUrl) {
      await this.createOrUpdateUser(nickName, this.data.userInfo.avatarUrl)
    }
  },


  // 创建或更新用户
  async createOrUpdateUser(username: string, avatarUrl: string) {
    try {
      // 获取用户唯一ID（本地生成，无需后端）
      const globalData = app.globalData as IAppOption['globalData']
      const uniqueUserId = globalData.uniqueUserId || getUserUniqueId()
      
      // 使用本地生成的唯一ID作为wxOpenId传给后端
      const userData = await userApi.createOrGetUser(uniqueUserId, username)
      
      const userInfo: IAppOption['globalData']['userInfo'] = {
        id: userData.id,
        username: userData.username,
        avatarUrl,
        nickName: username,
      }
      
      this.setData({
        userId: userData.id,
      })
      
      // 保存到全局和本地存储
      globalData.userInfo = userInfo
      wx.setStorageSync('userInfo', userInfo)
    } catch (err: any) {
      console.error('创建用户失败:', err)
      wx.showToast({
        title: err.message || '创建用户失败',
        icon: 'none',
      })
    }
  },

  // 开房间
  async createRoom() {
    if (!this.data.userId) {
      wx.showToast({
        title: '请先完善用户信息',
        icon: 'none',
      })
      return
    }

    if (this.data.loading) return

    this.setData({ loading: true })

    try {
      const room = await roomApi.createRoom(this.data.userId, '我的房间')
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
      console.error('创建房间失败:', err)
      wx.showToast({
        title: err.message || '创建房间失败',
        icon: 'none',
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 扫码进入房间
  scanCode() {
    if (!this.data.userId) {
      wx.showToast({
        title: '请先完善用户信息',
        icon: 'none',
      })
      return
    }

    wx.scanCode({
      success: async (res) => {
        const roomCode = res.result
        if (!roomCode) {
          wx.showToast({
            title: '无效的房间码',
            icon: 'none',
          })
          return
        }

        try {
          // 先获取房间信息
          await roomApi.getRoomInfo(roomCode)
          
          // 加入房间
          await roomApi.joinRoom(roomCode, this.data.userId)
          
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
          console.error('加入房间失败:', err)
          wx.showToast({
            title: err.message || '加入房间失败',
            icon: 'none',
          })
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
  },
})
