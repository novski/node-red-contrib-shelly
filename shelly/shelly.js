/**
* Created by Karl-Heinz Wind
* see also https://shelly-api-docs.shelly.cloud/#common-http-api
**/



module.exports = {

    axios : require('axios').default,

    rateLimit : require("axios-rate-limit"),

    fs : require("fs"),
    // const { readFile } = require('fs/promises'); see #96 nodejs V19

    crypto : require('crypto'),
    // const crypto = require('node:crypto'); see #99 nodejs V19

    path : require("path"),
    // const path = require('node:path'); see #99 nodejs V19

    fastify : require('fastify'),

    nonceCount : 1,

    //  no operation function
    noop: function (){},

    isEmpty: function (obj) {
        return Object.keys(obj).length === 0;
    },

    trim: function(str) {
        let result;
        if(str !== undefined){
            result = str.trim();
        }

        return result;
    },
    
    replace: function (str, pattern, replacement) {
        let result;
        if(str !== undefined){
            result = str.replace(pattern, replacement);
        }

        return result;
    },

    combineUrl: function (path, parameters) {
        let route = path + '?';

        if(parameters.charAt(0) === '&'){
            parameters = parameters.substring(1);
        }

        route += parameters;
        return route;
    },

    // gets all IP addresses: https://stackoverflow.com/questions/3653065/get-local-ip-address-in-node-js?page=2&tab=scoredesc#tab-top
    getIPAddresses: function () {
        let ipAddresses = [];
    
        let interfaces = require('os').networkInterfaces();
        for (let devName in interfaces) {
            let iface = interfaces[devName];
            for (let i = 0; i < iface.length; i++) {
                let alias = iface[i];
                if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                    ipAddresses.push(alias.address);
                }
            }
        }

        return ipAddresses;
    },

    // ToDo: check what this is for.
    // RED.httpAdmin.get("/node-red-contrib-shelly-getipaddresses", function(req, res) {
    //     let ipAddresses = this.getIPAddresses();
    //     res.json(ipAddresses);
    // });

    // Gets the local IP address from the node or using auto detection.
    getIPAddress: function (node) {
        let ipAddress;
        
        if (node.server.hostip !== undefined && node.server.hostip !== '' && node.server.hostip !== 'hostname') {
            ipAddress = node.server.hostip;
        }
        else if (node.server.hostip === 'hostname' && node.server.hostname !== undefined && node.server.hostname !== '') {
            ipAddress = node.server.hostname;
        }
        else {
            let ipAddresses = this.getIPAddresses();
            if (ipAddresses !== undefined && ipAddresses.length > 0) {
                ipAddress =  ipAddresses[0];
            }
            else {
                node.error("Could not detect local IP address: please configure hostname.");
            }
        }

        return ipAddress;
    },

    // extracts the credentials from the message and the node.
    getCredentials: function (node, msg){
        node.warn('in getCredentials msg:'+JSON.stringify(msg)+" node:"+JSON.stringify(node));
        let hostname;
        let username;
        let password;
        if(msg !== undefined && msg.payload !== undefined){
            hostname = msg.payload.hostname; 
            username = msg.payload.username; 
            password = msg.payload.password; 
        }

        if(hostname === undefined) {
            hostname = node.hostname;
        }

        if(username === undefined) {
            username = node.credentials.username;
        }

        if(password === undefined) {
            password = node.credentials.password;
        }

        let authType = node.authType;
        if(authType === 'Digest') {
            username = 'admin'; // see https://shelly-api-docs.shelly.cloud/gen2/General/Authentication
        }

        let credentials = {
            hostname : hostname,
            authType : authType,
            username : username,
            password : password,
        };

        return credentials;
    },

    // Encrypts a string using SHA-256.
    sha256: function (str){
        let result = this.crypto.createHash('sha256').update(str).digest('hex');
        return result;
    },

    // see https://shelly-api-docs.shelly.cloud/gen2/General/Authentication
    // see https://github.com/axios/axios/issues/686
    getDigestAuthorization: function (response, credentials, config){
        let authDetails = response.headers['www-authenticate'].split(', ');
        let propertiesArray = authDetails.map(v => v.split('='));
        let properties = new Map(propertiesArray.map(obj => [obj[0], obj[1]]));

        this.nonceCount++; // global counter
        let url = config.url;
        let method = config.method;

        let algorithm = properties.get('algorithm'); // TODO: check if it is still SHA-256 
        let username = credentials.username;
        let password = credentials.password;
        let realm = this.replace(properties.get('realm'), /"/g, '');
        let authParts = [username, realm, password];

        let ha1String = authParts.join(':');
        let ha1 = this.sha256(ha1String);
        let ha2String = method + ':' + url;
        let ha2 = this.sha256(ha2String);
        let nc = ('00000000' + this.nonceCount).slice(-8);
        let nonce = this.replace(properties.get('nonce'), /"/g, '');
        let cnonce = this.crypto.randomBytes(24).toString('hex');
        let responseString = ha1 + ":" + nonce + ":" + nc + ":" + cnonce + ":" + "auth" + ":" + ha2;
        let responseHash = this.sha256(responseString);

        const authorization = 
            'Digest username="' + username + 
            '", realm="' + realm + 
            '", nonce="' + nonce + 
            '", uri="' + url + 
            '", cnonce="' + cnonce + 
            '", nc=' + nc + 
            ', qop=auth' + 
            ', response="' + responseHash + 
            '", algorithm=SHA-256';
        return authorization;
    },

    // Gets a header with the authorization property for the request.
    getHeaders: function (credentials){
        let headers = {};

        if(credentials !== undefined) {
            if(credentials.authType === 'Basic') {
                if(credentials.username !== undefined && credentials.password !== undefined) {
                    // Authorization is case sensitive for some devices like the TRV!
                    headers.Authorization = "Basic " + 
                                            Buffer.from(credentials.username + ":" + 
                                                        credentials.password).toString("base64");
                };
            }
        }

        return headers;
    },

    // Note that this function has a reduced timeout.
    shellyTryGet: function (route, node, credentials, timeout, callback, errorCallback){
        node.warn("tryGet"+JSON.stringify(node))
        let data;
        return this.shellyTryRequest('GET', route, data, node, credentials, timeout, callback, errorCallback);
    },

    // Note that this function has a reduced timeout.
    shellyTryRequest: function (method, route, data, node, credentials, timeout, callback, errorCallback){
    
        if(timeout === undefined || timeout === null){
            timeout = 5000;
        };

        // We avoid an invalid timeout by taking a default if 0.
        let requestTimeout = timeout;
        if(requestTimeout <= 0){
            requestTimeout = 5000;
        }

        let headers = this.getHeaders(credentials);

        let baseUrl = 'http://' + credentials.hostname;
        let config = {
            baseURL :  baseUrl,
            url : route,
            method : method,
            data : data,
            headers : headers,
            timeout: requestTimeout,
            validateStatus : (status) => status === 200 || status === 401
        };

        try
        {
            const request = this.axios.request(config);

            request.then(response => {
                if(response.status == 200){
                    callback(response.data);
                }
                else if(response.status == 401){
                    config.headers = {
                        'Authorization': this.getDigestAuthorization(response, credentials, config)
                    }

                    const digestRequest = this.axios.request(config);
                    digestRequest.then(response => {
                        if(response.status == 200){
                            callback(response.data);
                        }
                        else {
                            node.status({ fill: "red", shape: "ring", text: "Error: " + response.statusText });
                            node.warn("Error: " + response.statusText  + ' ' + config.url);
                        }
                    })
                }
                else {
                    node.status({ fill: "red", shape: "ring", text: "Error: " + response.statusText });
                    node.warn("Error: " + response.statusText );
                }
            })
            .catch(error => {
                errorCallback(error);
            });
        }
        catch(error2) {
            errorCallback(error2);
        }
    },

    // generic REST request wrapper with promise
    shellyRequestAsync: function (method, route, data, credentials, timeout){
        node.warn('shellyRequestAsync');
        return new Promise((resolve, reject) => {
            node.warn('shellyRequestAsync new Promise');
            if(timeout === undefined || timeout === null){
                timeout = 5000;
            };

            // We avoid an invalid timeout by taking a default if 0.
            let requestTimeout = timeout;
            if(requestTimeout <= 0){
                requestTimeout = 5000;
            }
            node.warn('shellyRequestAsync new Promise with credentials:'+JSON.stringify(credentials));
            let headers = this.getHeaders(credentials);

            let baseUrl = 'http://' + credentials.hostname;
            let config = {
                baseURL :  baseUrl,
                url : route,
                method : method,
                data : data,
                headers : headers,
                timeout: requestTimeout,
                validateStatus : (status) => status === 200 || status === 401
            };
            
            try
            {   
                node.warn('shellyRequestAsync try with config:'+JSON.stringify(config));
                const request = this.axios.request(config);
                node.warn('shellyRequestAsync then with request:'+JSON.stringify(request));
                request.then(response => {
                    if(response.status == 200){
                        resolve(response.data)
                    } else if(response.status == 401){
                        config.headers = {
                            'Authorization': this.getDigestAuthorization(response, credentials, config)
                        }
        
                        const digestRequest = this.axios.request(config);
                        digestRequest.then(response => {
                            if(response.status == 200){
                                resolve(response.data)
                            }
                            else {
                                reject(response.statusText + ' ' + config.url);
                            }
                        })
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
    },


    // Hint: the /shelly route can be accessed without authorization
    shellyPing: function (node, credentials, types){

        // gen 1 and gen 2 devices support this endpoint (gen 2 return the same info for /rpc/Shelly.GetDeviceInfo)
        this.shellyTryGet('/shelly', node, credentials, node.pollInterval, function(body) {
            node.shellyInfo = body;

            let requiredNodeType;
            let deviceType;
            // Generation 1 devices
            if(node.shellyInfo.type !== undefined){
                deviceType = node.shellyInfo.type;
                requiredNodeType = 'shelly-gen1';
            } // Generation 2 devices 
            else if(node.shellyInfo.model !== undefined && node.shellyInfo.gen === 2){
                deviceType = node.shellyInfo.model;
                requiredNodeType = 'shelly-gen2';
            }
            else {
                // this can not happen right now.
                requiredNodeType = 'not shupported';
            }


            if(requiredNodeType === node.type) {
                let found = false;
                for (let i = 0; i < types.length; i++) {
                    let type = types[i];

                    // Generation 1 devices
                    if(deviceType !== undefined){
                        found  = deviceType.startsWith(type);
                        if (found) {
                            break;
                        }    
                    }
                }
                
                if(found){
                    node.status({ fill: "green", shape: "ring", text: "Connected." });
                }
                else{
                    node.status({ fill: "red", shape: "ring", text: "Shelly type mismatch: " + deviceType });
                    node.warn("Shelly type mismatch: " + deviceType);
                }
            }
            else {
                node.status({ fill: "red", shape: "ring", text: "Wrong node type. Please use " + requiredNodeType });
                node.warn("Wrong node type. Please use " + requiredNodeType);
            }
        },
        function(error){
            node.status({ fill: "red", shape: "ring", text: "Ping: " + error.message });
            // node.warn(error.message); Removed as this would flood the output.
        });
    },

    // Starts polling the status.
    start: function (node, types){
        node.warn('this happens right in start');
        if(node.hostname !== ''){    

            let credentials = this.getCredentials(node);
            this.shellyPing(node, credentials, types);

            if(node.pollInterval > 0) {
                node.pollingTimer = setInterval(() => {
                    
                    this.shellyPing(node, credentials, types);

                    if(node.pollStatus){
                        node.emit("input", {});
                    }    
                }, node.pollInterval);
            }
            else{
                node.status({ fill: "yellow", shape: "ring", text: "Polling is turned off" });
            }
        }
        else {
            node.status({ fill: "red", shape: "ring", text: "Hostname not configured" });
        }
    },

    startAsync: function (node, types){
        node.warn('this happens right in startAsync');
        return new Promise((resolve, reject) => {
            this.start(node, types);
            resolve();
        });
    }

}