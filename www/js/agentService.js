


angular.module('agentService',['ionic'])
	.service('agentService', AgentService);

//Service for logging in, getting assignments, updating, etc.
function AgentService ($http, $q, $state, $interval, $window, $ionicLoading) {
  this.$q = $q;
  this.$http = $http;
  this.$state = $state;
  this.$interval = $interval;
  this.$window = $window;
  this.$ionicLoading = $ionicLoading;
  this.hostUrl = 'https://menu.me/';
  this.rootUrl = this.hostUrl + 'foodcannon/non-fleet/agent/';
  
  this.auth = "Token BC04DM5Q-Qjlzk9SrtoZRCcRvbYYsomuVUuqzO8yHi3vl9jS7sKhBd3bRTl7ELhKwmrfpXeqXQQZC";

  this.runnerAssignments = [];

  this.onduty = false;

  this.clusters = [];

  this.assignments = [];

  this.selectedAssignment;

  this.selectedOrder;

  this.activeAssignment;

  this.orderGottenIds = [];

  this.allTasksComplete = false;

  this.intervalCheck;

  this.timeStamp = '';

  this.configObj = {
    headers: {
      "Authorization": this.auth,
      "Content-Type": 'text/plain'}
  };

  this.currentLocation;


  //Config object for the loading screen
  this.ionicLoadingConfig = {
    content: 'Loading',
    animation: 'fade-in',
    showBackdrop: true,
    maxWidith: 200,
    showDelay: 0
  };

}

/**
 * If an error or something goes wrong reset the app
 */
AgentService.prototype.resetApp = function () {
  this.onduty = false;
  this.clusters = [];
  this.assignments = [];
  this.runnerAssignments = [];
  this.selectedAssignment = undefined;
  this.selectedOrder = undefined;
  this.activeAssignment = undefined;
  this.orderGottenIds = [];
  this.allTasksComplete = false;
  this.intervalCheck = undefined;
  this.currentLocation = undefined;
  this.timeStamp = '';
  this.$state.go('assignmentsList')
};

/**
 * Passes user email and password to server
 * @param{object} logInInfo - An object wih user log-in information
 * @returns{Promise<Object>}
 */
AgentService.prototype.logIn = function (logInInfo) {
  var self= this;
  var logInUrl = 'api/1/auth/';

  this.$ionicLoading.show(this.ionicLoadingConfig);

  return this.$http.post(this.hostUrl + logInUrl, logInInfo, this.configObj).then(function(results){
    self.configObj.headers['Bearer'] = results.data.auth_token;
    self.$window.localStorage['configObj'] = JSON.stringify(self.configObj);
    self.$ionicLoading.hide();
    return results;
  },function(err){
    console.log('err at logInService', err);
    self.$ionicLoading.hide();
    return self.$q.reject(err);
  });

};

/**
 * Gets all assignments for current onDuty location
 * @returns {Promise<Object>}
 */
AgentService.prototype.getAssignments = function () {
  var self = this;

  return this.$http.get(this.rootUrl + 'tasks/', this.configObj).then(function(results) {
    console.log('getDriverAssignments', results);
    self.assignments = results.data.assignments;
    self.checkForActive(self.assignments);
    return results;
  }, function(err) {
    console.log('err at assignmentsService', err);
    self.resetApp();
    return self.$q.reject(err);
  });
};


/**
 * Checks to see if agent is on-duty
 * @returns {Promise<Object>}
 */
AgentService.prototype.getStatus = function () {
  var self = this;

  return this.$http.get(this.rootUrl + 'status/', this.configObj).then(function(results) {
    self.clusters = results.data.groups;
    if (self.checkForOnDuty()) {
      self.startIntervalCheck();
    }
    return results;
  }, function(err) {
    console.log('err at getStatus', err);
    self.resetApp();
    return self.$q.reject(err);
  });
};

/**
 * Resolves whether or not an agent is on duty
 */
AgentService.prototype.resolveStatuses = function () {
  var statusArray= [];
  var self = this;

  for (var i in this.clusters) {
    statusArray.push(this.postStatus(this.clusters[i]));
  }

  this.$q.all(statusArray).then(function(results){
    if (self.checkForOnDuty()) {
      self.startIntervalCheck();
      self.getAssignments();
      self.getRunnerAssignments();
    } else {
      self.stopIntervalCheck();
      self.assignments = [];
      self.runnerAssignments = [];
    }
  })
};

/**
 * Tells the server to go on-duty or off-duty
 * @param {object} cluster - A cluster of hotels
 * @returns {Promise<object>}
 */
AgentService.prototype.postStatus = function (cluster) {
  var self = this;
  var groupId = cluster.id;
  var on_duty = cluster.on_duty
  var emptyData = {};

  return this.$http.post(this.rootUrl + groupId + '/' + on_duty + '/', emptyData, this.configObj).then(function(results){
    return results;
  }, function(err){
    console.log('err at postStatus', err);
    self.resetApp();
    return self.$q.reject(err);
  });

};

/**
* Checks to see if user currently has an active assignment
* @params{Array} - assignments
*/
AgentService.prototype.checkForActive = function (assignments) {
  console.log('assignments', assignments);
	if (assignments[0]) {
    for (var i = 0; i < assignments.length; i++) {
      if (assignments[i].active && assignments[i].type == 'driver') {
        this.activeAssignment = assignments[i];
        console.log('activeDriver', this.assignments[i]);
        this.$state.go('activeAssignment');
      } else if (assignments[i].active && assignments[i].type == 'runner') {
        this.activeAssignment = this.assignments[i];
        console.log('activeRunner', this.assignments[i]);
        this.$state.go('activeRunnerAssignment');
      }
    }
	}
};

