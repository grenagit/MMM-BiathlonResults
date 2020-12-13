/* Magic Mirror
 * Module: MMM-BiathlonResults
 *
 * Magic Mirror By Michael Teeuw https://magicmirror.builders
 * MIT Licensed.
 *
 * Module MMM-BiathlonResults By Grena https://github.com/grenagit
 * MIT Licensed.
 */

Module.register("MMM-BiathlonResults",{

	// Default module config
	defaults: {
		cupid: "",
		seasonid: "2021",
		eventid: "",
		updateInterval: 60 * 60 * 1000, // 1 hour
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
	getStyles: function () {
		return ["MMM-BiathlonResults.css", "font-awesome.css"];
	},

	// Define required scripts
	getScripts: function () {
		return ["moment.js"];
	},

	// Define required translations
	getTranslations: function() {
		return {
			de: "translations/de.json",
			en: "translations/en.json",
			es: "translations/es.json",
			fr: "translations/fr.json",
		}
	},

	// Define start sequence
	start: function() {
		Log.info("Starting module: " + this.name);

		moment.updateLocale(config.language);

		this.title = null;
		this.results = [];
		this.events = [];
		this.description = null;
		this.location = null;
		this.start = null;
		this.end = null;

		this.loaded = false;
		this.scheduleUpdate(this.config.initialLoadDelay);
	},

	// Override dom generator
	getDom: function() {
		var wrapper = document.createElement("div");

		if (this.config.cupid === "") {
			wrapper.innerHTML = "Please set the correct Biathlon <i>cupid</i> in the config for module: " + this.name + ".";
			wrapper.className = "dimmed light small";
			return wrapper;
		}

		if (!this.loaded) {
			wrapper.innerHTML = this.translate("LOADING");
			wrapper.className = "dimmed light small";
			return wrapper;
		}

		if(this.config.showTitle) {
			var brTitle = document.createElement('div');
			brTitle.className = "dimmed light small title";
			brTitle.innerHTML = this.title;

			wrapper.appendChild(brTitle);
		}

		var resultsWrapper = document.createElement("table");
		resultsWrapper.className = "small results";

		for (let i = 0; (i < this.config.maximumEntries && i < this.results.length); i++) {

			var resultWrapper = document.createElement("tr");
			resultWrapper.className = "normal";

			var rankWrapper = document.createElement("td");
			rankWrapper.className = "rank";
			rankWrapper.innerHTML = this.results[i].Rank;

			resultWrapper.appendChild(rankWrapper);

			var nationWrapper = document.createElement("td");
			nationWrapper.className = "nation light";
			nationWrapper.innerHTML = this.results[i].Nat.toLowerCase();

			resultWrapper.appendChild(nationWrapper);

			var nameWrapper = document.createElement("td");
			nameWrapper.className = "name bright";
			nameWrapper.innerHTML = this.results[i].ShortName.toLowerCase();

			resultWrapper.appendChild(nameWrapper);

			var scoreWrapper = document.createElement("td");
			scoreWrapper.className = "score light";
			scoreWrapper.innerHTML = this.results[i].Score;

			resultWrapper.appendChild(scoreWrapper);

			resultsWrapper.appendChild(resultWrapper);

		}

		wrapper.appendChild(resultsWrapper);

		if(this.config.showNextEvent) {

			var brDescription = document.createElement('div');
			brDescription.className = "dimmed light small description";
			brDescription.innerHTML = this.description;

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
			locationText.innerHTML = " " + this.location;
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
			if(moment(this.start).isAfter(moment())) {
				dateText.innerHTML = " " + this.translate("STARTED") + " " + moment(this.start).fromNow();
			} else {
				dateText.innerHTML = " " + this.translate("ENDED") + " " + moment(this.end).fromNow();
			}
			brDate.appendChild(dateText);

			wrapper.appendChild(brDate);

		}

		return wrapper;
	},

	// Request new data from biathlonresults.com with node_helper
	socketNotificationReceived: function(notification, payload) {
		if (notification === "STARTED") {
			this.updateDom(this.config.animationSpeed);
		} else if (notification === "DATA") {
			this.processBR(payload);
		} else if (notification === "ERROR") {
			Log.error(this.name + ": Do not access to data (" + payload + " HTTP error).");
		} else if (notification === "DEBUG") {
			Log.error(this.name + " (debug): " + payload);
		}
	},

	// Use the received data to set the various values before update DOM
	processBR: function(data) {
		if (!data || typeof data.results === "undefined") {
			Log.error(this.name + ": Do not receive usable data.");
			return;
		}

		this.title = data.results.CupName + " (" + data.results.RaceCount + "/" + data.results.TotalRaces + ")";
		this.results = data.results.Rows;

		if(this.config.showNextEvent) {
			this.events = data.events.filter(event => moment(event.EndDate).isAfter(moment())).filter(event => event.EventId.includes(this.config.cupid.split("__")[0]));

			this.description = this.events[0].Description;
			this.location = this.events[0].Organizer + " (" + this.events[0].NatLong + ")";
			this.start = this.events[0].StartDate;
			this.end = this.events[0].EndDate;
		}

		this.loaded = true;
		this.updateDom(this.config.animationSpeed);
		this.scheduleUpdate();
	},

	// Schedule next update
	scheduleUpdate: function(delay) {
		var nextLoad = this.config.updateInterval;
		if (typeof delay !== "undefined" && delay >= 0) {
			nextLoad = delay;
		}

		var self = this;
		setTimeout(function() {
			self.sendSocketNotification('CONFIG', self.config);
		}, nextLoad);
	},

	// Comparator proxy to compare two tasks by created date in ascending order
	sortByCreated: function(taskA, taskB) {
		return moment(taskA.created).diff(moment(taskB.created));
	}

});
