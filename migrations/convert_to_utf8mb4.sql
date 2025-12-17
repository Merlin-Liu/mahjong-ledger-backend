-- 将数据库和表的字符集改为 utf8mb4 以支持 emoji 等 4 字节字符
-- 执行此脚本前请先备份数据库

-- 1. 修改数据库字符集
ALTER DATABASE nodejs_demo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. 修改 users 表的字符集
ALTER TABLE users CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 3. 修改 room_members 表的字符集（username 字段也需要支持 emoji）
ALTER TABLE room_members CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 4. 修改 rooms 表的字符集（name 字段可能也需要支持 emoji）
ALTER TABLE rooms CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 5. 修改 transactions 表的字符集
ALTER TABLE transactions CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
