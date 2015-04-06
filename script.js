"use strict";

var Gitter = require('node-gitter');
var messaging = require('./messaging');

var options = {
    gitterHost: process.env.HOST || 'https://gitter.im',
    token: process.env.TOKEN,
    roomName: process.env.ROOM_NAME || null
};
var gitter = new Gitter(options.token);

gitter.currentUser(function(err, user) {
    console.log('You are logged in as:', user.username);
});

gitter.rooms.join(options.roomName).then(function(room) {
    var events = room.listen();

    events.on('message', function(message) {
        messaging.onMessage(message, function(err, backMessage) {
            if (!err)
                room.send(backMessage);
            else
                console.log(err);
        });
    });
    console.log('Demo bot running at ' + options.gitterHost + room.url);
});