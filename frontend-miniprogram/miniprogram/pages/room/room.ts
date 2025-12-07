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
  avatarUrl?: string | null  // 头像URL（从 user.avatarUrl 提取到顶层）
  user: {
    id: number
    username: string
    avatarUrl: string | null
  }
  joinedAt: string
  leftAt: string | null
  balance?: number
  formattedBalance?: string  // 格式化后的余额显示
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
  formattedTime?: string  // 格式化后的时间
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
    // 转账对话框相关
    showTransactionDialog: false,
    targetMember: null as Member | null,
    transactionAmount: '',
    transactionDescription: '',
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
    
    // 初始加载房间状态（成员、转账、活动）
    await this.loadRoomStatus()
    
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

  // 加载房间状态（成员、转账、活动）
  async loadRoomStatus() {
    try {
      const status = await roomApi.getRoomStatus(this.data.roomCode)
      
      // 计算每个成员在当前房间的虚拟"钱"
      const memberBalances = new Map<number, number>()
      
      status.members.forEach((member) => {
        memberBalances.set(member.userId, 0)
      })
      
      status.transactions.forEach((tx) => {
        const fromBalance = memberBalances.get(tx.fromUser.id) || 0
        const toBalance = memberBalances.get(tx.toUser.id) || 0
        memberBalances.set(tx.fromUser.id, fromBalance - tx.amount)
        memberBalances.set(tx.toUser.id, toBalance + tx.amount)
      })
      
      // 添加余额到成员数据，并格式化余额显示
      const membersWithBalance = status.members.map((member) => {
        const balance = memberBalances.get(member.userId) || 0
        return {
          ...member,
          avatarUrl: member.user?.avatarUrl || null, // 将头像字段提取到顶层
          balance,
          formattedBalance: `${balance >= 0 ? '+' : ''}${balance.toFixed(2)} 元`,
        }
      })
      
      // 格式化活动记录时间并反转顺序（最新的在前）
      const formattedActivities = status.activities.reverse().map((activity) => ({
        ...activity,
        formattedTime: this.formatTime(activity.timestamp)
      }))
      
      this.setData({ 
        members: membersWithBalance,
        activities: formattedActivities
      })
    } catch (err: any) {
      console.error('加载房间状态失败:', err)
    }
  },

  // 加载成员列表（保留用于初始化）
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
      
      // 添加余额到成员数据，并格式化余额显示
      const membersWithBalance = members.map((member) => {
        const balance = memberBalances.get(member.userId) || 0
        return {
          ...member,
          avatarUrl: member.user?.avatarUrl || null, // 将头像字段提取到顶层
          balance,
          formattedBalance: `${balance >= 0 ? '+' : ''}${balance.toFixed(2)} 元`,
        }
      })
      
      this.setData({ members: membersWithBalance })
    } catch (err: any) {
      console.error('加载成员列表失败:', err)
    }
  },

  // 加载活动记录（保留用于初始化）
  async loadActivities() {
    try {
      const activities = await activityApi.getRoomActivities(this.data.roomCode)
      // 格式化时间并反转顺序（最新的在前）
      const formattedActivities = activities.reverse().map((activity) => ({
        ...activity,
        formattedTime: this.formatTime(activity.timestamp)
      }))
      this.setData({ activities: formattedActivities })
    } catch (err: any) {
      console.error('加载活动记录失败:', err)
    }
  },

  // 开始定时轮询
  startPolling() {
    // 每5秒轮询一次房间状态
    const timer = setInterval(() => {
      this.loadRoomStatus()
    }, 5000)
    
    this.setData({ pollTimer: timer })
  },

  // 复制房间ID
  copyRoomCode() {
    wx.setClipboardData({
      data: this.data.roomCode,
      success: () => {
        wx.showToast({
          title: '房间ID已复制',
          icon: 'success',
        })
      },
      fail: () => {
        wx.showToast({
          title: '复制失败',
          icon: 'none',
        })
      },
    })
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

  // 格式化时间 - 显示月日时分秒
  formatTime(timestamp: string) {
    if (!timestamp) {
      return ''
    }

    try {
      const date = new Date(timestamp)
      // 检查日期是否有效
      if (isNaN(date.getTime())) {
        console.error('无效的时间戳:', timestamp)
        return ''
      }
      const month = date.getMonth() + 1
      const day = date.getDate()
      const hour = date.getHours()
      const minute = date.getMinutes()
      const second = date.getSeconds()
      
      return `${month}月${day}日 ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`
    } catch (err) {
      console.error('格式化时间失败:', err, timestamp)
      return ''
    }
  },

  // 点击成员卡片
  onMemberTap(e: any) {
    const member = e.currentTarget.dataset.member as Member
    
    // 不能向自己转账
    if (member.userId === this.data.userId) {
      wx.showToast({
        title: '不能向自己转账',
        icon: 'none',
      })
      return
    }

    this.setData({
      showTransactionDialog: true,
      targetMember: member,
      transactionAmount: '',
      transactionDescription: '',
    })
  },

  // 转账金额输入
  onTransactionAmountInput(e: any) {
    this.setData({
      transactionAmount: e.detail.value,
    })
  },

  // 转账备注输入
  onTransactionDescriptionInput(e: any) {
    this.setData({
      transactionDescription: e.detail.value,
    })
  },

  // 确认转账
  async onTransactionConfirm() {
    const { targetMember, transactionAmount, transactionDescription, roomCode, userId } = this.data

    if (!targetMember) {
      return
    }

    // 验证金额
    const amount = parseFloat(transactionAmount)
    if (!transactionAmount || isNaN(amount) || amount <= 0) {
      wx.showToast({
        title: '请输入有效的转账金额',
        icon: 'none',
      })
      return
    }

    try {
      // 调用转账API
      await transactionApi.createTransaction(
        roomCode,
        userId,
        targetMember.userId,
        amount,
        transactionDescription.trim() || undefined
      )

      wx.showToast({
        title: '转账成功',
        icon: 'success',
      })

      // 关闭对话框
      this.setData({
        showTransactionDialog: false,
        targetMember: null,
        transactionAmount: '',
        transactionDescription: '',
      })

      // 重新加载房间状态
      await this.loadRoomStatus()
    } catch (err: any) {
      console.error('转账失败:', err)
      wx.showToast({
        title: err.message || '转账失败',
        icon: 'none',
      })
    }
  },

  // 取消转账
  onTransactionCancel() {
    this.setData({
      showTransactionDialog: false,
      targetMember: null,
      transactionAmount: '',
      transactionDescription: '',
    })
  },
})

