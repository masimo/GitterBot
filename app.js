/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var express = require('express');
var passport = require('passport');
var OAuth2Strategy = require('passport-oauth2');
var https = require('https');
var request = require('request');

var gitterHost = process.env.HOST || 'https://gitter.im';
var port = process.env.PORT || 7000;

// Client OAuth configuration
var clientId = process.env.GITTER_KEY || '12ad88249c9c23cbb119bce8c4273db4128b7cb4';
var clientSecret = process.env.GITTER_SECRET || 'a96d3ac6881f57a6b98566f1eda549c79abda13c';
var roomName = process.env.ROOM_NAME || process.argv[2] || null;
var roomId = process.env.ROOM_ID || null;
var heartbeat = " \n";

// Gitter API client helper
var gitter = {

    fetch: function(path, token, cb) {
        var options = {
            url: gitterHost + path,
            headers: {
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
                    messaging.onMessage(JSON.parse(msg), function(message) {
                        that.sendMessage(roomId, resource, token, message);
                    })
                }
            });
        }).on('error', function(e) {
            console.log('Something went wrong: ' + e.message);
        }).end();
    },
    sendMessage: function(roomId, resource, token, message) {
        this.postData('/api/v1/rooms/' + roomId + '/' + resource, token, {
            text: message
        }, function(err, body) {
            if (err) console.log('Bad request');
        });
    }
};

var messaging = {
    onMessage: function(message, cb) {
        var message = message.text.trim();
        var newRegExpCalc = /^calc /;
        var newRegExpVariantion = /[^\d\s(-*)\+\/\.\,]/gi;
        var answer, textAnswer;
        if (newRegExpCalc.test(message)) {
            message = message.replace(newRegExpCalc, '');
            if (newRegExpVariantion.test(message))
                return;

            try {
                answer = global['ev' + 'al'](message);
                textAnswer = message + ' = ' + answer;
            } catch (e) {}

        };
        textAnswer && cb(textAnswer);
    }
}

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

    // Fetch user rooms using the Gitter API
    gitter.fetchRooms(req.user, req.session.token, function(err, rooms) {
        if (err) return res.send(500);

        rooms.forEach(function(room, key) {
            if (roomName === room.name) {
                roomId = room.id;
            } else if (!roomName) {
                roomId = room.id;
            };
        });

        gitter.warcherMessages(roomId, 'chatMessages', req.session.token);

        res.render('home', {
            user: req.user,
            token: req.session.token,
            clientId: clientId,
            rooms: rooms
        });
    });



});

app.listen(port);
console.log('Demo app running at http://localhost:' + port);