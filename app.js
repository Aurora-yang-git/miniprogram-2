// app.js
App({
  // 全局转发配置
  onShareAppMessage() {
    return {
      title: '分享小程序', // 转发标题
      path: '/pages/home/index' // 转发路径，默认首页
    }
  },

  onLaunch: function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'eduction-cloud1-9gj4mqi9374a9268',
        traceUser: true,
      }).then(() => {
        console.log('云环境初始化成功')
      }).catch(err => {
        console.error('云环境初始化失败：', err)
      })
    }
  }
})
