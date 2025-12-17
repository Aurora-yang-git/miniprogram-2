# 使用步骤

## 注意：确保登录的是教育版账号，使用的是教育版的微信开发者工具，工具设置处有打开“教育版”开关
- [欢迎大家前往官网注册并下载工具体验](https://edu.weixin.qq.com/)
- [更详细的操作指引](https://developers.weixin.qq.com/community/business/doc/000cc8804f06007563f94086b56c0d)

### 启用云开发
- 点击左上角的云开发，看下有没有开通过云开发。还未开通的，会有“云开发教育体验资源”的弹框，点击“开始体验”即可
- 复制云环境ID，在目录树处搜索“eduction-cloud1-9gj4mqi9374a9268”，将搜索内容替换成你自己的envId

### 点击存储，点击上传文件
- 下载文件：https://share.weiyun.com/0OhL4APE
- 解压文件夹，将其中的mobilenetv2_11.onnx上传到存储处
- 将存储文件的权限设置为"所有用户可读"
- 上传成功后，点击该文件名，复制存储位置和File ID

### 修改模型文件下载相关代码
- 打开项目的util文件夹中的config.js
- baseUrl=存储位置
- cloudUrl=File ID
- 清除全部缓存，重新编译小程序