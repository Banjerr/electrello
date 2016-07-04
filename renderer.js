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
var db = low('auth.json');

// Trello stuff
var Trello = require("node-trello");

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
    });
});

// board controller
electrello.controller('BoardController', BoardController);

var BoardController = function() {

}

electrello.controller('DashboardController', function($scope, $route, $routeParams, $location, $mdDialog){
    // set the body class
    $scope.pageClass = 'dashboard';

    // handle the menu
    var originatorEv;
    $scope.openMenu = function($mdOpenMenu, ev) {
      originatorEv = ev;
      $mdOpenMenu(ev);
    };

    // delete the tokens
    $scope.delete_token = function() {
      db.get('access_token').remove().value();
      console.log('deleted token');
    }

    // delete profile data
    $scope.delete_profile_data = function() {
        db.get('profile_data').remove().value();
        console.log('deleted profile data');
    }
});

// profile data controller
electrello.controller('ProfileController', ['$scope', function ($scope) {
    if(hasAccessToken > 0){
        $scope.get_profile_data = function(){
            // make a get request to get user info
            request.get({
                url: 'https://api.trello.com/1/members/me?fields=username,fullName,url&boards=all&board_fields=name&organizations=all&organization_fields=displayName&key=f4c23306bf38a3ec4ca351f999ee05d3&token=' + trelloToken
                },
                    function (error, response, body)
                    {
                        if (!error && response.statusCode == 200)
                        {
                            console.log(body);
                            bio_data = JSON.parse(body);
                            db.get('profile_data').push({
                              profile_data: bio_data
                            }).value();
                        }

                        if (error)
                        {
                            console.log('somethin goofed');
                            console.log(error);
                        }
                    }
            );
        }
    }
}]);

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let authWindow;

// this URL is set up by the node server we started up
const authUrl = 'http://127.0.0.1:6080/login';

// authorization stuffs
electrello.controller('AuthController', function($scope, $location, $route, $routeParams, $window){
    // set the body class
    $scope.pageClass = 'authorize';

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
