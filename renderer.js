'use strict'
// stuff to build window
const electron = require('electron');
// Module to control application life.
const app = electron.app;
// Module to create native browser window.
var remote = electron.remote;
const {BrowserWindow} = require('electron').remote;

// db stuff
const low = require('lowdb');
const storage = require('lowdb/lib/file-sync');
const db = low('auth.json');

// we need this to build the requests
var request = require('request')

// get the size of db entries
let hasAccessToken = db.get('access_token').size().value();
let hasProfileData = db.get('profile_data').size().value();

// get the access token from the db if hasAccessToken > 0
if(hasAccessToken > 0){
    // get the token and set it to a var
    var access_token = db.get('access_token').take(1).value();
    var trelloToken = access_token[0].access_token;
}

// Trello stuff
var Trello = require("node-trello");
const t = new Trello("f4c23306bf38a3ec4ca351f999ee05d3", trelloToken);

// Define the electrello app module
var electrello = angular.module('electrello', ['ngMaterial', 'ngMessages', 'ngRoute']).config(function($mdThemingProvider) {
  $mdThemingProvider.theme('default').dark()
    .primaryPalette('red', {'default':'400'})
    .accentPalette('yellow', {'default':'500'});
});

// set up some font icons
electrello.config(function($mdIconProvider) {
    $mdIconProvider
      .defaultIconSet('images/mdi.svg');
});

// route controller
electrello.config(function($routeProvider) {
    $routeProvider
    // route for the home page
    .when('/', {
        templateUrl : 'views/home.html',
        controller : 'AuthController',
        resolve : {
            "check" : function($location) {
                // if they've got an access token we're good
                if(hasAccessToken > 0) {
                    // Send em to the dashboard
                    $location.path('/dashboard');
                } else {
                    // redirect user to home to authorize their account
                    $location.path('/');
                }
            }
        }
    })
    .when('/dashboard', {
        templateUrl : 'views/dashboard.html',
        controller  : 'DashboardController',
        resolve : {
            "check" : function($location) {
                // if they've got an access token we're good
                if(hasAccessToken < 0) {
                    // Send em home to authorize
                    $location.path('/');
                } else {
                    // redirect user to dashboard
                    $location.path('/dashboard');
                }
            }
        }
    })
    .when('/profile', {
        templateUrl : 'views/profile.html',
        controller  : 'ProfileController',
        resolve : {
            "check" : function($location) {
                // if they've got an access token we're good
                if(hasAccessToken < 0) {
                    // Send em home to authorize
                    $location.path('/');
                } else {
                    // redirect user to dashboard
                    $location.path('/profile');
                }
            }
        }
    });
});

// factory to get board names
electrello.factory('BoardFactory', ['$http', function ($http, $scope) {
     var factory = {},
         boardIDs = [],
         board_data = [],
         board_info = [],
         board_names = [];

     // pass the profile info to the view
     board_data = db.get('profile_data').take(1).value();
     boardIDs = board_data[0].profile_data.idBoards;

     factory.get_board_data  = function (boardIDArray) {
       for(var i = 0; i < boardIDs.length; i++){
         t.get("/1/boards/" + boardIDs[i], function(err, data) {
           if (err) throw err;
           board_info = data;
           board_names.push(board_info['name']);
           return board_names;
        });
       };
     };
     return {
       get_board_data: factory.get_board_data,
       factory: factory
     }
 }]);

