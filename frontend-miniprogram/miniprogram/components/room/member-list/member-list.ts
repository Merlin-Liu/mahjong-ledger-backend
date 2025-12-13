// member-list.ts
import { generateQRCodeImage, saveQRCodeToAlbum } from '../../../utils/qrcode'

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
  data: {
    showQRCodeDialog: false,
    qrCodeImageUrl: '',
    generatingQRCode: false
  },

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
    },

    // 生成二维码
    async onGenerateQRCode() {
      const roomCode = this.data.roomCode
      if (!roomCode) {
        wx.showToast({
          title: '房间号无效',
          icon: 'none',
        })
        return
      }

      this.setData({ generatingQRCode: true, showQRCodeDialog: true })

      try {
        // 使用后端接口生成小程序二维码
        // page: 页面路径，不能携带参数
        // scene: 场景值，会作为 query.scene 传递给小程序，格式为 'code=房间号'
        const pagePath = 'pages/room/room'
        const scene = `code=${roomCode}` // scene 最大32个字符
        
        // 生成二维码，宽度设置为 430px（默认值）
        const qrCodeImageUrl = await generateQRCodeImage(pagePath, scene, 430)
        this.setData({ 
          qrCodeImageUrl,
          generatingQRCode: false
        })
      } catch (err: any) {
        console.error('生成二维码失败:', err)
        this.setData({ generatingQRCode: false })
        wx.showToast({
          title: err.message || '生成二维码失败',
          icon: 'none',
        })
        // 如果生成失败，关闭弹窗
        setTimeout(() => {
          this.setData({ showQRCodeDialog: false })
        }, 2000)
      }
    },

    // 保存二维码到相册
    async onSaveQRCode() {
      const qrCodeImageUrl = this.data.qrCodeImageUrl
      if (!qrCodeImageUrl) {
        wx.showToast({
          title: '二维码未生成',
          icon: 'none',
        })
        return
      }

      try {
        await saveQRCodeToAlbum(qrCodeImageUrl)
      } catch (err: any) {
        console.error('保存二维码失败:', err)
        wx.showToast({
          title: err.message || '保存失败',
          icon: 'none',
        })
      }
    },

    // 关闭二维码弹窗
    onCloseQRCodeDialog() {
      this.setData({ 
        showQRCodeDialog: false,
        qrCodeImageUrl: ''
      })
    }
  }
})

