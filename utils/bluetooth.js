import {
  dataProtocol
} from "./dataProtocol.js";

const util = require("./util.js");


function ab2hex(buffer) {
  var hexArr = Array.prototype.map.call(
    new Uint8Array(buffer),
    function (bit) {
      return ('00' + bit.toString(16)).slice(-2)
    }
  )
  return hexArr.join('');
}

var rxByteArray = [];
var rxByteAA55 = 0;
var rxByteRecord = 0;

var searchTimer = null;
var IIAn = util.isAndroid();
var isAndroidType = IIAn.type;
var isAndroidVer = IIAn.ver;

var bluetooth = {
  /***
   * ERROR 错误
   * err @params {} 
   * err.ercode @params Number
   *  0	ok	正常
   * 10000	not init	未初始化蓝牙适配器
   * 10001	not available	当前蓝牙适配器不可用
   * 10002	no device	没有找到指定设备
   * 10003	connection fail	连接失败
   * 10004	no service	没有找到指定服务
   * 10005	no characteristic	没有找到指定特征值
   * 10006	no connection	当前连接已断开
   * 10007	property not support	当前特征值不支持此操作
   * 10008	system error	其余所有系统上报的异常
   * 10009	system not support	Android 系统特有，系统版本低于 4.3 不支持 BLE
   * 10012	operate time out	连接超时
   * 10013	invalid_data	连接 deviceId 为空或者是格式不正确
   */
  ERROR: function (err, device) {

    var self = this;

    try {
      err = err || {};

      try {
        if (typeof self.capture == "function") {
          self.capture(err, device);
        }
      } catch (e) {
        console.log(e)
      }
    } catch (e) {
      console.log(e)
    }

  },
  RESET: function () {
    var self = this;

    self.name = "";
    self.deviceId = "";
    self.serviceId = "";

    // clearInterval(searchTimer);
    clearTimeout(searchTimer);
    searchTimer = null;
    self.foundCount = 0;

    self.write_characteristicId = "";
    self.read_characteristicId = "";
    self.onBLEConnectionStateChange = null;

    clearTimeout(self.sendTimer);
    self.sendTimer = null;

  },
  /**
   * 
   * @param {*} device 
   * device.btName 搜索的蓝牙名称
   * device.deviceId 搜索的蓝牙MAC地址
   * device.capture 蓝牙连接失败返回给调用对象
   * device.btName 搜索的蓝牙名称
   * device.showLoading 是否显示加载条，默认不显示
   */
  START: function (device) {

    var self = this;

    if (device.showLoading) {
      wx.showLoading({
        title: '',
        mask: device.mask ? true : false
      })
    }

    self.capture = device.capture;

    return new Promise(async (reslove, reject) => {
      if (self.startPass) {
        console.log("启动过了...")
        reslove()
        return
      }

      self.RESET();

      self.startPass = true;
      wx.openBluetoothAdapter({
        success(res) {
          console.log("openBluetoothAdapter res=>", res);

          self.startPass = true;
          reslove(res);

        },
        fail(err) {
          console.log("openBluetoothAdapter err=>", err);

          self.startPass = false;
          if (err && err.errMsg.indexOf("openBluetoothAdapter:fail") >= 0) {
            err.errCode = 10000;
          }
          self.ERROR(err, device);
          self.CLOSE(device.showLoading);

        }
      })
    })
  },

  findDevice(device, devices) {
    var self = this;

    var find = false;
    var isAdd = true;
    var list = {}

    devices.find((item) => {
      if ((item.name && item.name == device.btName) || (item.deviceId && item.deviceId == device.deviceId)) {
        if (item.advertisData) {
          self.deviceId = item.deviceId;
          self.name = item.name;
          find = true;
          list = Object.assign({}, item);
        }
      }
    })

    return {
      find: find,
      list: list,
      isAdd: isAdd
    };

  },
  SEARCH: async function (device) {

    var self = this;


    await self.START(device);

    if (device.showLoading) {
      wx.showLoading({
        title:  "正在连接设备...",
        mask: device.mask ? true : false
      })
    }

    return new Promise((reslove, reject) => {

      // clearInterval(searchTimer);
      clearTimeout(searchTimer);
      self.foundCount = 0;
      searchTimer = null;

      if (device.deviceId || (isAndroidType && device.macAddr)) {

        console.log("直接连接")

        self.deviceId = device.deviceId || device.macAddr;
        self.name = device.btName;

        reslove();

        return
      }

      searchTimer = setTimeout(() => {
        console.log("搜索超时 self.foundCount=>", self.foundCount)
        clearTimeout(searchTimer);
        try {
          if (self.foundCount >= 200) {

          } else {
            self.ERROR({
              errCode: 10002,
            }, device);

            self.CLOSE(device.showLoading);
          }
        } catch (e) {
          console.log(e)
        }

        self.foundCount = 0;

      }, 10 * 1000);


      function onBluetoothDeviceFound() {
        wx.onBluetoothDeviceFound(function (res) {

          var devices = res.devices;

          let findOBJ = self.findDevice(device, devices);

          if (findOBJ.find) {

            // clearInterval(searchTimer)

            clearTimeout(searchTimer);
            self.foundCount = 200;
            searchTimer = null;


            if (self.startPass) {

              self.STOP();

              reslove(findOBJ);

            } else {
              console.log("提前断开了")
            }
          }
        })
      }

      wx.startBluetoothDevicesDiscovery({
        // services: ['FEE7'],
        allowDuplicatesKey: true,
        // powerLevel:"high",

        success(res) {
          console.log("startBluetoothDevicesDiscovery res=>", res);
          onBluetoothDeviceFound();
        },
        fail(err) {
          console.log("startBluetoothDevicesDiscovery err=>", err)

          self.ERROR(err, device);
          self.CLOSE(device.showLoading);

        }
      })
    })
  },
  CONNECT: async function (device) {

    var self = this;


    // console.log("self.name=>",self.name);
    // console.log("device.btName=>",device.btName);

    let sameName = (self.name && self.name == device.btName) ? true : false;

    return new Promise(async (reslove, reject) => {

      function getBLEDeviceCharacteristics(deviceId, serviceId) {
        wx.getBLEDeviceCharacteristics({
          // 这里的 deviceId 需要已经通过 createBLEConnection 与对应设备建立链接
          deviceId,
          // 这里的 serviceId 需要在 getBLEDeviceServices 接口中获取
          serviceId,
          success(res) {
            // console.log('device getBLEDeviceCharacteristics:', res.characteristics)

            let characteristics = res.characteristics;

            characteristics.find((it, index, array) => {

              if (it.properties.write) {
                // 写入特征码
                self.write_characteristicId = it.uuid;
              }

              if (it.properties.notify || it.properties.indicate) {
                // 读取特征码
                self.read_characteristicId = it.uuid;
              }

              if (self.read_characteristicId && self.write_characteristicId) {
                // self.onBLEConnectionStateChangeCompile(device);  // 执行外部函数回调监听设备变化

                reslove();


                return true;
              }

            });
          },
          fail(err) {
            console.log('device getBLEDeviceCharacteristics err=>', err)
            // device getBLEDeviceCharacteristics err=> {errMsg: "getBLEDeviceCharacteristics:fail:no characteristic", errCode: 10005}
            self.ERROR(err, device);
            self.CLOSE(device.showLoading);

          }
        })
      }

      var getBLEDeviceServicesNum = 1;
      var getBLEDeviceServicesTimer = 1;

      function getBLEDeviceServices(deviceId) {
        wx.getBLEDeviceServices({
          // 这里的 deviceId 需要已经通过 createBLEConnection 与对应设备建立链接
          deviceId: deviceId,
          success(res) {
            // console.log('device services:', res.services);
            let services = res.services;
            services.find((it) => {
              if (it.isPrimary) {

                self.serviceId = it.uuid; // 服务ID

                getBLEDeviceServicesNum = 1;

                getBLEDeviceCharacteristics(deviceId, it.uuid);

                return true;

              }
            });


          },
          fail(err) {
            console.log('device services err=>', err, getBLEDeviceServicesNum);

            if (self.startPass) {
              self.ERROR(err, device);
              self.CLOSE(device.showLoading);
            }

          }
        })
      }

      if (sameName && self.waitConnect) {
        console.log("同锁请稍等...");
        return;
      };

      await self.SEARCH(device);


      var sTime = new Date().getTime();
      var timeout = 6000;
      if (isAndroidType) {
        // 红米5A，安卓7
        if (isAndroidVer < 9) {
          var RandNum = parseInt(Math.random() * 10);
          if (!self.isNotConnect || RandNum < 5) {
            timeout = 100;
            self.isNotConnect = true;
          }
        }
      }


      var replayConnectTimer = null;
      function createBLEConnection() {
        self.waitConnect = true;
        console.log("timeout=>", timeout, self.deviceId);

        wx.createBLEConnection({
          // 这里的 deviceId 需要已经通过 createBLEConnection 与对应设备建立链接
          timeout: timeout, // number		否	超时时间，单位ms，不填表示不会超时
          deviceId: self.deviceId,
          // serial: false,  // 会闪退的
          success(res) {

            try {
              if (isAndroidType && device.mtu) {
                // && util.isAndroid().ver > 7 
                wx.setBLEMTU({
                  deviceId: self.deviceId,
                  mtu: 120,
                  success: (res) => {
                    console.log("setBLEMTU success>>", res)
                  },
                  fail: (err) => {
                    console.log("setBLEMTU fail>>", err)
                  }
                })
              }
            } catch (e) {
              console.log(e)
            }


            // console.log("createBLEConnection res=>",res)
            getBLEDeviceServices(self.deviceId);
            self.waitConnect = false;
            self.deviceId_success = self.deviceId;

          },
          fail(err) {


            self.waitConnect = false;

            var eTime = new Date().getTime();
            let useTime = Math.floor((eTime - sTime) / 1000);
            console.log("createBLEConnection err,useTime=>", err, useTime, self.startPass);
            // createBLEConnection err,useTime=> {errCode: 10000, errMsg: "createBLEConnection:fail createBLEConnection error 10000"}errCode: 10000errMsg: "createBLEConnection:fail createBLEConnection error 10000"__proto__: Object 0 
            if (!self.startPass || useTime >= 12) {
              if (self.startPass) {
                console.log("彻底败 device=>", device)
                console.log("彻底败 self=>", self)
                if (self.passCheck == device.passCheck) {
                  console.log("准")
                  self.CLOSE(device.showLoading);
                  self.ERROR(err, device);
                }
              }

            } else {
              function TryOut() {
                if (timeout < 6000) {
                  timeout = 6000;
                } else if (timeout <= 6000) {
                  timeout = 8000;
                }
                clearTimeout(replayConnectTimer);
                replayConnectTimer = setTimeout(() => {
                  clearTimeout(replayConnectTimer);
                  console.log("300 self.startPass", self.startPass)
                  if (self.startPass) {
                    createBLEConnection();
                  }
                }, 300);
              }

              // createBLEConnection err,useTime=> {errCode: -1, errMsg: "createBLEConnection:fail:already connect"}

              if (util.isAndroid().type) {
                if (err.errCode == 10012) {
                  TryOut()
                } else {
                  console.log("异常.device ", device, self);
                  // 异常。。。。device  {btName: "A000CY00000055", macAddr: "00:00:00:00:00:37", deviceId: undefined, hideError: false, passCheck: 1602223055267, …}
                  //  00:00:00:00:00:35
                  self.waitConnec = false;
                  if (device.passCheck == self.passCheck) {
                    if (self.data && self.callback) {
                      // self.waitConnec = false;  // 如果是同把锁退出再进入可能不行
                      wx.closeBluetoothAdapter({
                        complete(res) {
                          console.log("连接异常销毁 res=>", res);
                          setTimeout(() => {
                            wx.openBluetoothAdapter({
                              success(res) {
                                console.log("openBluetoothAdapter res=>", res);
                                TryOut();
                              },
                              fail(err) {
                                console.log("openBluetoothAdapter err=>", err);

                                if (self.startPass) {
                                  self.CLOSE(device.showLoading);
                                }
                                self.ERROR(err, device);

                              }
                            })
                          }, 300)

                        }
                      })
                    } else {
                      console.log("...end")
                      if (self.startPass) {
                        self.CLOSE(device.showLoading);
                      }
                      self.ERROR(err, device);
                    }
                  }
                }
              } else {
                TryOut()
              }

            }
          }
        });

      }


      if (device.showLoading) {
        wx.showLoading({
          title: "正在连接设备...",
          mask: device.mask ? true : false
        })
      }

      createBLEConnection();

    })


  },
  analysisReceiveData(value, callback) {

    var self = this;


    // aa550106010200013f003a
    // console.log("analysisReceiveData value=>",value)

    if (value) {

      rxByteArray = []; // 变量在全局顶部
      rxByteAA55 = 0; // 变量在全局顶部
      rxByteAA55++;
    }

    if (rxByteAA55) {
      rxByteArray = rxByteArray.concat(value);
    }

    if (rxByteArray.length > 3) {


      if (typeof callback == "function") {
        callback(rxByteArray, {
          btName: self.name,
          deviceId: self.deviceId,
          // 这里的 serviceId 需要在上面的 getBLEDeviceServices 接口中获取
          serviceId: self.serviceId,
          // 这里的 characteristicId 需要在上面的 getBLEDeviceCharacteristics 接口中获取
          write_characteristicId: self.write_characteristicId,
          read_characteristicId: self.read_characteristicId,
        });
        try {
          clearTimeout(self.sendTimer);
          self.sendTimer = null;
        } catch (e) {
          console.log(e)
        }
      }
    } else {
      if (rxByteRecord && !rxByteAA55) {
        callback(value);
      }

    }
  },
  onBLEConnectionStateChangeCompile: function (device) {

    var self = this;

    self.onBLEConnectionStateChange = device.onBLEConnectionStateChange;
    wx.onBLEConnectionStateChange(function (res) {
      // 该方法回调中可以用于处理连接意外断开等异常情况
      console.log(`device ${res.deviceId} state has changed, connected: ${res.connected}`)
      console.log("self.onBLEConnectionStateChange=>", self.onBLEConnectionStateChange)
      if (res.deviceId == self.deviceId && !res.connected) {

        console.log("断 self.passCheck", self.passCheck == device.passCheck, self.passCheck)
        if (self.passCheck == device.passCheck) {
          // console.log("收到关闭")
          self.startPass = ""; // 断开连接，重新连接的时候，启动函数要重新打开
          self.deviceId_success = "";
          // self.CLOSE(device.showLoading);  // 放这里，会影响指纹录入的过程，不能放
        }

        if (typeof self.onBLEConnectionStateChange == "function") {
          self.onBLEConnectionStateChange(res, self.deviceId)
        } else {
          self.offBLEConnectionStateChangeCompile(device)
        }

        if (self.passCheck == device.passCheck) {
          console.log("收到断开CLOSE")
          self.CLOSE(device.showLoading); // 读取操作记录数目较多时候
        }

        self.write_characteristicId = "";
        self.read_characteristicId = "";

      }
    })

  },
  offBLEConnectionStateChangeCompile: function (device) {
    try {
      if (wx.offBLEConnectionStateChange) {
        wx.offBLEConnectionStateChange(function (res) {
          console.log("wx.offBLEConnectionStateChange res=>", res);
          self.onBLEConnectionStateChange = null;
        })
      }

    } catch (e) {
      console.log(e)
    }

  },
  SEND: async function (device, data, callback) {

    var self = this;
    // console.log('device', device)
    console.log('data', data)
    // console.log('searchTimer', searchTimer)
    // console.log('callback', callback)

    try {
      clearTimeout(this.sendTimer);
      this.sendTimer = null;

      clearTimeout(searchTimer);
      searchTimer = null;

    } catch (e) {
      console.log(e)
    }


    self.data = data;
    self.callback = callback;
    self.passCheck = device.passCheck; // 更新票面

    return new Promise(async (reslove, reject) => {

      function notifyBLECharacteristicValueChange() {
        // console.log("notifyBLECharacteristicValueChange self=>",self)
        wx.notifyBLECharacteristicValueChange({
          state: true, // 启用 notify 功能
          // 这里的 deviceId 需要已经通过 createBLEConnection 与对应设备建立链接
          deviceId: self.deviceId,
          // 这里的 serviceId 需要在 getBLEDeviceServices 接口中获取
          serviceId: self.serviceId,
          // 这里的 characteristicId 需要在 getBLEDeviceCharacteristics 接口中获取
          characteristicId: self.read_characteristicId,
          success(res) {
            console.log('notifyBLECharacteristicValueChange success', res.errMsg)
          },
          fail(err) {
            console.log('notifyBLECharacteristicValueChange err', err)
          }
        })
      }

      function writeBLECharacteristicValue(str, i) {

        // let len = 20 * 2;
        // let strIdx = 
        // let str = "BB 55 01 09 01 02 A1 54 31 4d 36 34 4f CF";

        try {
          if (str && typeof str == "string") {
            str = str.replace(/\s*/g, "");
          }
        } catch (e) {
          console.log(e)
        }

        let len = 40; // 20个字节，一个字符代表两个字节 20*2
        let strIdx = Math.ceil(str.length / len) - 1;
        let hex = str.substr(i * len, len);

        let typedArray = new Uint8Array(hex.match(/[\da-f]{2}/gi).map(function (h) {
          return parseInt(h, 16)
        }));

        let buffer = typedArray.buffer;
        console.log("writeBLECharacteristicValue hex=>", hex, i, self.deviceId);
        wx.writeBLECharacteristicValue({
          // 这里的 deviceId 需要已经通过 createBLEConnection 与对应设备建立链接
          deviceId: self.deviceId,
          // 这里的 serviceId 需要在 getBLEDeviceServices 接口中获取
          serviceId: self.serviceId,
          // 这里的 characteristicId 需要在 getBLEDeviceCharacteristics 接口中获取
          characteristicId: self.write_characteristicId,
          // 这里的value是ArrayBuffer类型
          value: buffer,
          success(res) {
            console.log('writeBLECharacteristicValue success', res.errMsg)

            if (strIdx == i) {
              if (typeof device.sendEnd == "function") {
                device.sendEnd(strIdx, self);
              }
              console.log("发送完成 i=>", i);
            } else {
              writeBLECharacteristicValue(str, ++i)
            }
          },
          fail(err) {
            console.log('writeBLECharacteristicValue err', err)
            self.ERROR(err, device);
            self.CLOSE(device.showLoading);
          }
        })
      }

      function onBLECharacteristicValueChange() {
        // 监听低功耗蓝牙设备的特征值变化事件。必须先启用 notifyBLECharacteristicValueChange 接口才能接收到设备推送的 notification。
        wx.onBLECharacteristicValueChange(function (res) {
          // console.log(`characteristic ${res.characteristicId} has changed, now is ${res.value}`)
          // console.log(ab2hex(res.value))
          // console.log("开始解析 res.value",res.value)
          try {
            self.analysisReceiveData(ab2hex(res.value), self.callback);
          } catch (e) {
            console.log(e)
          }
        })
      }

      function initCompile(Resend) {


        // self.passCheck = device.passCheck;   // 更新票面
        console.log("更新票面 self.passCheck=>", self.passCheck, device.passCheck)

        // console.log("更新票面 self.data,data,self.data == data=>",self.data,"------------" ,data,self.data == data)
        if (self.deviceId && self.serviceId && self.write_characteristicId && self.read_characteristicId) {

          if (device.showLoading && self.passCheck == device.passCheck) {
            // 这样写是因为苹果读取记录再开锁，开锁的时候有可能把上次的继续读成功。
            wx.showLoading({
              title: "正在连接设备...",
              mask: device.mask ? true : false
            })
          }



          if (device.intervalNo || Resend) {

            self.onBLEConnectionStateChangeCompile(device); // 执行外部函数回调监听设备变化

            writeBLECharacteristicValue(self.data, 0);

          } else {

            notifyBLECharacteristicValueChange();
            onBLECharacteristicValueChange();
            self.onBLEConnectionStateChangeCompile(device); // 执行外部函数回调监听设备变化
            setTimeout(() => {
              writeBLECharacteristicValue(self.data, 0);
            }, 50);


          }
        }
      }



      if (self.deviceId && self.serviceId && self.write_characteristicId && self.read_characteristicId) {

        initCompile(true);

        return
      }

      await self.CONNECT(device);

      // util.throttle(
      initCompile()
      // );


    })
  },
  STOP: function () {
    try {
      wx.stopBluetoothDevicesDiscovery({
        success(res) {
          console.log("stopBluetoothDevicesDiscovery res=>", res);
        },
        fail(err) {
          console.log("stopBluetoothDevicesDiscovery err=>", err);
        }
      })

      wx.offBluetoothDeviceFound(function (res) {
        console.log("wx.offBluetoothDeviceFound res=>", res)
      })
    } catch (e) {
      console.log(e)
    }
  },
  DISCONNECT(callback) {

    var self = this;

    // self.passCheck = "DISCONNECT"; // 这里会影响开锁定时器的

    if (!self.deviceId_success) {
      if (typeof callback == "function") {
        callback();
      }
      return
    }

    wx.closeBLEConnection({
      deviceId: self.deviceId_success,
      // serial: false,
      success(res) {
        console.log("closeBLEConnection res=>", res);
        if (typeof callback == "function") {
          callback();
        }
        self.deviceId_success = "";
      },
      fail(err) {
        console.log("closeBLEConnection err=>", err);
        if (typeof callback == "function") {
          callback();
        }
        self.deviceId_success = "";
      }
    })

  },
  CLOSE: util.throttle(function (showLoading) {
    // 请勿使用 await CLOSE() 跟 throttle 冲突

    var self = this;

    console.log("CLOSE showLoading=>", showLoading)

    self.RESET();

    return new Promise((reslove, reject) => {

      try {
        if (showLoading) {
          wx.hideLoading({
            success: (res) => {},
          })
        }
      } catch (e) {
        console.log(e)
      }

      self.DISCONNECT(function () {
        wx.closeBluetoothAdapter({
          // serial: false,
          success(res) {
            console.log("closeBluetoothAdapter res=>", res);
            reslove(res)
          },
          fail(err) {
            console.log("closeBluetoothAdapter err=>", err);
            reslove(err)

          }
        })
      })
      // self.data = "";
      self.startPass = "";
    })
  }),
  DisconnectBluetooth(device, hide) {
    var self = this;

    try {
      // 必须判断完管理员是否已重置才能发，每次发送都会清除  clearTimeout(bluetooth.sendTimer);

      if (device && device.btName) {
        let fire = {
          btName: device.btName,
          deviceId: device.deviceId,
          macAddr: device.macAddr,
          showLoading: false,
          hideError: true, // 是否隐藏默认的错误提示
          passCheck: Math.random(),
          mask: false,
          intervalNo: true,
          sendEnd: function () {
            console.log("DisconnectBluetooth sendEnd", fire.passCheck, self.passCheck)
            clearTimeout(self.sendTimer);
            self.sendTimer = setTimeout(() => {
              // console.log("DisconnectBluetooth sendEnd=>", fire.passCheck, self.passCheck);
              clearTimeout(self.sendTimer);
              if (fire.passCheck && fire.passCheck == self.passCheck) {
                console.log("DisconnectBluetooth 清理执行");
                fire.passCheck = Math.random() * 100;
                self.CLOSE(false);
              }
            }, 1000);
          },
          onBLEConnectionStateChange: function (res, deviceId) {
            if (fire.passCheck && fire.passCheck == self.passCheck) {
              console.log("DisconnectBluetooth onBLEConnectionStateChange self.passCheck", self.passCheck)
              // clearTimeout(self.sendTimer);
              self.RESET();
            }
          },
        }

        self.SEND(fire, dataProtocol.DisconnectBleLock().post({}));

      } else {
        self.CLOSE(false);

      }


      if (hide) {
        try {
          wx.hideLoading({
            complete: (res) => {},
          })
        } catch (e) {
          console.log(e)
        }
      }

      self.startPass = false;

    } catch (e) {
      console.log(e)
    }
  }
}

module.exports = {
  bluetooth: bluetooth
}