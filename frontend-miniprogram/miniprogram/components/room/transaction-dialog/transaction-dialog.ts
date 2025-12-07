// transaction-dialog.ts
interface Member {
  id: number
  userId: number
  username: string
  avatarUrl?: string | null
}

Component({
  /**
   * 组件的属性列表
   */
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    targetMember: {
      type: Object,
      value: null as Member | null
    }
  },

  /**
   * 组件的初始数据
   */
  data: {
    transactionAmount: '',
    transactionDescription: ''
  },

  /**
   * 组件的方法列表
   */
  methods: {
    onAmountInput(e: any) {
      this.setData({
        transactionAmount: e.detail.value
      })
      this.triggerEvent('amountinput', { value: e.detail.value })
    },

    onDescriptionInput(e: any) {
      this.setData({
        transactionDescription: e.detail.value
      })
      this.triggerEvent('descriptioninput', { value: e.detail.value })
    },

    onConfirm() {
      this.triggerEvent('confirm', {
        amount: this.data.transactionAmount,
        description: this.data.transactionDescription
      })
    },

    onCancel() {
      this.setData({
        transactionAmount: '',
        transactionDescription: ''
      })
      this.triggerEvent('cancel')
    }
  },

  observers: {
    'visible': function(visible: boolean) {
      if (visible) {
        // 对话框打开时重置表单
        this.setData({
          transactionAmount: '',
          transactionDescription: ''
        })
      }
    },
    'targetMember': function(targetMember: Member | null) {
      if (targetMember && this.data.visible) {
        // 切换目标成员时重置表单
        this.setData({
          transactionAmount: '',
          transactionDescription: ''
        })
      }
    }
  }
})

