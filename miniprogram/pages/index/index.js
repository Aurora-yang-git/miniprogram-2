// pages/index/index.js


Page({
// 页面转发配置
onShareAppMessage() {
    return {
      title: '欢迎使用小程序', // 转发标题
      path: '/pages/index/index', // 转发路径
      imageUrl: '' // 转发图片，留空使用默认截图
    }
},

// 分享到朋友圈配置
onShareTimeline() {
    return {
      title: '欢迎使用小程序', // 朋友圈标题
      imageUrl: '' // 朋友圈图片，留空使用默认截图
    }
},

    /**
     * 页面的初始数据
     */
    data: {
        imgSrc: '',
        width: 0,
        height: 0,
        canvasWidth: 400,
        canvasHeight: 400
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad(options) {
        this.context = wx.createCanvasContext('myCanvas');
    },

    handleChooseImage() {
        const that = this;
        wx.chooseImage({
            count: 1,
            sizeType: ['original', 'compressed'],
            sourceType: ['album', 'camera'],
            success: function (res) {
                const tempFilePath = res.tempFilePaths[0];
                that.setData({
                    imgSrc: tempFilePath
                })
                // 获取图片信息
                wx.getImageInfo({
                    src: tempFilePath,
                    success: function (imageInfo) {
                        const width = imageInfo.width;
                        const height = imageInfo.height;
                        // 计算缩放比例
                        const scale = Math.min(that.data.canvasWidth / width, that.data.canvasHeight / height);
                        const newWidth = width * scale;
                        const newHeight = height * scale;
                        // 计算图片在画布中的位置，使其居中显示
                        const offsetX = (that.data.canvasWidth - newWidth) / 2;
                        const offsetY = (that.data.canvasHeight - newHeight) / 2;
                        that.setData({
                            width,
                            height
                        });
                        // 将图片绘制到画布上
                        that.context.drawImage(tempFilePath, offsetX, offsetY, newWidth, newHeight);
                        that.context.draw(false, () => {
                            // 获取画布上的图像数据，供后续识别或上传
                            wx.canvasGetImageData({
                                canvasId: 'myCanvas',
                                x: 0,
                                y: 0,
                                width: width,
                                height: height,
                                success(res) {
                                    console.log('图像数据已准备：', res.width, res.height, res.data.length);
                                },
                                fail(res) {
                                    console.error('获取图像数据失败：', res);
                                }
                            });
                        });
                    },
                    fail: function (res) {
                        console.error('获取图片信息失败：', res);
                    }
                });
            },
            fail: function (res) {
                console.error('选择图片失败：', res);
            }
        });
    },


    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady() {

    },

    /**
     * 生命周期函数--监听页面显示
     */
    onShow() {

    },

    /**
     * 生命周期函数--监听页面隐藏
     */
    onHide() {

    },

    /**
     * 生命周期函数--监听页面卸载
     */
    onUnload() {

    },

    /**
     * 页面相关事件处理函数--监听用户下拉动作
     */
    onPullDownRefresh() {

    },

    /**
     * 页面上拉触底事件的处理函数
     */
    onReachBottom() {

    }
})