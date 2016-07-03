http = require('http')
OAuth = require('oauth').OAuth
url = require('url')
# db stuffs
db = low('auth.json');
db.defaults({ access_token: [], profile_data: [] }).value()

#run locally on a port that probably isn't taken
domain = "127.0.0.1"
port = 6080

requestURL = "https://trello.com/1/OAuthGetRequestToken"
accessURL = "https://trello.com/1/OAuthGetAccessToken"
authorizeURL = "https://trello.com/1/OAuthAuthorizeToken"
appName = "Electrello"

#replace these with your application key/secret
key = "f4c23306bf38a3ec4ca351f999ee05d3"
secret = "8a0ab7a904d8e36924324c1605cb13a1985883b3f0bf08786e931398a2f7b822"

#Trello redirects the user here after authentication
loginCallback = "http://#{domain}:#{port}/cb"

#need to store token: tokenSecret pairs; in a real application, this should be more permanent (redis would be a good choice)
oauth_secrets = {}

bio_data = {}

oauth = new OAuth(requestURL, accessURL, key, secret, "1.0", loginCallback, "HMAC-SHA1")

login = (req, res) ->
  oauth.getOAuthRequestToken (error, token, tokenSecret, results) =>
    oauth_secrets[token] = tokenSecret
    res.writeHead(302, { 'Location': "#{authorizeURL}?oauth_token=#{token}&name=#{appName}&expiration=never" })
    res.end()

cb = (req, res) ->
  query = url.parse(req.url, true).query

  token = query.oauth_token
  tokenSecret = oauth_secrets[token]
  verifier = query.oauth_verifier

  oauth.getOAuthAccessToken token, tokenSecret, verifier, (error, accessToken, accessTokenSecret, results) ->
    #in a real app, the accessToken and accessTokenSecret should be stored
    oauth.getProtectedResource("https://api.trello.com/1/members/me/", "GET", accessToken, accessTokenSecret, (error, data, response) ->
      #respond with data to show that we now have access to your data
      res.end(data)
      bio_data = JSON.parse(data)
      db.get('access_token').push({
          access_token: accessToken
      }).value();
      db.get('profile_data').push({
          profile_data: bio_data
      }).value();
    )

http.createServer( (req, res) ->
  if /^\/login/.test(req.url)
    login(req, res)
  else if /^\/cb/.test(req.url)
    cb(req, res)
  else
    res.end("Don't know about that")
).listen(port, domain)

console.log "Server running at #{domain}:#{port}; hit #{domain}:#{port}/login"
