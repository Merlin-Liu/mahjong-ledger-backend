export const formatTime = (date: Date) => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return (
    [year, month, day].map(formatNumber).join('/') +
    ' ' +
    [hour, minute, second].map(formatNumber).join(':')
  )
}

const formatNumber = (n: number) => {
  const s = n.toString()
  return s[1] ? s : '0' + s
}

/**
 * 生成唯一ID（UUID格式）
 * 小程序前端可以直接使用，无需后端
 */
export const generateUniqueId = (): string => {
  // 尝试从本地存储获取已存在的ID
  let uniqueId = wx.getStorageSync('uniqueUserId')
  
  if (!uniqueId) {
    // 生成新的唯一ID：时间戳 + 随机数 + 设备信息
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 15)
    
    // 获取设备信息（如果可用）
    try {
      const systemInfo = wx.getSystemInfoSync()
      const deviceId = `${systemInfo.platform}_${systemInfo.system}_${systemInfo.brand || 'unknown'}`
      uniqueId = `mp_${timestamp}_${random}_${deviceId.substring(0, 10)}`
    } catch (e) {
      uniqueId = `mp_${timestamp}_${random}`
    }
    
    // 保存到本地存储
    wx.setStorageSync('uniqueUserId', uniqueId)
  }
  
  return uniqueId
}

/**
 * 获取用户唯一ID（优先使用openid，如果没有则使用本地生成的唯一ID）
 */
export const getUserUniqueId = (): string => {
  // 先尝试获取openid（如果之前获取过）
  const openId = wx.getStorageSync('wxOpenId')
  if (openId) {
    return openId
  }
  
  // 如果没有openid，使用本地生成的唯一ID
  return generateUniqueId()
}

/**
 * 上传文件到微信云存储，返回CDN URL
 * @param filePath 本地临时文件路径（如 wxfile://tmp_xxx.jpg）
 * @param cloudPath 云存储路径（可选，默认自动生成）
 * @returns Promise<string> 返回云存储的CDN URL（fileID）
 */
export const uploadFileToCloud = (filePath: string, cloudPath?: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    // 如果没有指定云存储路径，自动生成一个
    if (!cloudPath) {
      const timestamp = Date.now()
      const random = Math.random().toString(36).substring(2, 9)
      const ext = filePath.substring(filePath.lastIndexOf('.')) || '.jpg'
      cloudPath = `avatars/${timestamp}_${random}${ext}`
    }

    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: filePath,
      success: (res) => {
        // res.fileID 就是云存储的CDN URL，可以直接使用
        console.log('文件上传成功，CDN URL:', res.fileID)
        resolve(res.fileID)
      },
      fail: (err) => {
        console.error('文件上传失败:', err)
        reject(new Error(err.errMsg || '文件上传失败'))
      },
    })
  })
}
