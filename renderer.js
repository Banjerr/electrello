'use strict'
// we need this to build the requests
var request = require('request')

// db stuff
var db = low('auth.json');

var hasAccessToken = db.get('access_token').size().value()

if(hasAccessToken > 0){
    var access_token = db.get('access_token')
      .take(1)
      .value()

      var trelloToken = access_token[0].access_token

      // make a get request to get user info
      request.get({
          url: 'https://api.trello.com/1/members/me?fields=username,fullName,url&boards=all&board_fields=name&organizations=all&organization_fields=displayName&key=f4c23306bf38a3ec4ca351f999ee05d3&token=' + trelloToken
          },
              function (error, response, body)
              {
                  if (!error && response.statusCode == 200)
                  {
                      console.log(body)
                  }

                  if (error)
                  {
                      console.log('somethin goofed');
                      console.log(error);
                  }
              }
      );
}
