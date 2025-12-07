// room-log.ts
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
  formattedTime?: string
}

Component({
  /**
   * 组件的属性列表
   */
  properties: {
    activities: {
      type: Array,
      value: [] as Activity[]
    }
  },

  /**
   * 组件的初始数据
   */
  data: {
    formattedActivities: [] as Activity[]
  },

  /**
   * 组件的方法列表
   */
  methods: {
    // 格式化时间 - 如果是当天只显示时分秒，否则显示月日时分秒
    formatTime(timestamp: string): string {
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
        
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
        
        const hour = date.getHours()
        const minute = date.getMinutes()
        const second = date.getSeconds()
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`
        
        // 如果是当天，只返回时分秒
        if (targetDate.getTime() === today.getTime()) {
          return timeStr
        }
        
        // 否则返回月日时分秒
        const month = date.getMonth() + 1
        const day = date.getDate()
        return `${month}月${day}日 ${timeStr}`
      } catch (err) {
        console.error('格式化时间失败:', err, timestamp)
        return ''
      }
    }
  },

  /**
   * 属性观察器
   */
  observers: {
    'activities': function(activities: Activity[]) {
      // 格式化活动记录时间并反转顺序（最新的在前）
      const that = this as any
      const formattedActivities = [...activities].reverse().map((activity) => ({
        ...activity,
        formattedTime: that.formatTime(activity.timestamp)
      }))
      that.setData({ formattedActivities })
    }
  }
})

