var request = require('request');

var devices = [];
var tempDeviceData;

module.exports.init = function (devices_data, callback) {
    Homey.log("YouLess App start");

    for (var x = 0; x < devices_data.length; x++) {
        if (devices_data[x].hasOwnProperty("id")) {
            Homey.log("Adding device", devices_data[x]);

            devices.push({
                name: devices_data[x].name,
                data: devices_data[x],
                cache: null
            });
        }
    }

    setTimeout(monitor, 1000);
    setInterval(monitor, 15000);

    callback(null, true);
};

module.exports.pair = function( socket ) {
	socket.on('list_devices', function( device_data, callback ) {
        devices.push({
           name: tempDeviceData.name,
           data: {
               name: tempDeviceData.name,
               id: tempDeviceData.ip.replace(/\./g, '-'),
               ip: tempDeviceData.ip
           },
           cache: null
        });

        Homey.log("Added", devices[devices.length-1]);

		callback(null, devices);
	});

	socket.on('get_devices', function( data, callback ) {
        Homey.log("get_devices", data);

        tempDeviceData = {
            name: data.name,
            ip: data.ip
        };

        socket.emit('continue', null);
	});

	socket.on('disconnect', function(){
		Homey.log("YouLess app - User aborted pairing, or pairing is finished");
	});
};

module.exports.capabilities = {
	measure_power: {
		get: function(device_data, callback) {
            var device = getDevice(device_data.id);

            if(device.cache) {
                var last = parseInt(device.cache[device.cache.length - 1]);
                Homey.log("measure_power GET: ", last);

                callback(true, last);
            } else {
                callback(false, null);
            }
		}
	}
};

module.exports.deleted = function (device_data) {
    var device = getDevice(device_data.id);

    var device_index = devices.indexOf(device);
    if (device_index > -1) {
        devices.splice(device_index, 1);
    }
};

function monitor() {
    for (var i = 0; i < devices.length; i++) {
        (function(device) {
            request('http://' + device.data.ip + '/V?h=1&f=j', function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    var data = JSON.parse(body);
                    var values = data.val.filter(Boolean);

                    var current = parseInt(values[values.length - 1]);
                    module.exports.realtime(device, "measure_power", current);

                    device.cache = values;
                } else {
                    Homey.log(error);
                }
            });
        })(devices[i]);
    }
}

function getDevice(device_id) {
    for (var x = 0; x < devices.length; x++) {
        if (devices[x].data.id === device_id) {
            return devices[x];
        }
    }
}

module.exports.deleted = function (device_data) {
    var device = getDevice(device_data.id);

    var device_index = devices.indexOf(device);
    if (device_index > -1) {
        devices.splice(device_index, 1);
    }

    Homey.log("Removed device " + device_data.id + ", devices left:", devices);
};