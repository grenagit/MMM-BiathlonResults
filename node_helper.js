'use strict';

/* Magic Mirror
 * Module: MMM-MarineWeather
 *
 * Magic Mirror By Michael Teeuw https://magicmirror.builders
 * MIT Licensed.
 *
 * Module MMM-BiathlonResults By Grena https://github.com/grenagit
 * MIT Licensed.
 */

const NodeHelper = require('node_helper');
const fetch = require('node-fetch');

module.exports = NodeHelper.create({

	getUrl: function(type) {
		var self = this;

		var currentTime = Math.floor(Date.now() / 1000);

		var url = self.config.apiBase;

		switch(type) {
			case "results":
				url += self.config.cupResultsEndpoint;
				url += "?cupid=" + self.config.cupid;
				break;

			case "events":
				url += self.config.eventsEndpoint;
				url += "?seasonid=" + self.config.seasonid;
				break;

			case "competitions":
				url += self.config.competitions;
				url += "?eventid=" + self.config.competitionsid;
				break;
		}

		return url;
	},

	getData: function(apis) {
		var self = this;

		var options = {
			method: 'GET'
		};

		Promise.all(apis.map(function(api) {
			return fetch(self.getUrl(api), options);
		}))
		.then(function(responses) {
			return Promise.all(responses.map(function(response) {
				if (response.status === 200) {
					return response.json();
				} else {
					self.sendSocketNotification("ERROR", response.status);
				}
			}));
		})
		.then(function(result) {
			if(self.config.showNextEvent) {
				self.sendSocketNotification("DATA", {"results": result[0], "events": result[1]});
			} else {
				self.sendSocketNotification("DATA", {"results": result[0]});
			}
		});
	},

	socketNotificationReceived: function(notification, payload) {
		var self = this;

		if (notification === "CONFIG") {
			self.config = payload;
			self.sendSocketNotification("STARTED", true);
			if(self.config.showNextEvent) {
				self.getData(["results", "events"]);
			} else {
				self.getData(["results"]);
			}
		}
	}
});

