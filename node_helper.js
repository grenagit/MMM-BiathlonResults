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
const moment = require('moment');

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
				url += self.config.competitionsEndpoint;
				url += "?eventid=" + self.config.eventid;
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
				if (response.ok) { 
					return response.json();
				} else {
					return Promise.reject(response.status + " HTTP error for " + response.url);
				}
			}));
		})
		.catch(function(error) {
			self.sendSocketNotification("ERROR", error);
		})
		.then(function(result) {
			var lastResults = result[0];

			if(self.config.showNextEvent) {

				var nextEvents = result[1].filter(event => moment(event.EndDate).endOf('day').isAfter(moment().endOf('day'))).filter(event => event.EventId.substr(0, 12) == self.config.cupid.substr(0, 12));
				self.config.eventid = nextEvents[0].EventId;

				fetch(self.getUrl("competitions"), options)
				.then(function(response) {
					if (response.ok) {
						return response.json();
					} else {
						return Promise.reject(response.status + " HTTP error for " + response.url);
					}
				})
				.catch(function(error) {
					self.sendSocketNotification("ERROR", error);
					self.sendSocketNotification("DATA", {"results": lastResults});
				})
				.then(function(body) {
					var nextCompetitions = body.filter(competition => moment(competition.StartTime).isAfter(moment())).filter(competition => competition.RaceId.substr(14, 2) == self.config.cupid.substr(14, 2));

					self.sendSocketNotification("DATA", {"results": lastResults, "events": nextEvents, "competitions": nextCompetitions});
				})

			} else {
				self.sendSocketNotification("DATA", {"results": lastResults});
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