// dashboard controller
electrello.controller('DashboardController', function($scope, $rootScope, $route, $location, $window, $q, BoardFactory){
    var boardIDs = [],
        board_data = [],
        board_info = [],
        board_names = [];

    // pass the profile info to the view
    board_data = db.get('profile_data').take(1).value();
    boardIDs = board_data[0].profile_data.idBoards;
    
    // set the body class
    $rootScope.pageClass = 'dashboard';

    // $scope.board_array = BoardFactory.get_board_data();
    // console.log($scope.board_array);
    // $scope.board_array = electrello.factory.boardIDs;
    // console.log(BoardFactory.factory.board_array);

    // get data for boards
    $scope.get_board_data = function(boardIDArray) {
        for(var i = 0; i < boardIDs.length; i++){
            t.get("/1/boards/" + boardIDs[i], function(err, data) {
              if (err) throw err;
              board_info = data;
              board_names.push(board_info['name']);
              $scope.board_names = board_names;
              //console.log($scope.board_names);
              return $scope.board_names
            });
        }
    }

    $scope.board_array = $scope.get_board_data(boardIDs);
});

// menu controller
electrello.controller('MenuController', function($scope, $route, $routeParams, $location, $mdDialog, $window, $rootScope){
    // set the body class
    $rootScope.pageClass = 'dashboard';

    // handle the menu
    var originatorEv;
    $scope.openMenu = function($mdOpenMenu, ev) {
      originatorEv = ev;
      $mdOpenMenu(ev);
    }

    // show the profile data we got upon authorization
    $scope.show_profile = function() {
        $rootScope.pageClass = 'dashboard profile';
        $location.path('/profile');
    }

    // show the main dashboard
    $scope.show_main_dashboard = function() {
        $rootScope.pageClass = 'dashboard';
        $location.path('/dashboard');
    }

    // delete the tokens
    $scope.delete_token = function() {
      db.get('access_token').remove().value();
      console.log('deleted token');
    }

    // warn em of impending deleting
    $scope.showAlert = function(ev, alertType) {
        var confirm = $mdDialog.confirm()
            .parent(angular.element(document.querySelector('#popupContainer')))
            .clickOutsideToClose(true)
            .title('Are you absolutely sure about that?')
            .textContent('Once this is done, there is no going back. Only re-syncing your data.')
            .ariaLabel('Sure?')
            .ok('Make It so!')
            .cancel('Nevermind')
            .targetEvent();

        $mdDialog.show(confirm).then(function() {
          if(alertType === 'profile'){
              $scope.delete_profile_data();
          } else if (alertType === 'token') {
              $scope.delete_token();
          }
        }, function() {
          console.log('changed your mind, eh?');
        });
    };

    // delete profile data
    $scope.delete_profile_data = function() {
        db.get('profile_data').remove().value();
        console.log('deleted profile data');
    }
});

// profile data controller
electrello.controller('ProfileController', function ($scope) {
    // pass the profile info to the view
    var data = db.get('profile_data').take(1).value();
    $scope.profile_data = data[0].profile_data;
});

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let authWindow;

// this URL is set up by the node server we started up
const authUrl = 'http://127.0.0.1:6080/login';

// authorization stuffs
electrello.controller('AuthController', function($scope, $location, $route, $routeParams, $window, $rootScope){
    // set the body class
    $rootScope.pageClass = 'authorize';

    // authorize their app
    $scope.oAuthTokenRequest = function()
    {
        // make the auth window
        authWindow = new BrowserWindow({
            width: 360,
            height: 440,
            'webPreferences': {
              'nodeIntegration': true,
              'webSecurity': false
          },
          frame: false
        });

        // call the handleCallback function when we get response details back
        authWindow.webContents.on('did-get-response-details', function (originalURL, httpResponseCode, requestMethod, event, resourceType, newURL, referrer)
        {
          $scope.handleCallback(originalURL, httpResponseCode, requestMethod, event, resourceType, newURL, referrer);
        });

        // open the Trello auth page
        authWindow.loadURL(authUrl);
    }

    // this is fired when electron gets response data
    $scope.handleCallback = function(newURL, originalURL, httpResponseCode, requestMethod, event, resourceType, referrer)
    {
      // if the httpResponseCode matches the regex, kill the screen
      if (/^http:\/\/127\.0\.0\.1/.test(httpResponseCode)) {
          authWindow.destroy();

          // if we have the access_token send the user to the dashboard
          $window.location.reload();
      }
    }
});
