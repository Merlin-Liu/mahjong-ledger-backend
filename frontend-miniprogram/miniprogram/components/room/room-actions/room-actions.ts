// room-actions.ts
import { roomApi } from '../../../utils/api'

Component({
  /**
   * 组件的属性列表
   */
  properties: {
    isOwner: {
      type: Boolean,
      value: false
    },
    roomCode: {
      type: String,
      value: ''
    },
    userId: {
      type: Number,
      value: 0
    }
  },

  /**
   * 组件的初始数据
   */
  data: {},

  /**
   * 组件的方法列表
   */
  methods: {
    // 离开房间
    async onLeaveRoom() {
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
              
              // 通知父组件清除定时器
              this.triggerEvent('leaveroom', { success: true })
              
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
              this.triggerEvent('leaveroom', { success: false })
            }
          }
        },
      })
    },

    // 结束房间
    async onCloseRoom() {
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
              
              // 通知父组件清除定时器
              this.triggerEvent('closeroom', { success: true })
              
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
              this.triggerEvent('closeroom', { success: false })
            }
          }
        },
      })
    }
  }
})

