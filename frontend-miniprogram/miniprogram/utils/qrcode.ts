/**
 * 二维码生成工具
 * 使用后端接口调用微信 getUnlimitedQRCode API 生成二维码
 */
import { qrcodeApi } from './api'

/**
 * 生成二维码图片
 * 使用后端接口调用微信 getUnlimitedQRCode API
 * @param page 小程序页面路径，例如 'pages/room/room'
 * @param scene 场景值，例如 'code=123456'，最大32个字符
 * @param width 二维码宽度，单位 px，默认 430
 * @returns Promise<string> 返回临时文件路径
 */
export function generateQRCodeImage(
  page: string,
  scene: string,
  width: number = 430
): Promise<string> {
  return new Promise((resolve, reject) => {
    // 调用后端接口生成二维码
    qrcodeApi.generateQRCode(page, scene, width)
      .then((result) => {
        // 将 base64 数据转换为 ArrayBuffer
        const base64 = result.base64
        const base64Data = base64.replace(/^data:image\/\w+;base64,/, '')
        const buffer = wx.base64ToArrayBuffer(base64Data)

        // 将 buffer 写入临时文件
        const fileManager = wx.getFileSystemManager()
        const tempFilePath = `${wx.env.USER_DATA_PATH}/qrcode_${Date.now()}.png`
        
        fileManager.writeFile({
          filePath: tempFilePath,
          data: buffer,
          encoding: 'binary',
          success: () => {
            resolve(tempFilePath)
          },
          fail: (err) => {
            console.error('写入二维码文件失败:', err)
            reject(new Error(err.errMsg || '写入文件失败'))
          }
        })
      })
      .catch((err: any) => {
        console.error('生成二维码失败:', err)
        reject(new Error(err.message || '生成二维码失败'))
      })
  })
}

/**
 * 保存二维码图片到相册
 */
export function saveQRCodeToAlbum(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // 先获取权限
    wx.getSetting({
      success: (res) => {
        if (!res.authSetting['scope.writePhotosAlbum']) {
          // 请求权限
          wx.authorize({
            scope: 'scope.writePhotosAlbum',
            success: () => {
              saveImageToAlbum(filePath).then(resolve).catch(reject)
            },
            fail: () => {
              wx.showModal({
                title: '提示',
                content: '需要您授权保存相册权限',
                success: (modalRes) => {
                  if (modalRes.confirm) {
                    wx.openSetting({
                      success: (settingRes) => {
                        if (settingRes.authSetting['scope.writePhotosAlbum']) {
                          saveImageToAlbum(filePath).then(resolve).catch(reject)
                        } else {
                          reject(new Error('用户拒绝授权'))
                        }
                      }
                    })
                  } else {
                    reject(new Error('用户取消授权'))
                  }
                }
              })
            }
          })
        } else {
          saveImageToAlbum(filePath).then(resolve).catch(reject)
        }
      }
    })
  })
}

/**
 * 保存图片到相册
 */
function saveImageToAlbum(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    wx.saveImageToPhotosAlbum({
      filePath: filePath,
      success: () => {
        wx.showToast({
          title: '已保存到相册',
          icon: 'success'
        })
        resolve(filePath)
      },
      fail: (err) => {
        console.error('保存图片失败:', err)
        reject(new Error(err.errMsg || '保存图片失败'))
      }
    })
  })
}
