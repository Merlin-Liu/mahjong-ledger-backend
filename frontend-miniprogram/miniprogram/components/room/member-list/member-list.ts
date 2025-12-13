// member-list.ts
interface Member {
  id: number
  userId: number
  username: string
  avatarUrl?: string | null
  balance?: number
  formattedBalance?: string
}

Component({
  /**
   * 组件的属性列表
   */
  properties: {
    members: {
      type: Array,
      value: [] as Member[]
    },
    roomCode: {
      type: String,
      value: ''
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
    onMemberTap(e: any) {
      const member = e.currentTarget.dataset.member as Member
      this.triggerEvent('membertap', { member })
    },

    onCopyRoomCode() {
      // 复制房间号
      wx.setClipboardData({
        data: this.data.roomCode,
        success: () => {
          wx.showToast({
            title: '房间号已复制',
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
    }
  }
})

