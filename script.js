//https://api.gitter.im/v1/
var https = require('https');
var roomId = process.env.ROOM_ID;
var token = process.env.TOKEN;

var heartbeat = " \n";
console.log(process);

var optionsTest = {
	hostname: 'stream.gitter.im',
	port: 443,
	path: "/v1/rooms",
	method: 'GET',
}	

var options = {
	hostname: 'stream.gitter.im',
	port: 443,
	path: '/v1/rooms/' + roomId + '/chatMessages',
	method: 'GET',
	headers: {
		'Authorization': 'Bearer ' + token
	}
};
var req = https.request(optionsTest, function(res) {
	res.on('data', function(chunk) {
		console.log(chunk);
		var msg = chunk.toString();
		if (msg !== heartbeat) console.log('Message: ' + msg);
	});
});
req.on('error', function(e) {
	console.log('Something went wrong: ' + e.message);
});

req.end();
