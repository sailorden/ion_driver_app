
//Main module that everything is based off of
angular.module('starter', ['ionic','ionic.service.core', 'activeCtrl', 'agentService', 'runnerCtrl'])

.run(function($ionicPlatform, $ionicHistory, $window) {
  $ionicPlatform.ready(function() {
    var self = this;
    this.$window = $window;

    var push = new Ionic.Push({
      "debug": true
    });

    push.register(function(token){
      console.log('Device token', token.token);
      self.$window.localStorage['device_token'] = JSON.stringify(token.token);
      push.saveToken(token);
    });
  
    // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
    // for form inputs)
    if(window.cordova && window.cordova.plugins && window.cordova.plugins.Keyboard) {
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
    }
    if(window.StatusBar) {
      StatusBar.styleDefault();
    }
  });

  $ionicPlatform.registerBackButtonAction(function (event) {
    if ($ionicHistory.currentStateName() === 'assignmentsList' ) {
      event.preventDefault();
    } else if ($ionicHistory.currentStateName() === 'activeAssignment') {
      event.preventDefault();
    } else if ($ionicHistory.currentStateName() === 'activeRunnerAssignment') {
      event.preventDefault();
    } else {
      $ionicHistory.goBack();
    }
  }, 101);

})

.controller('assignmentsListController', AssignmentsCtrl)
.controller('logInCtrl', LogInCtrl)

//routing for different views in driverApp
.config(function($compileProvider, $stateProvider, $urlRouterProvider, $httpProvider) {
  $stateProvider
    .state('assignmentsList', {
      url: '/list',
      controller: 'assignmentsListController as assignmentsCtrl',
      templateUrl: 'assignmentsList.html'
    })
    .state('logIn', {
      url: '/logIn',
      controller: 'logInCtrl as logInCtrl',
      templateUrl: 'logIn.html'
    })
    .state('activeAssignment', {
      url: '/activeAssignment',
      controller: 'activeCtrl as activeCtrl',
      templateUrl: 'activeAssignment.html'
    })
    .state('selectedOrder', {
      url: '/selectedOrder',
      controller: 'activeCtrl as activeCtrl',
      templateUrl: 'selectedOrder.html'
    })
    .state('selectedAssignment', {
      url: '/selectedAssignment',
      controller: 'assignmentsListController as assignmentsCtrl',
      templateUrl: 'selectedAssignment.html'
    })
    .state('selectedRunnerAssignment', {
      url: '/selectedRunnerAssignment',
      controller: 'assignmentsListController as assignmentsCtrl',
      templateUrl: 'selectedRunnerAssignment.html'
    })
    .state('activeRunnerAssignment', {
      url: '/activeRunnerAssignment',
      controller: 'runnerCtrl as runnerCtrl',
      templateUrl: 'activeRunnerAssignment.html'
    })
    .state('selectedRunnerOrder', {
      url: '/selectedRunnerOrder',
      controller: 'runnerCtrl as runnerCtrl',
      templateUrl: 'selectedRunnerOrder.html'
    });
  $urlRouterProvider.otherwise('/logIn');
  $compileProvider.aHrefSanitizationWhitelist(/^\s*(geo|mailto|tel|maps):/);
});


////////////////////////////////Controller for the assignmentsList views///////////////////////
function AssignmentsCtrl (agentService, $ionicSideMenuDelegate, $state, $ionicListDelegate, $scope, $ionicPopup, $timeout) {
  this.$ionicListDelegate = $ionicListDelegate;
  this.$ionicSideMenuDelegate = $ionicSideMenuDelegate;
  this.$scope = $scope;
  this.agentService = agentService;
  //this.$ionicHistory = $ionicHistory;
  this.$state = $state;
  this.$ionicPopup = $ionicPopup;
  this.$timeout = $timeout;
  var self = this;

  if (this.agentService.activeAssignment){
    this.agentService.getAssignments().then(function(result){
      return result;
    }, function(err) {
      self.makePopup('Connection Error', "Please check your internet connection", "alert")
    });
  }


  /*if(!this.agentService.selectedAssignment){
    console.log('this happened');
    this.$ionicHistory.nextViewOptions({
      disableBack: true
    });
  } else {
    this.$ionicHistory.nextViewOptions({
      disableBack: false
    });
  }*/

}

/**
 * Allows user to swipe to see sideMenu or not
 * @returns{Boolean}
 */
AssignmentsCtrl.prototype.enableSideMenu = function () {
  if (this.$state.is('logIn')) {
    return false;
  } else {
    return true;
  }
};

/**Shows or hides side menu */
AssignmentsCtrl.prototype.toggleSideMenu = function () {
  this.$ionicSideMenuDelegate.toggleLeft();
};

/**Tells server if user is on duty or off */
//Needs to either try logging in again or get clusters again if cancel
AssignmentsCtrl.prototype.toggleDuty = function () {
  var self = this;
  this.agentService.resolveStatuses().then(function(result) {
    self.toggleSideMenu();
    return result;
  }, function(err) {
    self.makePopup('On/Off Duty Error', "Sorry something went wrong. Would you like to try again?", "confirm").then(function(result) {
      if (result) {
        self.toggleDuty();
      } else {
        self.agentService.getStatus().then(function(result) {
          return result;
        }, function(err) {
          self.makePopup("Connection Error", "Can't connect to the server. Please check your internet connection", "alert");
        });
      }
    })
  });
};

