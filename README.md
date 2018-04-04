# node-red-contrib-mqtt-env
This is an node module for node-red that allows to use environment variables for MQTT broker uris in MQTT nodes.

#### Run locally
(-> npm install node-red -g)

-> npm install node-red-contrib-mqtt-env -g

-> export MQTT_AWESOME_BROKER_URI=<your_awesome_broker_uri>
or add to ~/.bash_profile

-> start node-red

#### Use it
In the console you should see something like
[mqtt] Resolving ENV: MQTT_AWESOME_BROKER_URI into your_awesome_broker_uri

and in the webview you get an input and an output node named mqtt-env.

Add a configuration node and instead of giving a broker uri just enter your environment variable.


