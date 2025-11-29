// room.ts
import { roomApi, activityApi, transactionApi } from '../../utils/api'

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

interface Member {
  id: number
  userId: number
  username: string
  user: {
    id: number
    username: string
  }
  joinedAt: string
  leftAt: string | null
  balance?: number
}

interface Activity {
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
}

Page({
  data: {
    roomCode: '',
    roomInfo: null as any,
    members: [] as Member[],
    activities: [] as Activity[],
    userId: 0,
    isOwner: false,
    loading: false,
    pollTimer: null as any,
  },

  onLoad(options: { code: string }) {
    const { code } = options
    if (!code) {
      wx.showToast({
        title: '房间码无效',
        icon: 'none',
      })
      setTimeout(() => {
        // 返回到主页
        wx.reLaunch({
          url: '/pages/index/index'
        })
      }, 1500)
      return
    }

    this.setData({ roomCode: code })
    this.initRoom()
  },

  onUnload() {
    // 清除定时器
    if (this.data.pollTimer) {
      clearInterval(this.data.pollTimer)
    }
  },

  // 初始化房间
  async initRoom() {
    const userInfo = (app.globalData as IAppOption['globalData']).userInfo
    if (!userInfo || !userInfo.id) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
      })
      setTimeout(() => {
        // 返回到主页
        wx.reLaunch({
          url: '/pages/index/index'
        })
      }, 1500)
      return
    }

    const userId = userInfo.id
    this.setData({ userId })
    
    try {
      // 先尝试获取房间信息，如果失败则尝试加入房间
      await this.loadRoomInfo()
    } catch (err) {
      // 如果获取房间信息失败，尝试加入房间
      try {
        await roomApi.joinRoom(this.data.roomCode, userId)
        wx.showToast({
          title: '已加入房间',
          icon: 'success',
        })
        // 重新加载房间信息
        await this.loadRoomInfo()
      } catch (joinErr: any) {
        console.error('加入房间失败:', joinErr)
        wx.showToast({
          title: joinErr.message || '加入房间失败',
          icon: 'none',
        })
        setTimeout(() => {
          // 返回到主页
          wx.reLaunch({
            url: '/pages/index/index'
          })
        }, 1500)
        return
      }
    }
    
    await this.loadMembers()
    await this.loadActivities()
    
    // 开始定时轮询
    this.startPolling()
  },

  // 加载房间信息
  async loadRoomInfo() {
    try {
      const roomInfo = await roomApi.getRoomInfo(this.data.roomCode)
      const isOwner = roomInfo.owner.id === this.data.userId
      this.setData({
        roomInfo,
        isOwner,
      })
    } catch (err: any) {
      console.error('加载房间信息失败:', err)
      wx.showToast({
        title: err.message || '加载房间信息失败',
        icon: 'none',
      })
    }
  },

  // 加载成员列表
  async loadMembers() {
    try {
      const members = await roomApi.getRoomMembers(this.data.roomCode)
      
      // 计算每个成员在当前房间的虚拟"钱"
      const transactions = await transactionApi.getRoomTransactions(this.data.roomCode)
      const memberBalances = new Map<number, number>()
      
      members.forEach((member) => {
        memberBalances.set(member.userId, 0)
      })
      
      transactions.forEach((tx) => {
        const fromBalance = memberBalances.get(tx.fromUser.id) || 0
        const toBalance = memberBalances.get(tx.toUser.id) || 0
        memberBalances.set(tx.fromUser.id, fromBalance - tx.amount)
        memberBalances.set(tx.toUser.id, toBalance + tx.amount)
      })
      
      // 添加余额到成员数据
      const membersWithBalance = members.map((member) => ({
        ...member,
        balance: memberBalances.get(member.userId) || 0,
      }))
      
      this.setData({ members: membersWithBalance })
    } catch (err: any) {
      console.error('加载成员列表失败:', err)
    }
  },

  // 加载活动记录
  async loadActivities() {
    try {
      const activities = await activityApi.getRoomActivities(this.data.roomCode)
      this.setData({ activities: activities.reverse() }) // 最新的在前
    } catch (err: any) {
      console.error('加载活动记录失败:', err)
    }
  },

  // 开始定时轮询
  startPolling() {
    // 每5秒轮询一次
    const timer = setInterval(() => {
      this.loadMembers()
      this.loadActivities()
    }, 5000)
    
    this.setData({ pollTimer: timer })
  },

  // 分享房间
  onShareAppMessage() {
    return {
      title: `邀请你加入房间 ${this.data.roomCode}`,
      path: `/pages/room/room?code=${this.data.roomCode}`,
      imageUrl: '', // 可以设置分享图片
    }
  },

  // 分享到朋友圈
  onShareTimeline() {
    return {
      title: `邀请你加入房间 ${this.data.roomCode}`,
      query: `code=${this.data.roomCode}`,
    }
  },

  // 离开房间
  async leaveRoom() {
    wx.showModal({
      title: '确认离开',
      content: '确定要离开房间吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await roomApi.leaveRoom(this.data.roomCode, this.data.userId)
            wx.showToast({
              title: '已离开房间',
              icon: 'success',
            })
            
            // 清除定时器
            if (this.data.pollTimer) {
              clearInterval(this.data.pollTimer)
            }
            
            setTimeout(() => {
              // 返回到主页
              wx.reLaunch({
                url: '/pages/index/index'
              })
            }, 1000)
          } catch (err: any) {
            console.error('离开房间失败:', err)
            wx.showToast({
              title: err.message || '离开房间失败',
              icon: 'none',
            })
          }
        }
      },
    })
  },

  // 结束房间
  async closeRoom() {
    if (!this.data.isOwner) {
      wx.showToast({
        title: '只有房主可以结束房间',
        icon: 'none',
      })
      return
    }

    wx.showModal({
      title: '确认结束',
      content: '确定要结束房间吗？结束后所有成员将被移除。',
      success: async (res) => {
        if (res.confirm) {
          try {
            await roomApi.closeRoom(this.data.roomCode, this.data.userId)
            wx.showToast({
              title: '房间已结束',
              icon: 'success',
            })
            
            // 清除定时器
            if (this.data.pollTimer) {
              clearInterval(this.data.pollTimer)
            }
            
            setTimeout(() => {
              // 返回到主页
              wx.reLaunch({
                url: '/pages/index/index'
              })
            }, 1000)
          } catch (err: any) {
            console.error('结束房间失败:', err)
            wx.showToast({
              title: err.message || '结束房间失败',
              icon: 'none',
            })
          }
        }
      },
    })
  },

  // 格式化时间
  formatTime(timestamp: string) {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    
    if (minutes < 1) {
      return '刚刚'
    } else if (minutes < 60) {
      return `${minutes}分钟前`
    } else if (minutes < 1440) {
      return `${Math.floor(minutes / 60)}小时前`
    } else {
      const month = date.getMonth() + 1
      const day = date.getDate()
      const hour = date.getHours()
      const minute = date.getMinutes()
      return `${month}-${day} ${hour}:${minute.toString().padStart(2, '0')}`
    }
  },
})

