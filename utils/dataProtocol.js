

class dataProtocol {
    constructor() {}
    netLock() {
        var obj = {
            post(params) {
                return "FFFFFFFF030262";
            },
            get(value) {   
                return {
                    status: true,
                    msg:"操作成功"
                };
            },
        }
        return obj
    }
}
module.exports = {
    dataProtocol: new dataProtocol()
}