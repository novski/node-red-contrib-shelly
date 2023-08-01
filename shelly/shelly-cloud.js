/**
* Created by Karl-Heinz Wind
* see also https://shelly-api-docs.shelly.cloud/#common-http-api
**/

module.exports = function (RED) {
    //"use strict";

    var helpers = require("shelly");
    cloudAxios = helpers.rateLimit(axios.create(), { maxRequests: 1, perMilliseconds: 1000, maxRPS: 1 });
    // CLOUD API ----------------------------------------------------------------------------------
    // see https://shelly-api-docs.shelly.cloud/cloud-control-api/

    function encodeParams(data){
        Object.keys(data).forEach(key => data[key] === undefined && delete data[key]);
        let params = new URLSearchParams(data).toString();
        return params;
    };

    function encodeArrayParams(data){
        let params = JSON.stringify(data);
        return params;
    };

    // generic REST cloud request wrapper with promise
    function shellyCloudRequestAsync(method, route, data, credentials, timeout){
        return new Promise(function (resolve, reject) {

            if(timeout === undefined || timeout === null){
                timeout = 10000;
            };

            // We avoid an invalid timeout by taking a default if 0.
            let requestTimeout = timeout;
            if(requestTimeout <= 0){
                requestTimeout = 10000;
            }

            let encodedData = 'auth_key=' + credentials.authKey;
            if (data !== undefined && data !== null) {
                encodedData += '&' + data;
            }

            let baseUrl = credentials.serverUri;
            let config = {
                baseURL :  baseUrl,
                url : route,
                method : method,
                data : encodedData,
                timeout: requestTimeout,
                validateStatus : (status) => status === 200
            };

            try
            {
                const request = helpers.cloudAxios.request(config);
        
                request.then(response => {
                    if(response.status == 200){
                        resolve(response.data)
                    } else {
                        reject(response.statusText);
                    }
                })
                .catch(error => {
                    reject(error);
                });
            }
            catch(error2) {
                reject(error2);
            }
        });
    }

    // --------------------------------------------------------------------------------------------
    // The shelly cloud server node
    function ShellyCloudServerNode(config) {
        RED.nodes.createNode(this, config);

        let node = this;

        node.serverUri = trim(node.credentials.serveruri);
        node.authKey = trim(node.credentials.authkey);

        this.getCredentials = function () {
            const credentials = {
                serverUri : node.serverUri,
                authKey : node.authKey
            };

            return credentials;
        };
    }

    RED.nodes.registerType('shelly-cloud-server', ShellyCloudServerNode, {
        credentials: {
            serveruri: { type: "text" },
            authkey: { type: "password" },
        },
    });

    // --------------------------------------------------------------------------------------------
    // The shelly node controls a shelly via cloud api.
    function ShellyCloudNode(config) {
        RED.nodes.createNode(this, config);
        let node = this;
        
        node.server = RED.nodes.getNode(config.server);
        
        node.status({});

        this.on('input', async function (msg) {

            try {
                let route;
                let params;
                if (msg.payload !== undefined && msg.payload !== null) {

                    let type = msg.payload.type;
                    if (type === 'light'){
                        route = '/device/light/control';

                        let data = {
                            id : msg.payload.id,
                            channel : msg.payload.channel,
                            turn : msg.payload.turn,
                            brightness : msg.payload.brightness,
                            white : msg.payload.white,
                            red : msg.payload.red,
                            green : msg.payload.green,
                            blue : msg.payload.blue,
                            gain : msg.payload.gain,
                        };
                        params = encodeParams(data);
                    } else if (type === 'relay'){
                        route = '/device/relay/control';
                    
                        let data = {
                            id : msg.payload.id,
                            channel : msg.payload.channel,
                            turn : msg.payload.turn,
                        };
                        params = encodeParams(data);
                    } else if (type === 'roller'){
                        route = '/device/relay/roller/control';
                    
                        let data = {
                            id : msg.payload.id,
                            channel : msg.payload.channel,
                            direction : msg.payload.direction,
                            pos : msg.payload.pos,
                        };    
                        params = encodeParams(data);    
                    } else if (type === 'relays'){
                        route = '/device/relay/bulk_control';

                        let data = {
                            turn : msg.payload.turn
                        };    
                        params = encodeParams(data);
                        params += '&devices=' + encodeArrayParams(msg.payload.devices); 
                    } else if (type === 'status'){
                        route = '/device/status';

                        let data = {
                            id : msg.payload.id
                        };    
                        params = encodeParams(data);  
                    }
                    else {
                        // nothing to do
                    }
                }

                if (route) {
                    let credentials = node.server.getCredentials();
                    let body = await shellyCloudRequestAsync('POST', route, params, credentials);

                    node.status({ fill: "green", shape: "ring", text: "OK" });

                    let status = body;
                    // msg.status = status;
                    msg.payload = status;
                    node.send([msg]);
                }
                else {
                    node.send([msg]);
                }
            }
            catch (error) {
                node.status({ fill: "red", shape: "ring", text: error});
                node.error("Failed to get status: " + error, error);
            }
        });
        
        this.on('close', function(done) {
            node.status({});
            done();
        });
    }
    RED.nodes.registerType("shelly-cloud", ShellyCloudNode, {});
    
}