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

    callback(true, null);
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
        Homey.manager('insights').createLog( 'power_usage' + devices.name, {
        label: {
            nl: 'Energie verbruik'
        },
        type: 'number',
        units: {
            nl: 'kWh'
        },
        decimals: 2,
        chart: 'line' // prefered, or default chart type. can be: line, area, stepLine, column, spline, splineArea, scatter
    }, function callback(err , success){
        if( err ) return Homey.error(err);
      });
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
                callback(false, last);
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
                    Homey.log("measure_power MONITOR: ", current);

                    Homey.manager('insights').createEntry( 'power_usage' + devices.name, current, new Date(), function(err, success){
                        if( err ) return Homey.error(err);
                    });

                    var Animation = Homey.manager('ledring').Animation;

                    var frames_powerusageled = [];
                    var frame_powerusageled = [];

                    var greenw = Homey.manager('settings').get('greenw');
                    var orangew = Homey.manager('settings').get('orangew');

                    if(greenw == null || orangew == null){
                      var greenw = 1500;
                      Homey.manager('settings').set('greenw',1500);
                      var orangew = 2500;
                      Homey.manager('settings').set('orangew',2500);
                    }

                    console.log('greenw: ', greenw);
                    // for every pixel...
                    for( var pixel = 0; pixel < 24; pixel++ ) {
                    	if( pixel < 24) {
                      if(current <= greenw){
                        frame_powerusageled.push({
                    			r: 0,	g: 255,	b: 0
                    		});
                      }
                      if(current >= greenw && current <= orangew){
                        frame_powerusageled.push({
                          r: 255,	g: 128,	b: 0
                        });
                      }
                      if(current >= orangew){
                        frame_powerusageled.push({
                          r: 255,	g: 0,	b: 0
                        });
                      }

                    	} else {
                    		frame_powerusageled.push({
                    			r: 0, g: 0, b: 0
                    		})
                    	}
                    }
                    frames_powerusageled.push(frame_powerusageled);

                    var animation_powerusageled = new Animation({

                        options: {
                            fps     : 1, 	// real frames per second
                            tfps    : 60, 	// target frames per second. this means that every frame will be interpolated 60 times
                            rpm     : 1,	// rotations per minute
                        },
                        frames    : frames_powerusageled
                    })

                    animation_powerusageled.register(function(err, result){
                    	Homey.manager('ledring').registerScreensaver('powerusageled', animation_powerusageled)
                    	if( err ) return Homey.error(err);
                    	animation_powerusageled.on('screensaver_start', function( screensaver_id ){
                    		Homey.log('Screensaver started')

                    	})
                    	animation_powerusageled.on('screensaver_stop', function( screensaver_id ){
                    		Homey.log('Screensaver stopped')
                    	})
                    })


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
