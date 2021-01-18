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

	getUrl: function(type, id = null) {
		var self = this;

		var currentTime = Math.floor(Date.now() / 1000);

		var url = self.config.apiBase;

		switch(type) {
			case "results":
				url += self.config.cupResultsEndpoint;
				url += "?cupid=" + id;
				break;

			case "events":
				url += self.config.eventsEndpoint;
				url += "?seasonid=" + self.config.seasonid;
				break;

			case "competitions":
				url += self.config.competitionsEndpoint;
				url += "?eventid=" + id;
				break;
		}

		return url;
	},

	getData: function(apis) {
		var self = this;

		var options = {
			method: 'GET'
		};

		var datas = [];

		var lastResults = Promise.all(self.config.cupid.map(function(cup) {
			return fetch(self.getUrl("results", cup), options);
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
		.then(function(result) {
			for(let i = 0; i < self.config.cupid.length; i++) {
				datas[i] = {};
				datas[i].results = result[i];
			}
		})
		.catch(function(error) {
			self.sendSocketNotification("ERROR", error);
		});

		if(self.config.showNextEvent) {

			lastResults
			.then(function() {
				return fetch(self.getUrl("events"), options);
			})
			.then(function(response) {
				if (response.ok) { 
					return response.json();
				} else {
					return Promise.reject(response.status + " HTTP error for " + response.url);
				}
			})
			.then(function(result) {
				for(let i = 0; i < self.config.cupid.length; i++) {
					datas[i].events = result.filter(event => moment(event.EndDate).endOf('day').isAfter(moment().endOf('day'))).filter(event => event.EventId.substr(0, 12) == self.config.cupid[i].substr(0, 12));
					self.config.eventid[i] = datas[i].events[0].EventId;
				}
			})
			.then(function() {
				return Promise.all(self.config.eventid.map(function(event) {
					return fetch(self.getUrl("competitions", event), options);
				}));
			})
			.then(function(responses) {
				return Promise.all(responses.map(function(response) {
					if (response.ok) { 
						return response.json();
					} else {
						return Promise.reject(response.status + " HTTP error for " + response.url);
					}
				}));
			})
			.then(function(result) {
				for(let i = 0; i < self.config.cupid.length; i++) {
					datas[i].competitions = result[i].filter(competition => moment(competition.StartTime).isAfter(moment())).filter(competition => competition.RaceId.substr(14, 2) == self.config.cupid[i].substr(14, 2));
				}
			})
			.then(function() {
				self.sendSocketNotification("DATA", datas);
			})
			.catch(function(error) {
				self.sendSocketNotification("ERROR", error);
			});

		} else {

			lastResults
			.then(function() {
				self.sendSocketNotification("DATA", datas);
			});

		}
		
	},

	socketNotificationReceived: function(notification, payload) {
		var self = this;

		if (notification === "CONFIG") {
			self.config = payload;
			self.sendSocketNotification("STARTED", true);
			self.getData();
		}
	}
});
