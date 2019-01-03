const express = require('express');
const request = require('request');
const bodyParser = require('body-parser');
const https = require('https');
const http = require('http');
const fs = require('fs');
const mongodb = require('mongodb').MongoClient;

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
const source = 'https://fhstp.academy';
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
const mongodbUrl = 'mongodb://localhost:27017';

const app = express();
const redirect = express();
const httpsServer = https.createServer(httpsOptions, app);
const httpServer = http.createServer(redirect);

let connection = null;

app.disable('x-powered-by');
app.use(bodyParser.raw({
	type: '*/*'
}));

redirect.all('*', (req, res) => {
	res.redirect('https://' + req.headers.host + req.headers.url);
});

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

	if (req.body instanceof Buffer) {
		requestObject.body = req.body;
		requestObject.headers['Content-Type'] = req.get('content-type');

		mongodb.connect(mongodbUrl, (err, client) => {
			if (err) {
				return console.log('Cannot establish mongodb connection. Got error: ', err);
			}

			const db = client.db('fhstp');
			let bodyString;

			try {
				bodyString = req.body.toString();
			} catch (e) {
				console.log('Cannot parse buffer');
			}

			db.collection('inputs').insertOne({
				body: bodyString
			});
		});
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

httpsServer.listen(443, err => {
	if (err) {
		return console.log('Cannot start https server. Got error: ', err);
	}
	console.log('HTTPS server running on port 443');
});

httpServer.listen(80, err => {
	if (err) {
		return console.log('Cannot start http server. Got error: ', err);
	}
	console.log('HTTP server running on port 80')
});

