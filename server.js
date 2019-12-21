
const net = require('net');
//获取插入模板
const renderer = require('vue-server-renderer').createRenderer({
    template: require('fs').readFileSync('./vue-ssr-outlet.html', 'utf8')
});

//172.17.0.144  dev5   9023
//127.0.0.1 dev3   7003

//socket监听端口
/*const PORT = process.env.port;
const HOST = process.env.ip; */
const PORT = process.env.port;
const HOST = process.env.ip; 

let FLOW_INIT = 1000; //参考java CoreCenter flow实现


//防粘包前后标志 和 ssr.jsp.inc需要保持一致
const PACKET_STARTS_WITH = '-!@@!-';
const PACKET_ENDS_WITH = '-@!!@-';
const PACKET_STARTS_WITH_LENGTH = PACKET_STARTS_WITH.length;
const PACKET_ENDS_WITH_LENGTH = PACKET_ENDS_WITH.length;
const nodeRenderSvr = net.createServer(function(socket) {
    //接受数据源
    let _buffer = '';
    socket.on('data', function(data) {

        //监控脚本-定时心动信号,检测到data == nodehelo的话返回ok，如果没有返回的话nginx那边就会重启改server
        try {
            if (data.toString() === 'nodehelo') {
                socket.write('ok');
                return;
            }
        } catch (e) {
            //no-deal
        }

        //Integer.MAX_VALUE 2147483647
        //2147483 647 预留后三位(流水号后三位用来记录IP，方便后端svr查询请求的resin的ip)
        if ((++FLOW_INIT) > 2147483) {
            FLOW_INIT = 1000;
        }
        let flow = FLOW_INIT;
        //log数据
        var style = 0,
            id = 0,
            colId = 0,
            cid = 0;
        //用一个大的try - catch 监听报错，有报错的话返回给客户端
        try {
            var idx = void 0;
            _buffer += data.toString();
            //避免粘包处理，只获取PACKET_STARTS_WITH 和 PACKET_ENDS_WITH之间的数据。
            if ((idx = _buffer.indexOf(PACKET_ENDS_WITH)) !== -1) {
                var startIdx = _buffer.indexOf(PACKET_STARTS_WITH);
                    startIdx = startIdx < 0 ? 0 : startIdx;
                var realBuffer = _buffer.substring(startIdx + PACKET_STARTS_WITH_LENGTH, idx);

                if (realBuffer.toString() === 'nodehelo') {
                    socket.write('ok');
                    return;
                }
                
                //截取有效数据数据 并 parse数据 然后传输给ssr函数
                let packet = JSON.parse(realBuffer);

                style = packet.module.style;
                id = packet.module.id;
                colId = packet.options.colId;
                cid = packet.options._cid;
                flow = packet.flow || flow; //优先获取java传过来的流水。
                let createModuleApp = null;
                // packet.basepath = null;
                //本地和独立环境会清除掉缓存
                if (packet.basepath) {
                    delete require.cache['./moduleSSR.js'];
                }
                createModuleApp = require('./moduleSSR.js');
                
                let logMsg = {flow, style, id, colId, cid};
                //每个模块耗时
                let ssrTake = ['<moduleSSR-take>', JSON.stringify(logMsg)].join(',');
                console.time(ssrTake);
      
                //返回Dom-string 变量
                //let contentHtml = '';
                //Vue服务器渲染
                //防止vue实例参数污染，所以每个模块都创建属于自己的实例
                const moduleApp = createModuleApp(packet, flow);
                renderer.renderToString(moduleApp, (error, html) => {
                    if (error) {
                        let renderErr = {name: 'renderToStringError', error: error.toString(), errorstack: error.stack};
                        Object.assign(renderErr, logMsg);
                        let errMsg = errorPrint(renderErr);
                        console.error(errMsg);
                        socket.write(errMsg + '\n');
                        return;
                    }
                    // 发送渲染结果
                    socket.write(html);
                    // 关闭Socket
                    socket.end();
                });
                console.timeEnd(ssrTake);

                //重置buffer缓存。
                _buffer = _buffer.substring(idx + PACKET_ENDS_WITH_LENGTH);
            }
            //记录SSR耗时
        } catch (error) {
            let ssrTryCatch = {
                name: '<SSR_tryCatch>',
                flow: flow,
                style: style,
                id: id,
                colId: colId,
                aid: cid,
                error: error.stack
            };
            //pm2 monit中查看 或者 ./ssrlogs/error/error.log （有分割）中查看
            let errMsg = errorPrint(ssrTryCatch); 
            console.error(errMsg);
            //传输给java - monitor中
            socket.write(errMsg + '\n');
            return;
        }
    });

    // 不在close时console 减少 pm2 monit GUI压力
    // socket.on('close', function() {
    // });
});

nodeRenderSvr.on('error', function(error) {
    console.error( errorPrint({name: 'onErrorEvent', error: error.toString()}));
});

nodeRenderSvr.listen(PORT, HOST, function() {
    console.log('nodeRenderSvr Start listening for requests from the client');
});

console.log(`nodeRenderSvr running, host:${HOST}, port:${PORT}`);


function errorPrint(msg) {
    return `nodeRenderError：${JSON.stringify(msg)}`;
}