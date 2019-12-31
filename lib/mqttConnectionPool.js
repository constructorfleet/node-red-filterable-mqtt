/**
 * Copyright 2013 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/
var util = require("util");
var mqtt = require("./mqtt");
//var settings = require(process.env.NODE_RED_HOME+"/red/red").settings;

const PRIVATERED = (function requireExistingNoderedInstance() {
    for(const child of require.main.children) {
        if(child.filename.endsWith('red.js')) {
            return require(child.filename);
        }
    }
    // In case node-red was not required before, just require it
    return require('node-red');
})();

var settings = PRIVATERED.settings;


var connections = {};

function matchTopic(ts,t) {
    if (ts == "#") {
        return true;
    }
    var re = new RegExp("^"+ts.replace(/([\[\]\?\(\)\\\\$\^\*\.|])/g,"\\$1").replace(/\+/g,"[^/]+").replace(/\/#$/,"(\/.*)?")+"$");
    return re.test(t);
}

module.exports = {
    get: function(broker,port,clientid,username,password,will) {
        var id = "["+(username||"")+":"+(password||"")+"]["+(clientid||"")+"]@"+broker+":"+port;
        if (!connections[id]) {
            connections[id] = function() {
                var uid = (1+Math.random()*4294967295).toString(16);
                var client = mqtt.createClient(port,broker);
                client.uid = uid;
                client.setMaxListeners(0);
                var options = {keepalive:15};
                options.clientId = clientid || 'mqtt_' + (1+Math.random()*4294967295).toString(16);
                options.username = username;
                options.password = password;
                options.will = will;
                var queue = [];
                var subscriptions = [];
                var connecting = false;
                var obj = {
                    _instances: 0,
                    publish: function(msg) {
                        if (client.isConnected()) {
                            client.publish(msg.topic,msg.payload,msg.qos,msg.retain);
                        } else {
                            if (!connecting) {
                                connecting = true;
                                client.connect(options);
                            }
                            queue.push(msg);
                        }
                    },
                    subscribe: function(node,topic,qos,callback) {
                        var _callback = function(mtopic,mpayload,mqos,mretain) {
                                if (matchTopic(topic,mtopic)) {
                                    callback(mtopic,mpayload,mqos,mretain);
                                }
                        }
                        subscriptions.push({topic:topic,qos:qos,callback:callback, node:node, callback : _callback});
                        client.on('message',_callback);
                        if (client.isConnected()) {
                            client.subscribe(topic,qos);
                        }
                    },
                    unsubscribe: function(node,topic){
                        var subs_to_delete = subscriptions.filter(sub => (sub.topic==topic && sub.node.id == node.id))
                        subs_to_delete.forEach(sub => client.removeListener('message', sub.callback));
                        subscriptions = subscriptions.filter(sub => !(sub.topic==topic && sub.node.id == node.id))
                        if (client.isConnected() && subscriptions.filter(sub => sub.topic == topic).length==0){
                            client.unsubscribe(topic);
                        }
                    },
                    on: function(a,b){
                        client.on(a,b);
                    },
                    once: function(a,b){
                        client.once(a,b);
                    },
                    isConnected: function(){
                      return client.isConnected()
                    },
                    connect: function() {
                        if (client && !client.isConnected() && !connecting) {
                            connecting = true;
                            client.connect(options);
                        }
                    },
                    disconnect: function() {
                        this._instances -= 1;
                        if (this._instances == 0) {
                            client.disconnect();
                            client = null;
                            delete connections[id];
                        }
                    }
                };
                client.on('connect',function() {
                        if (client) {
                            util.log('[mqtt] ['+uid+'] connected to broker tcp://'+broker+':'+port);
                            connecting = false;
                            for (var s in subscriptions) {
                                var topic = subscriptions[s].topic;
                                var qos = subscriptions[s].qos;
                                var callback = subscriptions[s].callback;
                                client.subscribe(topic,qos);
                            }
                            //console.log("connected - publishing",queue.length,"messages");
                            while(queue.length) {
                                var msg = queue.shift();
                                //console.log(msg);
                                client.publish(msg.topic,msg.payload,msg.qos,msg.retain);
                            }
                        }
                });
                client.on('connectionlost', function(err) {
                        util.log('[mqtt] ['+uid+'] connection lost to broker tcp://'+broker+':'+port);
                        connecting = false;
                        setTimeout(function() {
                            obj.connect();
                        }, settings.mqttReconnectTime||5000);
                });
                client.on('disconnect', function() {
                        connecting = false;
                        util.log('[mqtt] ['+uid+'] disconnected from broker tcp://'+broker+':'+port);
                });

                return obj
            }();
        }
        connections[id]._instances += 1;
        return connections[id];
    }
};
