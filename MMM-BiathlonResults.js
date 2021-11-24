/* Magic Mirror
 * Module: MMM-BiathlonResults
 *
 * Magic Mirror By Michael Teeuw https://magicmirror.builders
 * MIT Licensed.
 *
 * Module MMM-BiathlonResults By Grena https://github.com/grenagit
 * MIT Licensed.
 */

Module.register("MMM-BiathlonResults", {

	// Default module config
	defaults: {
		cupid: [],
		seasonid: "2122",
		eventid: [],
		updateInterval: 60 * 60 * 1000, // 1 hour
		transitionInterval: 10 * 1000, // 10 seconds
		animationSpeed: 1000, // 1 second
		maximumEntries: 10,
		showTitle: true,
		showNextEvent: false,

		initialLoadDelay: 0, // 0 seconds delay
		retryDelay: 2500, // 2,5 seconds

		apiBase: "https://biathlonresults.com/",
		cupResultsEndpoint: "modules/sportapi/api/cupresults",
		eventsEndpoint: "modules/sportapi/api/events",
		competitionsEndpoint: "modules/sportapi/api/competitions",
	},

	// Define required styles
	getStyles: function() {
		return ["MMM-BiathlonResults.css", "font-awesome.css"];
	},

	// Define required scripts
	getScripts: function() {
		return ["moment.js"];
	},
	
	// Define start sequence
	start: function() {
		Log.info("Starting module: " + this.name);

		moment.updateLocale(config.language);

		this.resultsItems = [];
		this.activeItem = 0;
		this.timerTransition = null;
		this.timerUpdate = null;

		this.loaded = false;
		this.scheduleUpdate(this.config.initialLoadDelay);
	},

	// Override dom generator
	getDom: function() {
		var wrapper = document.createElement("div");

		if(this.config.cupid === []) {
			wrapper.innerHTML = "Please set the correct Biathlon <i>cupid</i> in the config for module: " + this.name + ".";
			wrapper.className = "dimmed light small";
			return wrapper;
		}

		if(!this.loaded) {
			wrapper.innerHTML = this.translate("LOADING");
			wrapper.className = "dimmed light small";
			return wrapper;
		}

		if(this.resultsItems[this.activeItem].results.length > 0) {

			if(this.config.showTitle) {
				var brTitle = document.createElement('div');
				brTitle.className = "dimmed light small title";
				brTitle.innerHTML = this.resultsItems[this.activeItem].title;

				wrapper.appendChild(brTitle);
			}

			var resultsWrapper = document.createElement("table");
			resultsWrapper.className = "small results";

			for(let i = 0; i < this.config.maximumEntries && i < this.resultsItems[this.activeItem].results.length; i++) {

				var resultWrapper = document.createElement("tr");
				resultWrapper.className = "normal";

				var rankWrapper = document.createElement("td");
				rankWrapper.className = "rank";
				rankWrapper.innerHTML = this.resultsItems[this.activeItem].results[i].Rank;

				resultWrapper.appendChild(rankWrapper);

				var nationWrapper = document.createElement("td");
				nationWrapper.className = "nation light";
				nationWrapper.innerHTML = this.resultsItems[this.activeItem].results[i].Nat.toLowerCase();

				resultWrapper.appendChild(nationWrapper);

				var nameWrapper = document.createElement("td");
				nameWrapper.className = "name bright";
				nameWrapper.innerHTML = this.resultsItems[this.activeItem].results[i].ShortName.toLowerCase();

				resultWrapper.appendChild(nameWrapper);

				var scoreWrapper = document.createElement("td");
				scoreWrapper.className = "score light";
				scoreWrapper.innerHTML = this.resultsItems[this.activeItem].results[i].Score;

				resultWrapper.appendChild(scoreWrapper);

				resultsWrapper.appendChild(resultWrapper);

			}

			wrapper.appendChild(resultsWrapper);
		
		}

		if(this.config.showNextEvent) {

			var brDescription = document.createElement('div');
			brDescription.className = "dimmed light small description";
			brDescription.innerHTML = this.resultsItems[this.activeItem].description;

			wrapper.appendChild(brDescription);
			
			var brLocation = document.createElement('div');
			brLocation.className = "light small location";

			var locationIcon = document.createElement('span');
			locationIcon.className = "fas fa-map-marker-alt dimmed";
			brLocation.appendChild(locationIcon);

			var spacer = document.createElement("span");
			spacer.innerHTML = "&nbsp;";
			brLocation.appendChild(spacer);

			var locationText = document.createElement("span");
			locationText.innerHTML = " " + this.resultsItems[this.activeItem].location;
			brLocation.appendChild(locationText);

			wrapper.appendChild(brLocation);

			var brDate = document.createElement('div');
			brDate.className = "light small date";

			var dateIcon = document.createElement('span');
			dateIcon.className = "fas fa-calendar-alt dimmed";
			brDate.appendChild(dateIcon);

			var spacer = document.createElement("span");
			spacer.innerHTML = "&nbsp;";
			brDate.appendChild(spacer);

			var dateText = document.createElement("span");
			dateText.innerHTML = " " + this.capFirst(moment(this.resultsItems[this.activeItem].start).fromNow());
			brDate.appendChild(dateText);

			wrapper.appendChild(brDate);

		}
		
		if(this.resultsItems[this.activeItem].finished) {

			var brDescription = document.createElement('div');
			brDescription.className = "dimmed light small description";
			brDescription.innerHTML = this.capFirst(this.resultsItems[this.activeItem].info.toLowerCase());

			wrapper.appendChild(brDescription);

		}

		return wrapper;
	},

	// Request new data from biathlonresults.com with node_helper
	socketNotificationReceived: function(notification, payload) {
		if(notification === "STARTED") {
			this.updateDom(this.config.animationSpeed);
		} else if(notification === "DATA") {
			this.processBR(payload);
		} else if(notification === "ERROR") {
			Log.error(this.name + ": Do not access to data (" + payload + ").");
		} else if(notification === "DEBUG") {
			Log.log(payload);
		}
	},
	
	// Use the received data to set the various values before update DOM
	processBR: function(data) {
		if(!data || typeof data[0].results === "undefined") {
			Log.error(this.name + ": Do not receive usable data.");
			return;
		}

		var resultsItems = [];

		for(let i = 0; i < data.length; i++) {
			var title = data[i].results.CupName + " (" + data[i].results.RaceCount + "/" + data[i].results.TotalRaces + ")";
			var info = data[i].results.CupInfo;
			var results = data[i].results.Rows;
			
			if(data[i].results.RaceCount < data[i].results.TotalRaces || data[i].results.Rows.length == 0) {
				var finished = false;
			} else {
				var finished = true;
			}
			
			if(this.config.showNextEvent) {
				if(typeof data[i].events === "undefined" || typeof data[i].competitions === "undefined") {
					Log.error(this.name + ": Do not receive usable data for next event (this information will be hidden).");
					this.config.showNextEvent = false;
				} else {
					var description = data[i].competitions[0].ShortDescription;
					var location = data[i].events[0].Organizer + " (" + data[i].events[0].NatLong + ")";
					var start = data[i].competitions[0].StartTime;
				}
			}

			resultsItems.push({"title": title, "info": info, "results": results, "description": description, "location": location, "start": start, "finished": finished});
		}

		this.resultsItems = resultsItems;

		this.loaded = true;
		this.updateDom(this.config.animationSpeed);
		this.scheduleTransition();
		this.scheduleUpdate();
	},

	// Schedule next transition
	scheduleTransition: function() {
		clearInterval(this.timerTransition);

		var self = this;
		this.timerTransition = setInterval(function() {
			self.activeItem++;
			if(self.activeItem >= self.resultsItems.length) {
				self.activeItem = 0;
			}

			self.updateDom(self.config.animationSpeed);
		}, this.config.transitionInterval);
	},

	// Schedule next upload
	scheduleUpdate: function(delay) {
		var nextLoad = this.config.updateInterval;
		if(typeof delay !== "undefined" && delay >= 0) {
			nextLoad = delay;
		}

		clearInterval(this.timerUpdate);

		var self = this;
		this.timerUpdate = setTimeout(function() {
			self.sendSocketNotification('CONFIG', self.config);
		}, nextLoad);
	},

	// Capitalize the first letter of a string
	capFirst: function (string) {
		return string.charAt(0).toUpperCase() + string.slice(1);
	}

});
