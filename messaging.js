module.exports = {
	onMessage: function(message, cb) {
		var message = message.text.trim();
		var newRegExpCalc = /^calc /;
		var newRegExpVariantion = /[^\d\s\(\-\*\)\+\/\.\,]/gi;
		var answer, textAnswer = null;
		if (newRegExpCalc.test(message)) {
			console.log(message);
			message = message.replace(newRegExpCalc, '');
			if (newRegExpVariantion.test(message)) {
				cb('err: not consistent message "' + message + '"');
			} else {
				try {
					var msgCopy = message.replace(/'\s'/g, '');
					answer = global['ev' + 'al'](msgCopy);
					textAnswer = message + ' = ' + answer;
					console.log('->' + textAnswer);
					cb(null, textAnswer);
				} catch (e) {}
			}
		}
	}
};