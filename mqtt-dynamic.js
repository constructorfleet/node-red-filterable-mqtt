/**
 * Copyright 2013,2014 IBM Corp.
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

module.exports = function(RED) {
    "use strict";
    var connectionPool = require("./lib/mqttConnectionPool");
    var isUtf8 = require('is-utf8');
    var util = require("util");

    function MQTTBrokerNode(n) {
        RED.nodes.createNode(this,n);
        this.broker = n.broker;
        this.port = n.port;
        this.clientid = n.clientid;
        if (this.credentials) {
            this.username = this.credentials.user;
            this.password = this.credentials.password;
        }
    }
    RED.nodes.registerType("mqtt-dynamic-broker",MQTTBrokerNode,{
        credentials: {
            user: {type:"text"},
            password: {type: "password"}
        }
    });

    function MQTTInNode(n) {
        RED.nodes.createNode(this,n);
        this.broker = n.broker;
        this.topic = "";
        this.brokerConfig = RED.nodes.getNode(this.broker);
        if (this.brokerConfig)
        {
            this.on('input', function(msg) {
              var node = this;

                if (this.client) {
                    if (this.topic){
                        this.client.unsubscribe(node, this.topic);
                    }
                    //this.client.disconnect();
                } else {
                  this.client = connectionPool.get(this.brokerConfig.broker,this.brokerConfig.port,this.brokerConfig.clientid,this.brokerConfig.username,this.brokerConfig.password);
                }
                if (msg.topic && msg.topic.length > 0) {
                    this.topic = msg.topic;
                } else{
                  this.topic = null;
                }

                this.status({fill:"red",shape:"ring",text:"disconnected"});

                if (this.topic) {
                    this.client.subscribe(node,this.topic,2,function(topic,payload,qos,retain) {
                        if (isUtf8(payload)) { payload = payload.toString(); }
                        var msg = {topic:topic,payload:payload,qos:qos,retain:retain};
                        if ((node.brokerConfig.broker === "localhost")||(node.brokerConfig.broker === "127.0.0.1")) {
                            msg._topic = topic;
                        }
                        node.send(msg);
                    });
                    this.client.on("connectionlost",function() {
                        node.status({fill:"red",shape:"ring",text:"disconnected"});
                    });
                    this.client.on("connect",function() {
                        node.status({fill:"green",shape:"dot",text:"connected"});
                    });
                    if (!this.client.isConnected()){
                      this.client.connect();
                    }
                }
                else {
                    this.status({fill:"red",shape:"ring",text:"deleted"});
                }
            });
        } else {
            this.error("missing broker configuration");
        }
        this.on('close', function() {
            if (this.client) {
                this.client.disconnect();
            }
        });
    }
    RED.nodes.registerType("mqtt-dynamic in",MQTTInNode);
}
