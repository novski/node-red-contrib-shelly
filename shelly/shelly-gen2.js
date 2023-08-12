/**
* Created by Karl-Heinz Wind
* see also https://shelly-api-docs.shelly.cloud/#common-http-api
**/

module.exports = function (RED) {
    //"use strict";

    var helpers = require("./shelly");

    // GEN 2 --------------------------------------------------------------------------------------
        
    // Uploads and enables a skript.
    async function tryInstallScriptAsync(node, script, scriptName){
        let success = false;
        if(node.hostname !== ''){    

            node.status({ fill: "yellow", shape: "ring", text: "Uploading script..." });

            let credentials = helpers.getCredentials(node);

            try {
                // ToDo:
                //// Remove all old scripts first
                //let scriptListResponse = await shellyRequestAsync('GET', '/rpc/Script.List', null, credentials);
                //for (let scriptItem of scriptListResponse.scripts) {
                //    if(scriptItem.name == scriptName){
                //        let deleteParams = { 'id' : scriptItem.id };
                //        await shellyRequestAsync('GET', '/rpc/Script.Delete', deleteParams, credentials);
                //    }
                //};

                let createParams = { 'name' : scriptName };
                let createScriptResonse = await helpers.shellyRequestAsync('GET', '/rpc/Script.Create', createParams, credentials);
                let scriptId = createScriptResonse.id;

                const chunkSize = 1024;
                let done = false;
                do {
                    let codeToSend;
                    if (script.length > chunkSize) {
                        codeToSend = script.substr(0, chunkSize);
                        script = script.substr(chunkSize);
                    } else {
                        codeToSend = script;
                        done = true;
                    }
                    
                    let putParams = {  
                        'id' : scriptId,
                        'code' : codeToSend,
                        'append' : true
                    };
                    await helpers.shellyRequestAsync('POST', '/rpc/Script.PutCode', putParams, credentials);

                } while (!done);

                let configParams = {  
                    'id' : scriptId,
                    'config' : {'enable' : true}
                };
                await helpers.shellyRequestAsync('GET', '/rpc/Script.SetConfig', configParams, credentials);
                
                let startParams = {  
                    'id' : scriptId,
                };
                await helpers.shellyRequestAsync('POST', '/rpc/Script.Start', startParams, credentials);
                
                let statusParams = {  
                    'id' : scriptId,
                };
                let status = await helpers.shellyRequestAsync('GET', '/rpc/Script.GetStatus', statusParams, credentials);

                if(status.running === true){
                    node.status({ fill: "green", shape: "ring", text: "Connected." });
                    success = true;
                }
                else {
                    node.error("Uploaded script not running.");
                    node.status({ fill: "red", shape: "ring", text: "Script not running." });         
                }
            }
            catch (error) {
                // node.error("Uploading script failed " + error);
                // node.status({ fill: "red", shape: "ring", text: "Uploading script failed "});
            }     
        }
        else {
            node.status({ fill: "red", shape: "ring", text: "Hostname not configured" });
        }

        return success;
    }

    async function tryUninstallScriptAsync(node, scriptName){
        let success = false;
        if(node.hostname !== ''){    

            let credentials = helpers.getCredentials(node);

            try {
                let scriptListResponse = await helpers.shellyRequestAsync('GET', '/rpc/Script.List', null, credentials);
            
                for (let scriptItem of scriptListResponse.scripts) {
                    if(scriptItem.name == scriptName){
                        let params = {  
                            'id' : scriptItem.id,
                        };
                        let status = await helpers.shellyRequestAsync('GET', '/rpc/Script.GetStatus', params, credentials);

                        if(status.running === true){
                            await helpers.shellyRequestAsync('POST', '/rpc/Script.Stop', params, credentials);
                        }

                        await helpers.shellyRequestAsync('GET', '/rpc/Script.Delete', params, credentials);
                    }
                };                
            }
            catch (error) {
                // node.error("Uninstalling script failed " + error);
                node.status({ fill: "red", shape: "ring", text: "Uninstalling script failed "});
            }     
        }
        else {
            node.status({ fill: "red", shape: "ring", text: "Hostname not configured" });
        }

        return success;
    }

    // Installs a webhook.
    async function tryInstallWebhook2Async(node, webhookUrl, webhookName){
        let success = false;
        if(node.hostname !== ''){    
            node.status({ fill: "yellow", shape: "ring", text: "Installing webhook..." });

            let credentials = helpers.getCredentials(node);

            try {
                // Remove all old webhooks async.
                let webhookListResponse = await helpers.shellyRequestAsync('GET', '/rpc/Webhook.List', null, credentials);
                for (let webhookItem of webhookListResponse.hooks) {
                    if(webhookItem.name == webhookName){
                        let deleteParams = { 'id' : webhookItem.id };
                        let deleteWebhookResonse = await helpers.shellyRequestAsync('GET', '/rpc/Webhook.Delete', deleteParams, credentials);
                    }
                };

                // Create new webhooks.
                let supportedEventsResponse = await helpers.shellyRequestAsync('GET', '/rpc/Webhook.ListSupported', null, credentials);
                for (let hookType of supportedEventsResponse.hook_types) {  
                    let sender = node.hostname;
                    let url = webhookUrl + '?hookType=' + hookType + '&sender=' + sender;
                    let createParams = { 
                        'name' : webhookName,
                        'event' : hookType,
                        'cid' : 0,
                        'enable' : true,
                        "urls": [url]
                    };
                    let createWebhookResonse = await helpers.shellyRequestAsync('GET', '/rpc/Webhook.Create', createParams, credentials);

                    node.status({ fill: "green", shape: "ring", text: "Connected." });
                    success = true;
                }
            }
            catch (error) {
                // node.warn("Installing webhook failed " + error);
                // node.status({ fill: "red", shape: "ring", text: "Installing webhook failed "});
            }     
        }
        else {
            node.status({ fill: "red", shape: "ring", text: "Hostname not configured" });
        }

        return success;
    }

    // Uninstalls a webhook.
    async function tryUninstallWebhook2Async(node, webhookName){
        let success = false;
        if(node.hostname !== ''){    
            node.status({ fill: "yellow", shape: "ring", text: "Installing webhook..." });

            let credentials = helpers.getCredentials(node);

            try {
                let webhookListResponse = await helpers.shellyRequestAsync('GET', '/rpc/Webhook.List', null, credentials);
            
                for (let webhookItem of webhookListResponse.hooks) {
                    if(webhookItem.name == webhookName){
                        let deleteParams = { 'id' : webhookItem.id };
                        let deleteWebhookResonse = await helpers.shellyRequestAsync('GET', '/rpc/Webhook.Delete', deleteParams, credentials);
                    }
                };
            }
            catch (error) {
                // node.warn("Uninstalling webhook failed " + error);
                // node.status({ fill: "red", shape: "ring", text: "Uninstalling webhook failed "});
            }     
        }
        else {
            node.status({ fill: "red", shape: "ring", text: "Hostname not configured" });
        }

        return success;
    }

    // Creates a route from the input.
    async function inputParserGeneric2Async(msg){
        
        let method = 'POST';
        let data;
        let route;

        if(msg !== undefined && msg.payload !== undefined){
            
            let command = msg.payload;

            let rpcMethod;
            if(command.method !== undefined){
                rpcMethod = command.method;
            }

            let parameters;
            if(command.parameters !== undefined){
                parameters = command.parameters;
            }

            if(rpcMethod !== undefined){
                route = "/rpc/";
                data = {
                    id : 1,
                    method : rpcMethod,
                    params : parameters
                };
            }
        }

        let request = {
            route : route,
            method : method,
            data : data
        };
        return request;
    }

    // Returns the input parser for the device type.
    function getInputParser2(deviceType){
        
        let result;

        switch(deviceType) {
            case 'Relay':
            case 'Button':
            case 'Measure':
            case 'Dimmer':
                result = inputParserGeneric2Async;
                break;
            default:
                result = helpers.noop;
                break;
        }
        return result;
    }

    // starts the polling mode.
    function initializer2(node, types){
        let success = false;
        let mode = node.mode;
        if(mode === 'polling'){
            helpers.start(node, types);
            success = true;
        }
        else if(mode === 'callback'){
            node.error("Callback not supported for this type of device.");
            node.status({ fill: "red", shape: "ring", text: "Callback not supported" });
        }
        else{
            // nothing to do.
            success = true;
        }
        return success;
    }

    // starts polling or uploads a skript that calls a REST callback.
    async function initializer2CallbackAsync(node, types){

        const scriptName = 'node-red-contrib-shelly';
        await tryUninstallScriptAsync(node, scriptName); // we ignore if it failed.
            
        let success = false;
        let mode = node.mode;
        if(mode === 'polling'){
            await helpers.startAsync(node, types);
            success = true;
        }
        else if(mode === 'callback'){
            let scriptPath = helpers.path.resolve(__dirname, './scripts/button.script');
            const buffer = helpers.fs.readFileSync(scriptPath);
            // const buffer = await readFile(scriptPath); #96 nodejs V19
            let script = buffer.toString();

            let ipAddress = helpers.getIPAddress(node);
            let url = 'http://' + ipAddress +  ':' + node.server.port + '/callback';
            script = helpers.replace(script, '%URL%', url);
            let sender = node.hostname;
            script = helpers.replace(script, '%SENDER%', sender);

            success = await tryInstallScriptAsync(node, script, scriptName);
        }
        else{
            // nothing to do.
            success = true;
        }

        return success;
    }

    // starts polling or installs a webhook that calls a REST callback.
    async function initializer2WebhookAsync(node, types){

        const webhookName = 'node-red-contrib-shelly';
        await tryUninstallWebhook2Async(node, webhookName); // we ignore if it failed.
            
        let success = false;
        let mode = node.mode;
        if(mode === 'polling'){
            await helpers.startAsync(node, types);
            success = true;
        }
        else if(mode === 'callback'){
            let ipAddress = helpers.getIPAddress(node);
            let webhookUrl = 'http://' + ipAddress +  ':' + node.server.port + '/webhook';
            success = await tryInstallWebhook2Async(node, webhookUrl, webhookName);
        }
        else{
            // nothing to do.
            success = true;
        }

        return success;
    }

    // Gets a function that initialize the device.
    function getInitializer2(deviceType){
        let result;

        switch(deviceType) {
            case 'Button':
            case 'Relay':
            case 'Measure':
            case 'Dimmer':
                result = initializer2CallbackAsync;
                break;
            case 'Sensor':
                result = initializer2WebhookAsync;
                break;
            default:
                result = initializer2;
                break;
        }
        return result;
    }

    let gen2DeviceTypes = new Map([
        ["Relay",      ["SHSW-", "SNSW-", "SPSW-", "SNPL-"]],
        ["Button",     ["SNSN-"]],
        ["Sensor",     ["SNSN-"]], // Shelly Plus H&T / PLus Smoke only support Webhook, no scripting
        ["Measure",    ["SPEM-"]],
        ["Dimmer",     ["SHDM-"]],
    ]);

    function getDeviceTypes2(deviceType){
        let deviceTypes = gen2DeviceTypes.get(deviceType);
        if(deviceTypes === undefined){
            deviceTypes = []; 
        }

        return deviceTypes;
    }

    // Returns a status object with filtered properties.
    function convertStatus2(status){
        let result = {};

        Object.keys(status).forEach(key => {
            let statusValue = status[key];
            if(statusValue !== undefined) {
                // we only copy the key that contain a : like input:0...
                if(key.indexOf(":") !== -1){
                    let newKey = helpers.replace(key, ":", "");
                    result[newKey] = statusValue;
                }
            }
        });

        return result;
    }

    function executeCommand2(msg, request, node, credentials){

        let getStatusRoute = '/rpc/Shelly.GetStatus';
        if (request !== undefined && request.route !== undefined && request.route !== ''){

            let route = request.route;
            let method = request.method;
            let data = request.data;

            helpers.shellyTryRequest(method, route, data, node, credentials, null, function(body) {

                if (node.getStatusOnCommand) {
                    helpers.shellyTryGet(getStatusRoute, node, credentials, null, function(body) {
                        
                        node.status({ fill: "green", shape: "ring", text: "Connected." });

                        let status = body;
                        msg.status = status;
                        msg.payload = convertStatus2(status);
                        node.send([msg]);
                    },
                    function(error){
                        if (msg.payload){
                            node.status({ fill: "yellow", shape: "ring", text: error.message });
                            node.warn(error);
                        }
                    });
                }
                else {
                    node.status({ fill: "green", shape: "ring", text: "Connected." });

                    msg.payload = body;
                    node.send([msg]);
                }
            },
            function(error){
                node.status({ fill: "yellow", shape: "ring", text: error.message });
                node.warn(error);
            });
        }
        else {
            helpers.shellyTryGet(getStatusRoute, node, credentials, null, function(body) {
                    
                node.status({ fill: "green", shape: "ring", text: "Connected." });

                let status = body;
                msg.status = status;
                msg.payload = convertStatus2(status);
                node.send([msg]);
            },
            function(error){
                if (msg.payload){
                    node.status({ fill: "yellow", shape: "ring", text: error.message });
                    node.warn(error);
                }
            });
        }
    }


    // --------------------------------------------------------------------------------------------
    // The shelly callback server node
    function ShellyGen2ServerNode(config) {
        RED.nodes.createNode(this, config);

        let node = this;
        this.port = config.port;
        this.hostname = config.hostname;
        this.hostip = config.hostip;
        this.server = helpers.fastify();

        if(node.port > 0){
            node.server.listen({port : node.port}, (err, address) => {
                if (!err){
                    console.info("Shelly gen2 server is listening on port " + node.port);
                }
                else{
                    node.error("Shelly gen2 server failed to listen on port " + node.port);
                }
            })

            node.server.put("/callback", (request, reply) => {
                let data = {
                    sender : request.body.sender,
                    event : request.body.event,
                }
                node.emit('callback', data);
                reply.code(200);
                reply.send();
            });

            node.server.get("/webhook", (request, reply) => {
                let data = {
                    hookType : request.query.hookType,
                    sender : request.query.sender,
                    event : request.query, // request.body is null
                }
                node.emit('callback', data);
                reply.code(200);
                reply.send();
            });
        }
            
        this.on('close', function (removed, done) {
            node.server.close().then(() => {
                done();
            });
        });
    }

    RED.nodes.registerType('shelly-gen2-server', ShellyGen2ServerNode, {
        credentials: {
            token: { type: 'text' },
        },
    });

    // --------------------------------------------------------------------------------------------
    // The shelly node controls a shelly generation 1 device.
    function ShellyGen2Node(config) {
        RED.nodes.createNode(this, config);
        let node = this;
        
        node.server = RED.nodes.getNode(config.server);
        node.outputMode = config.outputmode;
        
        if(config.uploadretryinterval !== undefined) {
            node.initializeRetryInterval = parseInt(config.uploadretryinterval);
        }
        else {
            node.initializeRetryInterval = 5000;
        }
        
        node.hostname = helpers.trim(config.hostname);
        node.authType = "Digest";
        node.pollInterval = parseInt(config.pollinginterval);
        node.pollStatus = config.pollstatus;
        node.getStatusOnCommand = config.getstatusoncommand;

        let deviceType = config.devicetype;
        node.deviceType = deviceType;
        
        node.mode = config.mode;
        if (!node.mode) {
            node.mode = 'polling';
        }

        node.status({});

        if(deviceType !== undefined && deviceType !== "") {
            node.initializer = getInitializer2(deviceType);
            node.inputParser = getInputParser2(deviceType);
            node.types = getDeviceTypes2(deviceType);
            
            (async () => {
                let initialized = await node.initializer(node, node.types);

                // if the device is not online, then we wait until it is available and try again.
                if(!initialized){
                    node.initializeTimer = setInterval(async function() {

                        let initialized = await node.initializer(node, node.types);
                        if(initialized){
                            clearInterval(node.initializeTimer);
                        }
                    }, node.initializeRetryInterval);
                }
            })();

            this.on('input', async (msg) => {
                let credentials = helpers.getCredentials(node, msg);
                let request = await node.inputParser(msg, node, credentials);
                executeCommand2(msg, request, node, credentials);
            });

            // Callback mode:
            if(node.server !== null && node.server !== undefined && node.mode === 'callback') {
                node.onCallback = (data) => {
                    if(data.sender === node.hostname){
                        if(node.outputMode === 'event'){
                            let msg = {
                                payload : data.event
                            };
                            node.send([msg]);
                        }
                        else if(node.outputMode === 'status'){
                            node.emit("input", {});
                        }
                        else {
                            // not implemented
                        }
                    }
                };
                node.server.addListener('callback', node.onCallback);
            }

            this.on('close', (done) => {
                node.status({});

                if (node.onCallback) {
                    node.server.removeListener('callback', node.onCallback);
                }

                // TODO: call node.uninitializer();
                clearInterval(node.pollingTimer);
                clearInterval(node.initializeTimer);
                done();
            });
        }
        else{
            node.status({ fill: "red", shape: "ring", text: "DeviceType not configured." });
            node.warn("DeviceType not configured");
        }
    }

    RED.nodes.registerType("shelly-gen2", ShellyGen2Node, {
        credentials: {
            username: { type: "text" },
            password: { type: "password" },
        }
    });
    
    RED.httpAdmin.get("/node-red-contrib-shelly-getipaddresses", function(req, res) {
        console.log('shelly-gen2.js hit RED.httpAdmin.get("/node-red-contrib-shelly-getipaddresses req"'+JSON.stringify(req)+' res:'+JSON.stringify(res))
        let ipAddresses = helpers.getIPAddresses();
        res.json(ipAddresses);
    });

}