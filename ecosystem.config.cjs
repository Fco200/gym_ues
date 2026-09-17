// Configuración opcional para PM2 (servicio del servidor en producción)
// Uso:
//   npm install -g pm2
//   pm2 start ecosystem.config.cjs
//   pm2 save
module.exports = {
  apps: [
    {
      name: 'gym-ues-server',
      cwd: './backend',
      script: 'src/index.js',
      instances: 1,
      autorestart: true,
      max_restarts: 20,
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};