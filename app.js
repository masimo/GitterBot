"use strict";

var express = require('express');
var passport = require('passport');
var OAuth2Strategy = require('passport-oauth2');
var https = require('https');
var request = require('request');
var messaging = require('./messaging');

var gitterHost = process.env.HOST || 'https://gitter.im';
var port = process.env.PORT || 7000;

// Client OAuth configuration
var clientId = process.env.GITTER_KEY;
var clientSecret = process.env.GITTER_SECRET;
var currentRoom = process.env.ROOM || null;
var roomName = process.env.ROOM_NAME || null;
var roomId = process.env.ROOM_ID || null;
var heartbeat = " \n";

// Gitter API client helper
var gitter = {

    fetch: function(path, token, cb) {
        var options = {
            url: gitterHost + path,
            headers: {
                "Accept": "application/json",
                'Authorization': 'Bearer ' + token
            }
        };

        request(options, function(err, res, body) {
            if (err) return cb(err);

            if (res.statusCode === 200) {
                cb(null, JSON.parse(body));
            } else {
                cb('err' + res.statusCode);
            }
        });
    },

    postData: function(path, token, data, cb) {
        var options = {
            url: gitterHost + path,
            form: data,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': 'Bearer ' + token
            }
        };

        request.post(options, function(err, res, body) {
            if (err) return cb(err);

            if (res.statusCode === 200) {
                cb(null, JSON.parse(body));
            } else {
                cb('err' + res.statusCode);
            }
        });
    },

    fetchCurrentUser: function(token, cb) {
        this.fetch('/api/v1/user/', token, function(err, user) {
            cb(err, user[0]);
        });
    },

    fetchRooms: function(user, token, cb) {
        this.fetch('/api/v1/user/' + user.id + '/rooms', token, function(err, rooms) {
            cb(err, rooms);
        });
    },
    joinRoom: function(token, data, cb) {
        this.postData('/api/v1/rooms', token, data, function(err, rooms) {
            cb(err, rooms);
        });
    },
    sendMessage: function(roomId, resource, token, message) {
        this.postData('/api/v1/rooms/' + roomId + '/' + resource, token, {
            text: message
        }, function(err, body) {
            if (err) console.log('Bad request');
        });
    },
    warcherMessages: function(roomId, resource, token) {
        var that = this;
        var options = {
            hostname: 'stream.gitter.im',
            port: 443,
            path: '/v1/rooms/' + roomId + '/' + resource,
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + token
            }
        };
        https.request(options, function(res) {
            res.on('data', function(chunk) {
                var msg = chunk.toString();
                if (msg !== heartbeat) {
                    messaging.onMessage(JSON.parse(msg), function(err, backMessage) {
                        if (!err)
                            that.sendMessage(roomId, resource, token, backMessage);
                        else
                            console.log(err);
                    });
                }
            });
        }).on('error', function(e) {
            console.log('Something went wrong: ' + e.message);
        }).end();
    }
};

var app = express();

// Middlewares
app.set('view engine', 'jade');
app.set('views', __dirname + '/views');
app.use(express.json());
app.use(express.urlencoded());
app.use(express.static(__dirname + '/public'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser());
app.use(express.session({
    secret: 'keyboard cat'
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(app.router);

// Passport Configuration

passport.use(new OAuth2Strategy({
        authorizationURL: gitterHost + '/login/oauth/authorize',
        tokenURL: gitterHost + '/login/oauth/token',
        clientID: clientId,
        clientSecret: clientSecret,
        callbackURL: '/login/callback',
        passReqToCallback: true
    },
    function(req, accessToken, refreshToken, profile, done) {
        req.session.token = accessToken;
        gitter.fetchCurrentUser(accessToken, function(err, user) {
            return (err ? done(err) : done(null, user));
        });
    }
));

passport.serializeUser(function(user, done) {
    done(null, JSON.stringify(user));
});

passport.deserializeUser(function(user, done) {
    done(null, JSON.parse(user));
});

app.get('/login',
    passport.authenticate('oauth2')
);

app.get('/login/callback',
    passport.authenticate('oauth2', {
        successRedirect: '/home',
        failureRedirect: '/'
    })
);

app.get('/logout', function(req, res) {
    req.session.destroy();
    res.redirect('/');
});

app.get('/', function(req, res) {
    res.render('landing');
});

app.get('/home', function(req, res) {
    if (!req.user) return res.redirect('/');

    if (currentRoom && currentRoom.hasOwnProperty('url')) {
        res.redirect(gitterHost + currentRoom.url);
    } else {
        gitter.joinRoom(req.session.token, {
            "uri": roomName
        }, function(err, room) {
            if (err) return res.send(500);
            currentRoom = room;

            gitter.warcherMessages(room.id, 'chatMessages', req.session.token);

            res.redirect(gitterHost + currentRoom.url);
        });
    }
});

app.listen(port);
console.log('Demo app running at http://localhost:' + port);