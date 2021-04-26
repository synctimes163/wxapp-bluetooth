
function isAndroid() {

  try{
    let system = SystemInfo.system;
    let version = SystemInfo.version;
    let type = system && system.toLowerCase().indexOf("android") >= 0;
    let numArr = system.match(/\d+/g);
    let isMtu = version.split(".");
    let isByte = false;
    if(type) {
      if( isMtu[0] > 7 || (isMtu[0] >= 7 && isMtu[1] > 0)  ||  (isMtu[0] >= 7 && isMtu[1] >= 0 && isMtu[2] >= 20) ){
        isByte  = true; 
      }
    }else {
      isByte  = true; 
    }
 
    let o = {
      type: type,
      ver:  numArr[0],  // 手机系统版本
      isByte: isByte,  //微信版本
    }

    // console.log("isAndroid o=>",o);

    return o;
    
  }catch(e){
    return {
      type: true,
      ver:  7
    };
  }
}


var throttleNumber = 5;
const throttle = function (fn, gapTime) {

  if (gapTime == null || gapTime == undefined) {
    gapTime = 1000
  }

  let _lastTime = null

  // 返回新的函数
  return function () {
    let _nowTime = +new Date()
    if (_nowTime - _lastTime > gapTime || !_lastTime) {
      fn.apply(this, arguments) //将this和参数传给原函数

      _lastTime = _nowTime;

      throttleNumber = 5;

    } else {
      console.log("猛点击，想干嘛 throttleNumber==>", throttleNumber);
    }
  }
}


module.exports = {
  isAndroid:isAndroid,
  throttle:throttle,

}