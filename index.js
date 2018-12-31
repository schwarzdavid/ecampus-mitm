const express = require('express');
const request = require('request');
const bodyParser = require('body-parser');
const https = require('https');
const fs = require('fs');

const requestHeaders = [
	'pragma',
	'cache-control',
	'user-agent',
	'content-type',
	'accept',
	'accept-language',
	'cookie'
];
const httpsOptions = {
	cert: fs.readFileSync("C:\\Users\\schwa\\.ssl\\localhost.crt"),
	key: fs.readFileSync("C:\\Users\\schwa\\.ssl\\localhost.key")
};
const target = new URL('https://ecampus.fhstp.ac.at');
const source = 'https://localhost:3006';
const replace = [
	{
		from: /https:\/\/ecampus.fhstp.ac.at/gi,
		to: source
	},
	{
		from: /https:\\\/\\\/ecampus.fhstp.ac.at/gi,
		to: 'https:\\/\\/localhost:3006'
	}
];

const app = express();
const server = https.createServer(httpsOptions, app);

app.disable('x-powered-by');
app.use(bodyParser.raw({
	type: '*/*'
}));

app.all('*', (req, res) => {
	const referer = target.toString() + req.originalUrl;
	const requestObject = {
		uri: referer,
		method: req.method,
		headers: {
			Host: target.host,
			Origin: target.origin,
			Referer: referer
		}
	};

	for (const i in req.headers) {
		if (requestHeaders.indexOf(i.toLowerCase()) >= 0) {
			requestObject.headers[i] = req.headers[i];
		}
	}

	if(req.body instanceof Buffer){
		requestObject.body = req.body;
		requestObject.headers['Content-Type'] = req.get('content-type');
	}

	return request(requestObject, (err, response, body) => {
		if (err) {
			console.log('Some error happened', err);
			return res.status(500).send(err);
		}

		res.status(response.statusCode);
		res.set(response.headers);

		const locationHeader = res.get('location');
		if (locationHeader) {
			res.set('location', locationHeader.replace(replace[0].from, replace[0].to));
		}

		let output = body;

		replace.forEach(obj => {
			output = output.replace(obj.from, obj.to);
		});

		return res.send(output);
	});
});

server.listen(3006, err => {
	if (err) {
		return console.log('Cannot start webserver. Got error: ', err);
	}
	console.log('Server running on port 3006');
});
