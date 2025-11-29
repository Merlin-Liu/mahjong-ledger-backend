# 打牌记账小程序

## 开发环境配置

### 解决域名校验问题

微信小程序默认会校验请求域名，开发时使用 `localhost` 会报错。有两种解决方案：

#### 方案1：关闭域名校验（推荐，仅开发时使用）

1. 打开微信开发者工具
2. 点击右上角的 **"详情"** 按钮
3. 在 **"本地设置"** 中，勾选 **"不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书"**
4. 重新编译项目

#### 方案2：配置合法域名（生产环境必须）

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入 **开发** -> **开发管理** -> **开发设置**
3. 在 **服务器域名** 中配置：
   - **request合法域名**：添加你的后端API域名（必须是HTTPS）
   - 例如：`https://api.yourdomain.com`
4. 修改 `miniprogram/utils/api.ts` 中的 `BASE_URL` 为你的生产域名

### 修改API地址

编辑 `miniprogram/utils/api.ts` 文件，修改 `BASE_URL`：

```typescript
// 开发环境
const BASE_URL = 'http://localhost:80'

// 生产环境（需要配置合法域名）
const BASE_URL = 'https://your-api-domain.com'
```

## 注意事项

⚠️ **重要**：
- 开发环境可以关闭域名校验，但**生产环境必须配置合法域名**
- 生产环境的API地址必须是 **HTTPS** 协议
- 域名需要在微信小程序后台配置后才能使用