/**
 * When a user clicks on an assignment for more details the view changes
 * @param{Object} assignment - An assignment for a driver
 */
AssignmentsCtrl.prototype.selectAssignment = function (assignment) {
    this.agentService.selectedAssignment = assignment;
    if (assignment.type == "runner"){
      this.$state.go('selectedRunnerAssignment');
    } else {
      this.$state.go('selectedAssignment');
    } 
};

/**
 *Tells the server that a user is taking an assignment
 */
AssignmentsCtrl.prototype.acceptAssignment = function () {
  var self = this;
  var assignmentId = this.agentService.selectedAssignment.id;

  if (this.agentService.selectedAssignment.type == "runner") {
    console.log('this runner block was called');
    this.agentService.acceptRunnerAssignment(assignmentId).then(function(result) {
      self.agentService.getRunnerAssignments();
      self.agentService.selectAssignment = undefined;
      self.$ionicListDelegate.closeOptionButtons();
      self.$state.go('activeRunnerAssignment');
    }, function(err) {
      self.makePopup("Error", "Unable to accept assignment", "alert")
    });
  } else {
    console.log('this driver block was called');
    this.agentService.assignmentAction(assignmentId, 'accept/').then(function(results) {
      self.agentService.getAssignments().then(function(result) {
        self.agentService.selectedAssignment = undefined;
        self.$ionicListDelegate.closeOptionButtons();
        self.$state.go('activeAssignment');
      }, function(err) {
        self.agentService.resetApp()
      });
    }, function(err) {
      self.makePopup("Error", "Unable to accept assignment", "alert");
    });
  }
};

AssignmentsCtrl.prototype.refreshList = function () {
  this.agentService.getAssignments();
  this.agentService.getRunnerAssignments();
  this.$scope.$broadcast('scroll.refreshComplete');
  this.$scope.$apply();
};

AssignmentsCtrl.prototype.makePopup = function (title, desc, type) {
  var alertPopup = this.$ionicPopup[type]({
    title: title || "Error",
    template: desc || "",
  });

  return alertPopup;
};


////////////////////////////////////Controller for the logInView///////////////////////////
function LogInCtrl (agentService, $window, $state, $ionicLoading, $ionicPlatform, $ionicPopup, $timeout) {
  this.agentService = agentService;
  this.$state = $state;
  this.$timeout = $timeout;
  this.$window = $window;
  this.$ionicLoading = $ionicLoading;
  this.$ioicPlatform = $ionicPlatform;
  this.$ionicPopup = $ionicPopup;
  var self = this;

  this.deploy = new Ionic.Deploy();

  //Sets channel for testing or production
  this.deploy.setChannel('dev');

  this.deploy.check().then(function(hasUpdate) {
    if (hasUpdate) {
      self.$ionicLoading.show({
        template: "Updating.."
      });
      self.deploy.update().then(function(deployResult) {
        self.$ionicLoading.hide();
      }, function(deployUpdateError) {
        self.$ionicLoading.hide();
        // fired if we're unable to check for updates or if any 
        // errors have occured.
      }, function(deployProgress) {
        // this is a progress callback, so it will be called a lot
        // deployProgress will be an Integer representing the current
        // completion percentage.
      });
    }
  });

  //Checks to see if the user has already been authenticated in the past
  if ($window.localStorage['configObj'] && $window.localStorage['device_token']) {
    this.agentService.configObj = JSON.parse($window.localStorage.getItem('configObj'));
    this.agentService.getInitialInformation().then(function(results) {
      self.$state.go('assignmentsList');
    }, function(err) {
      err = err || "";
      $window.localStorage.clear();
      self.showAlert('Sorry something went wrong. Please try logging in again', err.statusText);
    });
  }

  this.logInField = {
    email : '',
    password: ''
  };
}


/**
 * Passes email and password to server
 */
LogInCtrl.prototype.logIn = function () {
  var self = this;

  this.logInField['device_token'] = JSON.parse(this.$window.localStorage.getItem("device_token")) || "";

  this.agentService.logIn(this.logInField).then(function(results) {
    self.agentService.getInitialInformation().then(function(results) {
      self.$state.go('assignmentsList');
    }, function(err) {
      err = err || "";
      console.log('err at getInitialInformation', err);
      self.showAlert('Sorry log in failed. Please try again!', err. statusText);
    });
  }, function(err){
    err = err || "";
    console.log('err at logIn', err);
    self.showAlert("Sorry log in failed. Please try again!", err.statusText);
  });
};

/**
 * Checks to see if an update is available
 */
LogInCtrl.prototype.getUpdate = function () {
  var self = this;
  this.$loading.show({
    template: "Updating.."
  });
  this.deploy.update().then(function(res) {
    self.$loading.hide();
  }, function (err){
    self.$loading.hide();
  });
};

/**
 * Displays a popup with a message then closes after 3 seconds
 * @Params{String} - message
 */
LogInCtrl.prototype.showAlert = function (title, message) {
  var alertPopup = this.$ionicPopup.alert({
    title: title,
    template: message
  });

  this.$timeout(function(){
    alertPopup.close();
  }, 4000);
};