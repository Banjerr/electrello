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
// TODO rename this db to auth_db, now that we have multiple db files
const db = low('auth.json');
const board_db = low('board.json');
const card_db = low('card.json');
// default stuff for board_db and card_db
board_db.defaults({ boards: [] }).value();
card_db.defaults({ cards: [] }).value();

// we need this to build the requests
const request = require('request');

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

// Define the electrello app module and some config for angular material
var electrello = angular.module('electrello', ['ngMaterial', 'ngMessages', 'ngRoute', 'ngResource', 'dndLists', 'xeditable']).config(function($mdThemingProvider) {
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
electrello.controller('DashboardController', ['$scope', '$rootScope', '$route', '$location', '$window', '$mdDialog',
    function($scope, $rootScope, $route, $location, $window, $mdDialog){
    // // get the updated list of boards
    // let num_of_boards = db.get('board_names').size().value();
    // $scope.board_names = db.get('board_names').take(num_of_boards).value();
    var local_boards_length = board_db.get('boards').size().value();
    var local_boards;
    if (local_boards_length) {
      local_boards = board_db.get('boards').take(local_boards_length).value();
      local_boards = local_boards[0].data;
    }

    // TODO first show the local boards, and then check Trello to see if anythings updated, if so then reload $state and update the local db

    // get user id from DB
    let data = db.get('profile_data').take(1).value();
    let userID = data[0].profile_data.id;

    // get updated list of boards straight from Trello
    t.get("/1/members/" + userID + "/boards", function(err, data) {
      if (err) throw err;
      $scope.board_names = data;
      $scope.$apply();

      // check to see if local matches Trello data
      if (local_boards) {
        var board_up_to_date = _.isEqual(data, local_boards);
      }

      // if it doesnt match then update the local db
      if (!board_up_to_date) {
        board_db.get('boards')
          .push({data})
          .value();
      }
    });

    // show a board
    $scope.show_this_board = function( boardID ) {
        $rootScope.pageClass = 'board';
        $location.path('/board/' + boardID);
    }

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
}]);

// board controller
electrello.controller('BoardController', ['$scope', '$route', '$routeParams', '$location', '$mdDialog', '$window', '$rootScope',
    function($scope, $route, $routeParams, $location, $mdDialog, $window, $rootScope){
  // get the id from the route
  let boardID = $routeParams.boardID;
  $scope.board_data = [];
  $scope.board_lists = [];
  $scope.list_cards = [];
  $scope.masterListObject = {};

  // TODO check for existing board data / card data and load that
  // meanwhile check Trello for anything new and if it doesnt match then reload $state with updated info and update the local db
  //
  // maybe store all cards by their board ID, if i can figure out a way to accomplish that?
  var local_cards_length = card_db.get('cards').size().value();
  var local_cards;
  if (local_cards_length) {
    local_cards = card_db.get('cards').take(local_cards_length).value();
    local_cards = local_cards[0].data;
  }

  // get some board data
  let get_board_data = function( boardID ) {
    t.get("/1/boards/" + boardID, function(err, data) {
      if (err) throw err;
      $scope.board_data = data;

      // check to see if local matches Trello
      if (local_cards) {
        var card_up_to_date = _.isEqual(data, local_cards);
      }

      // if it doesnt match then update the local db
      if (!card_up_to_date) {
        card_db.get('cards')
          .push({data})
          .value();
      }

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

  // get cards
  let get_list_cards = function( boardID ) {
    t.get("/1/boards/" + boardID + "/cards", { fields : 'all', stickers : true, sticker_fields : 'all' },function(err, data) {
      if (err) throw err;
      $scope.list_cards = data;

      // check for checklists on each card
      // TODO save checklist to db
      _.each($scope.list_cards, function(card) {
        if(card.idChecklists.length) {
          get_checklist(card.idChecklists[0]);
        }
      });

      // build an object that the dragndrop directive handles better
      if ( $scope.list_cards ) {
        for ( let i = 0; i < $scope.masterListObject.length; i++ ) {
          $scope.masterListObject[i]['cards'] = [];
          $scope.list_cards.forEach( function(card) {
            if( $scope.masterListObject[i].id == card.idList ) {
              $scope.masterListObject[i]['cards'].push(card);
            }
          });
        }
      }

      $scope.$apply();
    });
  };

  // get checklist
  let get_checklist = function( checklistID ) {
    t.get("/1/checklists/" + checklistID, function(err, data) {
      if (err) throw err;
      // TODO assign checklist to list somehow
      // ALSO! figure out local storage, lodash isnt great for boards obviously
      $scope.check_lists = data;

      $scope.$apply();
    });
  };

  // update checklist item
  $scope.updateChecklist = function(item, status, checklist) {
    let checklistID = item.idChecklist;
    let checkItemID = item.id;
    let cardID = checklist.idCard;

    if (status == 'markAsComplete') {
      status = 'true';
    }
    else {
      status = 'false';
    }

    // delete checklist item in Trello
    t.put("/1/cards/" + cardID + "/checklist/" + checklistID + "/checkItem/" + checkItemID + "/state", { idChecklist : checklistID, idCheckItem : checkItemID, value : status}, function(err, data) {
      if (err) throw err;
      // TODO update view with new mark
      get_checklist(checklistID);

      $scope.$apply();
    });
  };

  // delete checklist item
  $scope.deleteChecklistItem = function(item) {
    let checklistID = item.idChecklist;
    let checkItemID = item.id;

    // delete checklist item in Trello
    t.del("/1/checklists/" + checklistID + "/checkItems/" + checkItemID, { idCheckItem : checkItemID}, function(err, data) {
      if (err) throw err;
      get_checklist(checklistID);
    });
  };

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

      // $scope.$apply();
    });
  };
  get_board_lists( boardID );

  // move card
  $scope.moveCard = function(event, index, item, type, external, destination) {
    // list/card ID
    let listID = destination.id;
    let cardID = item.id;

    // add new item to destination's card array
    // destination.cards.splice(index, 0, item);

    // update Trello first
    t.put("/1/cards/" + cardID, { idList : listID, pos : index }, function(err, data) {
      if (err) throw err;

      get_list_cards( boardID );

      // return true so directive knows we are handling the move
      return true;
    });
  };

  // move list
  $scope.moveList = function(event, index, item, type, external, destination) {
    // list/card ID
    let listID = item.id;

    // update Trello first
    t.put("/1/lists/" + listID, { pos : index }, function(err, data) {
      if (err) throw err;

      // add new item to destination's card array
      destination.splice(index, 0, item);

      // return true so directive knows we are handling the move
      return true;
    });
  };

  // rename board/list/card
  $scope.renameItem = function(itemType, itemId, newName) {
    // update Trello with the new name
    t.put("/1/" + itemType + "/" + itemId, { name : newName }, function(err, data) {
      if (err) throw err;
    });
  };
}]);

// menu controller
electrello.controller('MenuController', ['$scope', '$route', '$routeParams', '$location', '$mdDialog', '$window', '$rootScope', function($scope, $route, $routeParams, $location, $mdDialog, $window, $rootScope){
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
}]);

// profile data controller
electrello.controller('ProfileController', ['$scope', function ($scope) {
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
}]);

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let authWindow;

// this URL is set up by the node server we started up
const authUrl = 'http://127.0.0.1:6080/login';

// authorization stuffs
electrello.controller('AuthController', ['$scope', '$location', '$route', '$routeParams', '$window', '$rootScope', function($scope, $location, $route, $routeParams, $window, $rootScope){
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
}]);
