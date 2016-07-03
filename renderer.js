'use strict'

// we need this to build the requests
var request = require('request')

// db stuff
var db = low('auth.json');
// get the size of the db
let hasAccessToken = db.get('access_token').size().value();
// get the access token from the db if hasAccessToken > 0
if(hasAccessToken > 0){
    // get the token and set it to a var
    var access_token = db.get('access_token')
      .take(1)
      .value()
    var trelloToken = access_token[0].access_token;

    // if we have the access_token, remove the auth buttons
    var authorize_btn_parent = document.getElementById('auth_section');
    var authorize_btn = document.getElementById('auth_btn');
    authorize_btn_parent.removeChild(authorize_btn)
}

// Define the electrello app module
var electrello = angular.module('electrello', ['ngMaterial', 'ngMessages']).config(function($mdThemingProvider) {
  $mdThemingProvider.theme('default').dark()
    .primaryPalette('red', {'default':'400'})
    .accentPalette('yellow', {'default':'500'});
});

// board controller
electrello.controller('BoardController', BoardController);

var BoardController = function() {

}

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
                            console.log(body)
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

        // delete profile data
        $scope.delete_profile_data = function() {
            db.get('profile_data').remove().value();
            console.log('deleted profile data');
        }
    }

    // delete the tokens
    $scope.delete_token = function() {
      db.get('access_token').remove().value();
      console.log('deleted token');
    }
}]);
