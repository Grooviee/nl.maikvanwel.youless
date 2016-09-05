"use strict";
var request = require('request');
// a list of devices, with their 'id' as key
// it is generally advisable to keep a list of
// paired and active devices in your driver's memory.
var devices = {};
var intervalId = {};

// the `init` method is called when your driver is loaded for the first time
module.exports.init = function( devices_data, callback ) {
    devices_data.forEach(initDevice);
  //setInterval(monitor, 15000);



  callback(true, null);
}

module.exports.settings = function( device_data, newSettingsObj, oldSettingsObj, changedKeysArr, callback ) {
    // run when the user has changed the device's settings in Homey.
    // changedKeysArr contains an array of keys that have been changed, for your convenience :)
    //Homey.log(newSettingsObj.pollingrate);
    if(newSettingsObj.pollingrate < 5){callback( __('pair.settingschanged.not_under_5'), null );}
    clearInterval(intervalId[device_data.id]);
    delete intervalId[device_data.id];

    devices[device_data.id].settings.name=newSettingsObj.name;
     devices[device_data.id].settings.host=newSettingsObj.host;
     devices[device_data.id].settings.pollingrate=newSettingsObj.pollingrate;
     devices[device_data.id].name = newSettingsObj.name;
    initDeviceInterval(device_data, devices[device_data.id].settings.pollingrate);


    // always fire the callback, or the settings won't change!
    // if the settings must not be saved for whatever reason:
    // callback( "Your error message", null );
    // else
    callback( null, true );

}


// the `added` method is called is when pairing is done and a device has been added
module.exports.added = function( device_data, callback ) {
    initDevice( device_data );


    Homey.log('Device added! * ' + device_data.id + ' *');
    callback( null, true );
}

// the `delete` method is called when a device has been deleted by a user
module.exports.deleted = function( device_data, callback ) {
    delete devices[ device_data.id ];

    clearInterval(intervalId[device_data.id]);
    delete intervalId[device_data.id];
    Homey.log('Device deleted');
    callback( null, true );
}

// the `pair` method is called when a user start pairing
module.exports.pair = function( socket ) {
    socket.on('pair', function( device, callback ){

      var url = 'http://' + device.settings.host + '/a?f=j';
      request({
            url: url,
            json: true
          }, function (error, response, body) {

            if (!error && response.statusCode === 200) {

                callback(null, __('pair.feedback.succesfully_connected'))

          }
          else{
            callback(__('pair.feedback.could_not_connect') + ' ' + error)
          }
        }
    )



})
}



// these are the methods that respond to get/set calls from Homey
// for example when a user pressed a button
module.exports.capabilities = {
    measure_power: {

        // this function is called by Homey when it wants to GET the dim state, e.g. when the user loads the smartphone interface
        // `device_data` is the object as saved during pairing
        // `callback` should return the current value in the format callback( err, value )
        get: function( device_data, callback ){

            // get the bulb with a locally defined function
            var device = getDeviceByData( device_data );
            if( device instanceof Error ) return callback( device );

            return callback( null, device.LastUsage );
        }
    },
    meter_power: {
      get: function( device_data, callback ){
        var device = getDeviceByData( device_data );
        if( device instanceof Error ) return callback( device );

        return callback( null, device.totalKWH );
      }
    }
}



// a helper method to get a device from the devices list by it's device_data object
function getDeviceByData( device_data ) {
    var device = devices[ device_data.id ];
    if( typeof device === 'undefined' ) {
        return new Error("invalid_device");
    } else {
        return device;
    }
}

// a helper method to add a device to the devices list
function initDevice( device_data, newSettingsObj, callback) {

  module.exports.getSettings( device_data, function( err, settings ){


    //migration from old v0.9.8 app with no settings in device
    if (settings.name==undefined || settings.host==undefined || settings.pollingrate==undefined) {
      Homey.log("No pollingrate found!");
      settings = {
        name: device_data.name,
        host: device_data.ip,
        pollingrate: 10 };
        devices[ device_data.id ].settings = settings;
        initDeviceInterval(device_data, settings.pollingrate);
        module.exports.setSettings( device_data, settings, function( err, settings ){
            // ... dunno what to do here, think nothing...
        })

    }
    else{
      devices[ device_data.id ].settings = settings;
      initDeviceInterval(device_data, settings.pollingrate);

    }
  })
    devices[ device_data.id ] = {};
    devices[ device_data.id ].data = device_data;

    Homey.manager('speech-input').on('speech', function (speech, callback) {
        var device = getDeviceByData(device_data);
        if(typeof device.LastUsage === 'undefined'){
           monitorYouless(device_data); 
        }
        Homey.manager("speech-output").say( __("usage", {  "name": device.settings.name, "usage": device.LastUsage }));
    });





  }






function initDeviceInterval(device_data,pollingrate){
  intervalId[device_data.id] = setInterval(function () {
    monitorYouless(device_data, function(response){
        //reserved for callback
      })
    }, pollingrate * 1000);
}



function monitorYouless(device_data, callback) {


      var device = getDeviceByData(device_data);

      Homey.log("Trying " + device.settings.host + " Polling rate is: " + device.settings.pollingrate);


      var url = 'http://' + device.settings.host + '/a?f=j';
      request({
            url: url,
            json: true
          }, function (error, response, body) {

            if (!error && response.statusCode === 200) {
                module.exports.setAvailable( device.data );
                var obj = body;
                var currentUsage = obj.pwr;
                var MeterTotal = obj.cnt;
                MeterTotal = MeterTotal.replace(",", ".");
                MeterTotal = +MeterTotal;
                //MeterTotal = MeterTotal / 1000;

                if(device.LastUsage != currentUsage){
                  module.exports.realtime( device.data, 'measure_power', currentUsage, function( err, result ){
                      device.LastUsage = currentUsage;
                } );
                }
                if(device.totalKWH != MeterTotal){
                  module.exports.realtime( device.data, 'meter_power', MeterTotal, function( err, result ){
                      device.totalKWH = MeterTotal;
                } );
                }






                Homey.log('Current usage:' + device.LastUsage + ' W');
                Homey.log('Meter total:' + device.totalKWH + ' KW/H');






          }
          else{
            Homey.log("YouLess is offline!")
            module.exports.setUnavailable( device.data, "Offline" );
          }
        }
      )



}
