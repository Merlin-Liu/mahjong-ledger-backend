# 阿里云 ECS 数据库安装指引

本文档提供在阿里云 ECS 上安装和配置 MariaDB/MySQL 数据库的完整步骤。

## 前置检查

### 1. 检查系统版本

```bash
# 查看系统版本
cat /etc/os-release

# 查看系统架构
uname -a
```

阿里云 ECS 通常使用 CentOS 7/8 或 Alibaba Cloud Linux。

## 步骤 1：停止并卸载旧版本（如果存在）

```bash
# 停止 MariaDB/MySQL 服务
systemctl stop mariadb 2>/dev/null
systemctl stop mysql 2>/dev/null
systemctl stop mysqld 2>/dev/null

# 检查已安装的包
rpm -qa | grep -i mariadb
rpm -qa | grep -i mysql

# 卸载旧版本（保留数据目录，以防万一）
yum remove -y mariadb-server mariadb mysql-server mysql 2>/dev/null

# 备份旧数据目录（如果存在且需要保留）
if [ -d /var/lib/mysql ]; then
    mv /var/lib/mysql /var/lib/mysql.backup.$(date +%Y%m%d_%H%M%S)
    echo "已备份旧数据目录"
fi

# 清理配置文件（可选）
rm -rf /etc/my.cnf /etc/my.cnf.d/ 2>/dev/null
```

## 步骤 2：安装 MariaDB

### CentOS 7 / Alibaba Cloud Linux 2

```bash
# 更新系统
yum update -y

# 安装 MariaDB 服务器和客户端
yum install -y mariadb-server mariadb

# 启动 MariaDB 服务
systemctl start mariadb

# 设置开机自启
systemctl enable mariadb

# 检查服务状态
systemctl status mariadb
```

### CentOS 8 / Alibaba Cloud Linux 3

```bash
# 更新系统
dnf update -y

# 安装 MariaDB 服务器和客户端
dnf install -y mariadb-server mariadb

# 启动 MariaDB 服务
systemctl start mariadb

# 设置开机自启
systemctl enable mariadb

# 检查服务状态
systemctl status mariadb
```

### Ubuntu/Debian 系统（如果使用）

```bash
# 更新系统
apt-get update -y

# 安装 MySQL（Ubuntu 默认使用 MySQL）
apt-get install -y mysql-server mysql-client

# 启动 MySQL 服务
systemctl start mysql

# 设置开机自启
systemctl enable mysql

# 检查服务状态
systemctl status mysql
```

## 步骤 3：安全配置（设置 root 密码）

```bash
# 运行安全配置脚本
mysql_secure_installation
```

**交互式配置说明：**

1. **Enter current password for root**: 直接回车（首次安装没有密码）
2. **Set root password?**: 输入 `Y`，然后设置一个强密码（请记住这个密码）
3. **Remove anonymous users?**: 输入 `Y`
4. **Disallow root login remotely?**: 输入 `Y`（如果只需要本地访问）
5. **Remove test database?**: 输入 `Y`
6. **Reload privilege tables?**: 输入 `Y`

## 步骤 4：创建应用数据库和用户

```bash
# 使用 root 用户登录 MySQL
mysql -u root -p
# 输入刚才设置的 root 密码
```

在 MySQL 命令行中执行以下 SQL：

```sql
-- 创建数据库
CREATE DATABASE IF NOT EXISTS mahjong_ledger CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建应用用户（推荐不使用 root）
CREATE USER 'mahjong_ledger_user'@'localhost' IDENTIFIED BY 'your_strong_password_here';

-- 授予权限
GRANT ALL PRIVILEGES ON mahjong_ledger.* TO 'mahjong_ledger_user'@'localhost';

-- 刷新权限
FLUSH PRIVILEGES;

-- 查看数据库
SHOW DATABASES;

-- 退出
EXIT;
```

**注意**：请将 `your_strong_password_here` 替换为强密码，并记住这个密码。

## 步骤 5：配置防火墙（如果需要）

### 如果只需要本地访问（推荐）

```bash
# 检查防火墙状态
systemctl status firewalld

# 如果防火墙开启，确保本地访问不受影响（通常默认允许）
# 不需要额外配置
```

### 如果需要远程访问（不推荐，除非必要）

```bash
# 开放 3306 端口
firewall-cmd --permanent --add-port=3306/tcp
firewall-cmd --reload

# 或者使用 iptables
iptables -A INPUT -p tcp --dport 3306 -j ACCEPT
service iptables save
```

**重要**：如果允许远程访问，还需要：
1. 在阿里云安全组中开放 3306 端口
2. 修改 MySQL 用户权限（见下方）

## 步骤 6：配置远程访问（可选，不推荐）

如果确实需要远程访问：

```bash
mysql -u root -p
```

