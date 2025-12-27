module.exports = {
  apps: [
    {
      name: 'mahjong-ledger',
      script: './index.js',
      instances: 1, // 可以根据服务器性能调整，1 表示单实例
      exec_mode: 'fork', // fork 模式，适合单实例
      // cluster 模式示例（如果需要多实例）:
      // instances: 'max', // 使用所有 CPU 核心
      // exec_mode: 'cluster', // 集群模式
      
      // 环境变量配置
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      
      // 日志配置
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // 自动重启配置
      autorestart: true,
      watch: false, // 生产环境建议关闭 watch
      max_memory_restart: '500M', // 内存超过 500M 自动重启
      
      // 进程管理
      min_uptime: '10s', // 最小运行时间，低于此时间重启会被视为异常
      max_restarts: 10, // 最大重启次数
      restart_delay: 4000, // 重启延迟（毫秒）
      
      // 环境变量文件（pm2 不支持直接读取 .env 文件，需要通过 env_file 或手动设置）
      // 注意：pm2 需要通过 env_file 参数或手动在 env_production 中设置环境变量
      // 推荐方式：在启动时使用 dotenv 或在 ECS 上设置环境变量
    }
  ]
};

