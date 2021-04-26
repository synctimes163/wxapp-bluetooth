// pages/index/index.js

import {
  bluetooth
} from "../../utils/bluetooth.js";

import {
  dataProtocol
} from "../../utils/dataProtocol.js";

Page({

  /**
   * 页面的初始数据
   */
  data: {
    dataList: [{
      "btName": "test",
      "macAddr": "00:00:00:00:00:85"
    }]
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {

  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {

    try {
      if (this.operMsg) {
        bluetooth.CLOSE(true);
      }
    } catch (e) {
      console.log(e)
    }


  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function () {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {

  },
  openLock: function () {
    var self = this;

    var queryItems = {
      btName: "",
      deviceId: "",
      macAddr: "",
      btName: "",
    }
    var device = {
      btName: queryItems.btName, // 蓝牙名称
      deviceId: queryItems.deviceId,
      macAddr: queryItems.macAddr,
      showLoading: true, // 是否显示加载条
      hideError: false, // 是否隐藏默认的错误提示
      passCheck: new Date().getTime(),
      mask: true,
      capture: function (err, wakeUp) {
        console.log("外部 START capture err=>", err);
        if (device.passCheck && device.passCheck == bluetooth.passCheck) {
       
        }
      },
      sendEnd: function () {
        clearTimeout(bluetooth.sendTimer);
        bluetooth.sendTimer = setTimeout(() => {
          clearTimeout(bluetooth.sendTimer);
          if (device.passCheck && device.passCheck == bluetooth.passCheck) {
            console.log("清理执行", device.passCheck);
            bluetooth.CLOSE(true);
          }
        }, 6000);
      },
      onBLEConnectionStateChange: function (res, deviceId) {

        console.log("onBLEConnectionStateChange res=>", res);
        if (device.passCheck && device.passCheck == bluetooth.passCheck) {
       
        }
      }
    }


    let data = dataProtocol.netLock().post({
     
    });

    bluetooth.SEND(device, data, function (value) {
  
      let res = dataProtocol.netLock().get(value);
      console.log(" res=>", res);
      bluetooth.DisconnectBluetooth(device);
      if (res.status) {
        try {
          wx.vibrateShort()
        } catch (e) {
          console.log(e)
        }
        if (typeof callback == "function") {
          callback(res)
        }
      } else {
        
        wx.showToast({
          title: '操作失败',
        })
        
      }
    });

  },
})