```sql
-- 创建允许远程访问的用户（替换为你的 ECS 内网 IP 或 %）
CREATE USER 'mahjong_user'@'%' IDENTIFIED BY 'your_strong_password_here';
GRANT ALL PRIVILEGES ON nodejs_demo.* TO 'mahjong_user'@'%';
FLUSH PRIVILEGES;
EXIT;
```

修改 MySQL 配置文件：

```bash
# 编辑配置文件
vi /etc/my.cnf.d/server.cnf
# 或
vi /etc/my.cnf
```

在 `[mysqld]` 部分添加或修改：

```ini
[mysqld]
bind-address = 0.0.0.0  # 允许所有 IP 访问，或指定特定 IP
```

重启服务：

```bash
systemctl restart mariadb
```

## 步骤 7：更新应用配置文件

编辑 `.prod.env` 文件：

```bash
cd /root/app/mahjong-ledger  # 根据你的实际路径调整
vi .prod.env
```

更新数据库配置：

```env
COS_BUCKET=7072-prod-1g7voy123c13c5bf-1388445354
COS_REGION=ap-shanghai
MYSQL_ADDRESS=localhost:3306
MYSQL_PASSWORD=your_strong_password_here  # 使用步骤 4 中创建的密码
MYSQL_USERNAME=mahjong_ledger_user  # 或使用 root（不推荐）
PORT=3000
NODE_ENV=production
```

## 步骤 8：测试数据库连接

```bash
# 测试本地连接
mysql -u mahjong_ledger_user -p -h localhost mahjong_ledger
# 输入密码，如果成功进入 MySQL 命令行，说明连接正常

# 测试应用连接
cd /root/app/mahjong-ledger
npm run dev
# 或
NODE_ENV=production npm start
```

## 步骤 9：配置阿里云安全组（如果需要远程访问）

1. 登录阿里云控制台
2. 进入 **ECS 实例** → 选择你的实例
3. 点击 **安全组** → **配置规则**
4. 点击 **添加安全组规则**
5. 配置：
   - **规则方向**：入方向
   - **授权策略**：允许
   - **协议类型**：MySQL(3306)
   - **端口范围**：3306/3306
   - **授权对象**：0.0.0.0/0（或指定特定 IP）
   - **描述**：MySQL 数据库访问

**安全建议**：授权对象最好设置为特定的 IP 地址，而不是 0.0.0.0/0

## 常见问题排查

### 1. 服务启动失败

```bash
# 查看详细错误日志
journalctl -u mariadb.service -n 50 --no-pager
tail -n 100 /var/log/mariadb/mariadb.log

# 检查数据目录权限
ls -la /var/lib/mysql
chown -R mysql:mysql /var/lib/mysql
chmod 755 /var/lib/mysql
```

### 2. 忘记 root 密码

```bash
# 停止服务
systemctl stop mariadb

# 以安全模式启动（跳过权限检查）
mysqld_safe --skip-grant-tables &

# 登录 MySQL（无需密码）
mysql -u root

# 重置密码
USE mysql;
UPDATE user SET password=PASSWORD('new_password') WHERE User='root';
FLUSH PRIVILEGES;
EXIT;

# 重启服务
systemctl restart mariadb
```

### 3. 连接被拒绝

```bash
# 检查服务是否运行
systemctl status mariadb

# 检查端口是否监听
netstat -tlnp | grep 3306
ss -tlnp | grep 3306

# 检查防火墙
firewall-cmd --list-ports
iptables -L -n | grep 3306
```

### 4. 字符集问题

确保数据库和表使用 utf8mb4：

```sql
-- 检查数据库字符集
SHOW CREATE DATABASE nodejs_demo;

-- 修改数据库字符集
ALTER DATABASE nodejs_demo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## 验证安装

执行以下命令验证安装是否成功：

```bash
# 1. 检查服务状态
systemctl status mariadb

# 2. 检查版本
mysql --version

# 3. 测试连接
mysql -u root -p -e "SELECT VERSION();"

# 4. 检查数据库
mysql -u root -p -e "SHOW DATABASES;"
```

## 后续操作

1. **备份数据库**：定期备份数据库
   ```bash
   mysqldump -u root -p nodejs_demo > backup_$(date +%Y%m%d).sql
   ```

2. **监控日志**：定期检查错误日志
   ```bash
   tail -f /var/log/mariadb/mariadb.log
   ```

3. **性能优化**：根据实际使用情况调整 MySQL 配置

## 安全建议

1. ✅ 使用强密码（至少 12 位，包含大小写字母、数字、特殊字符）
2. ✅ 不要使用 root 用户运行应用，创建专用应用用户
3. ✅ 限制数据库用户权限，只授予必要的权限
4. ✅ 如果不需要远程访问，不要开放 3306 端口
5. ✅ 定期更新系统和数据库软件
6. ✅ 定期备份数据库
7. ✅ 监控数据库访问日志

---

**完成！** 现在你的数据库已经安装并配置完成，可以启动应用了。

