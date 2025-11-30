// app.ts
import { getUserUniqueId } from './utils/util'

interface IAppOption {
  globalData: {
    userInfo: {
      id: number
      username: string
      avatarUrl: string
      nickName: string
    } | null
    uniqueUserId: string | null  // 用户唯一ID（本地生成，无需后端）
  }
}

App<IAppOption>({
  globalData: {
    userInfo: null,
    uniqueUserId: null,
  },
  onLaunch() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'prod-7grjmb7rc97903a2',  // 云环境ID
        traceUser: true,
      })
    }
    
    // 直接获取用户唯一ID（本地生成，无需后端接口）
    const uniqueId = getUserUniqueId()
    this.globalData.uniqueUserId = uniqueId
    
    // 尝试从本地存储获取用户信息
    const storedUserInfo = wx.getStorageSync('userInfo')
    if (storedUserInfo) {
      this.globalData.userInfo = storedUserInfo
    }
  },
})