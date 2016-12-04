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
const PouchDB = require('pouchdb');
const boardDB = new PouchDB('board_db');

// we need this to build the requests
var request = require('request')

// underscore
const _ = require('underscore');

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
var electrello = angular.module('electrello', ['ngMaterial', 'ngMessages', 'ngRoute', 'ngResource', 'dndLists']).config(function($mdThemingProvider) {
  $mdThemingProvider.theme('default').dark()
    .primaryPalette('red', {'default':'400'})
    .accentPalette('yellow', {'default':'500'});
});

// set up some font icons
electrello.config(function($mdIconProvider) {
    $mdIconProvider
      .defaultIconSet('images/mdi.svg');
});

electrello.config(['$resourceProvider', function($resourceProvider) {
  // Don't strip trailing slashes from calculated URLs
  $resourceProvider.defaults.stripTrailingSlashes = false;
}]);

// filter to check to see if the object is empty
electrello.filter('isEmpty', [function() {
  return function(object) {
    //return angular.equals({}, object);
    return Object.keys(object).length === 0;
  }
}]);

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
    })
    .when('/board/:boardID', {
        templateUrl : 'views/board.html',
        controller  : 'BoardController'
    });
});

// dashboard controller
electrello.controller('DashboardController', function($scope, $rootScope, $route, $location, $window, $mdDialog){
    // get the updated list of boards
    let num_of_boards = db.get('board_names').size().value();
    $scope.board_names = db.get('board_names').take(num_of_boards).value();

    // show a board
    $scope.show_this_board = function( boardID ) {
        $rootScope.pageClass = 'board';
        $location.path('/board/' + boardID);
    }

    // setting up some resources
    // var Board = $resource('https://api.trello.com/1/boards/:board_id',
    //     {board_id: @board, key: f4c23306bf38a3ec4ca351f999ee05d3, token: @token}, {
    //
    //     });

    // warn em before deleting anything
    $scope.showAlert = function(ev, boardID) {
        var confirm = $mdDialog.confirm()
            .parent(angular.element(document.querySelector('#popupContainer')))
            .clickOutsideToClose(true)
            .title('Absolutely, positively, positive about that?')
            .textContent('This will instantly mark the board as closed.')
            .ariaLabel('Sure?')
            .ok('Make It so!')
            .cancel('Nevermind')
            .targetEvent();

        $mdDialog.show(confirm).then(function() {
            $scope.close_board(boardID);
        }, function() {
            console.log('changed your mind, eh?');
        });
    };

    // mark the board as closed
    $scope.close_board = function(boardID) {
        t.put("/1/boards/" + boardID + '/closed', { value: "true" }, function(err, data) {
          if (err) throw err;
          console.log(data);
        });
    }
});

// board controller
electrello.controller('BoardController', function($scope, $route, $routeParams, $location, $mdDialog, $window, $rootScope){
  // get the id from the route
  let boardID = $routeParams.boardID;
  $scope.board_data = [];
  $scope.board_lists = [];
  $scope.list_cards = [];
  $scope.masterListObject = {};

  // get some board data
  let get_board_data = function( boardID ) {
    t.get("/1/boards/" + boardID, function(err, data) {
      if (err) throw err;
      $scope.board_data = data;

      // set the background
      if ( data.prefs.backgroundColor != null ) {
        $rootScope.board_background_color = data.prefs.backgroundColor;
      }

      if ( data.prefs.backgroundImage != null ) {
        $rootScope.board_background_image = data.prefs.backgroundImage;
      }

      // apply it to the scopes
      $scope.$apply();
      $rootScope.$apply();
    });
  }
  get_board_data( boardID );

  // get lists
  let get_board_lists = function( boardID ) {
    t.get("/1/boards/" + boardID + "/lists", function(err, data) {
      if (err) throw err;
      $scope.board_lists = data;

      // build an object that the dragndrop directive handles better
      if ( $scope.board_lists ) {
        $scope.masterListObject = data;
      }

      get_list_cards( boardID );

      $scope.$apply();
    });
  }
  get_board_lists( boardID );

  // get cards
  let get_list_cards = function( boardID ) {
    t.get("/1/boards/" + boardID + "/cards", function(err, data) {
      if (err) throw err;
      $scope.list_cards = data;

      // build an object that the dragndrop directive handles better
      if ( $scope.list_cards ) {
        for ( let i = 0; i < $scope.masterListObject.length; i++ ) {
          $scope.masterListObject[i]['cards'] = [];
          $scope.list_cards.forEach( function(card) {
            if( $scope.masterListObject[i].id == card.idList ) {
              $scope.masterListObject[i]['cards'].push(card);
              console.log('master list ', $scope.masterListObject);
            }
          });
        }
      }

      $scope.$apply();
    });
  }

  $scope.dragoverCallback = function(event, index, external, type) {
    // $scope.logListEvent('dragged over', event, index, external, type);
    // Disallow dropping in the third row. Could also be done with dnd-disable-if.
    return index < 10;
  };

  $scope.dropCallback = function(event, index, item, external, type, allowedType) {
    // $scope.logListEvent('dropped at', event, index, item, external, type, allowedType);
    if (external) {
        if (allowedType === 'itemType' && !item.label) return false;
        if (allowedType === 'containerType' && !angular.isArray(item)) return false;
    }
    return item;
  };

  $scope.moveCard = function(event, index, item, type, external, destination) {
    // list/card ID
    let listID = destination.id;
    let cardID = item.id;

    // add new item to destination's card array
    destination.cards.splice(index, 0, item);

    t.put("/1/cards/" + cardID, { idList : listID, pos : index }, function(err, data) {
      if (err) throw err;
      console.log('data');
      console.log(data);
    });

    // return true so directive knows we are handling the move
    return true;
  }

  $scope.moveList = function(event, index, item, type, external, destination) {
    // list/card ID
    let listID = item.id;

    // add new item to destination's card array
    destination.splice(index, 0, item);

    $scope.$apply();

    t.put("/1/lists/" + listID, { pos : index }, function(err, data) {
      if (err) throw err;
      console.log('data');
      console.log(data);
    });

    // return true so directive knows we are handling the move
    return true;
  }

  // $scope.logEvent = function(message, event) {
  //   console.log(message, '(triggered by the following', event.type, 'event)');
  //   console.log(event);
  // };
  //
  // $scope.logListEvent = function(action, event, index, external, type) {
  //   var message = external ? 'External ' : '';
  //   message += type + ' element is ' + action + ' position ' + index;
  //   $scope.logEvent(message, event);
  // };
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
    let data = db.get('profile_data').take(1).value();
    $scope.profile_data = data[0].profile_data;

    let num_of_orgs = db.get('organizations').size().value();
    $scope.organizations = db.get('organizations').take(num_of_orgs).value();

    // get the organization logo
    let get_organization_logo = function(organizationName) {
      t.get('/1/organizations/' + organizationName + '/logoHash', function(err, data) {
        var org_logo;
        if (err) {
          throw err;
        }
        org_logo = data;
        return db.get('organizations').find({ name: organizationName }).assign({ logoHash: org_logo._value }).value();
      });
    }

    if(num_of_orgs > 0) {
        let organizations = $scope.organizations;
        let l = 0;
        while (l < organizations.length){
            get_organization_logo(organizations[l].name);
            l++
        }
    }
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
              'nodeIntegration': false,
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