/**
 * Checks to see if the agent is currently on duty
 * @returns {Boolean}
 */
AgentService.prototype.checkForOnDuty = function () {
	for (var i in this.clusters) {
		if (this.clusters[i].on_duty) {
			return true;
		}
	}
	return false;
};

/**
* Gets the user's current location
*/
AgentService.prototype.getLocation = function () {
  var self = this;
  navigator.geolocation.getCurrentPosition(function(position){
    self.currentLocation = position;
  })
};

/**
 * Asks server if the UI needs to be updated
 * @returns{Promise<Object>}
 */
AgentService.prototype.checkForChanges = function () {
	var self = this;
	var updateObj = {
		lat: "",
		lng: "",
		update: this.timeStamp
	};

  updateObj.device_token = this.$window.localStorage.getItem("ionic_io_push_token") ? JSON.parse(this.$window.localStorage.getItem("ionic_io_push_token")).token : "";

  if (this.currentLocation) {
    updateObj['lat'] = this.currentLocation.coords.latitude;
    updateObj['lng'] = this.currentLocation.coords.longitude;
  }

	return this.$http.post(this.rootUrl + 'checkin/', updateObj, this.configObj).then(function(result){
		self.timeStamp = result.data.update;
		if (result.data.refresh) {
			self.getAssignments();
      self.getRunnerAssignments();
		}
	}, function(err){
    console.log('err at checkForChanges', err);
    self.resetApp();
    return self.$q.reject(err);
  });
};

/**
 * Calls checkForChanges() every 15 seconds when user is on-duty
 */
AgentService.prototype.startIntervalCheck = function () {
	var self = this;

  this.onDuty = true;

	if (angular.isDefined(this.intervalCheck)){
		return;
	}

	this.intervalCheck = this.$interval(function(){
    self.getLocation();
		self.checkForChanges();
	}, 15000);
};

/** 
* Stops calling checkForChanges when user goes off-duty
*/
AgentService.prototype.stopIntervalCheck = function () {

  this.onDuty = false;

	if (angular.isDefined(this.intervalCheck)) {
		this.$interval.cancel(this.intervalCheck);
		this.intervalCheck = undefined;
	}
};

/**
 * General function for making a change to an assignment, ex. "Got it", "arriving", "complete"
 * @param{Number} assignmentId
 * @param{String} action
 * @returns{Promise{Object}}
 */
AgentService.prototype.assignmentAction = function (assignmentId, action) {
  var self = this;
	var emptyObj = {};

  this.$ionicLoading.show(this.ionicLoadingConfig);
	return this.$http.post(this.rootUrl + 'assignments/' + action + assignmentId + '/', emptyObj, this.configObj).then(function(results){
		self.$ionicLoading.hide();
		return results;
	}, function(err){
    console.log('err at assignmentAction', err);
    self.$ionicLoading.hide();
    self.resetApp();
    return self.$q.reject(err);
  });
};

/**
* Posts to server when all orders for a task have been "got"
* @param{Number} taskId
* @returns{Promise<Object>}
*/
AgentService.prototype.taskComplete = function (taskId) {
  var emptyObj = {};
  var self = this;

  return this.$http.post(this.rootUrl + 'tasks/complete/' + taskId + '/', emptyObj, this.configObj).then(function(results){
    return results;
  },function(err){
    console.log('err at taskComplete', err);
    self.resetApp();
    return self.$q.reject(err);
  });
};


////////////////////////////////////// Runnner Stuff /////////////////////////////


AgentService.prototype.getRunnerAssignments = function () {
  var self = this;
  return this.$http.get(this.rootUrl + 'runner_assignments/', this.configObj).then(function(results){
    console.log('getRunnerAssingments', results);
    self.runnerAssignments = results.data.runner_assignments;
    self.checkForActive(self.runnerAssignments);
    return results;
  }, function(err){
    console.log('err at assignmentsService', err);
    self.resetApp();
    return self.$q.reject(err);
  });
};

AgentService.prototype.acceptRunnerAssignment = function (id) {
  var self = this;
  var emptyObj = {};

  this.$ionicLoading.show(this.ionicLoadingConfig);
  return this.$http.post(this.rootUrl + 'runner_assignments/accept/' + id + '/',emptyObj, this.configObj).then(function(results) {
    self.$ionicLoading.hide();
    return results;
  }, function(err) {
    console.log('err at acceptRunnerAssignment', err);
    self.$ionicLoading.hide();
    self.resetApp();
    return self.$q.reject(err);
  });
};

AgentService.prototype.completeRunnerAssignment = function (id) {
  var self = this;
  var emptyObj = {}

  this.$ionicLoading.show(this.ionicLoadingConfig);
  return this.$http.post(this.rootUrl + 'runner_assignments/complete/' + id + '/',emptyObj, this.configObj).then(function(results) {
    self.$ionicLoading.hide();
    return results;
  }, function(err) {
    console.log('err at completeRunnerAssignment', err);
    self.$ionicLoading.hide();
    self.resetApp();
    return self.$q.reject(err);
  });
};