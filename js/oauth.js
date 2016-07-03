'use strict'
// stuff to build window
const electron = require('electron')
// Module to control application life.
const app = electron.app
// Module to create native browser window.
var remote = electron.remote
const {BrowserWindow} = require('electron').remote;

// db stuff
const low = require('lowdb');
const storage = require('lowdb/lib/file-sync');
var db = low('auth.json');

// Trello stuff
var Trello = require("node-trello");

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let authWindow;

// this URL is set up by the node server we started up
var authUrl = 'http://127.0.0.1:6080/login';

var oAuthTokenRequest = function()
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
      handleCallback(originalURL, httpResponseCode, requestMethod, event, resourceType, newURL, referrer);
    });

    // open the Trello auth page
    authWindow.loadURL(authUrl);
}

// this is fired when electron gets response data
function handleCallback (newURL, originalURL, httpResponseCode, requestMethod, event, resourceType, referrer)
{
  var raw_code = /oauth_token=([^&]*)/.exec(httpResponseCode) || null;
  var code = (raw_code && raw_code.length > 1) ? raw_code[1] : null;

  // if the httpResponseCode matches the regex, kill the screen
  if (/^http:\/\/127\.0\.0\.1/.test(httpResponseCode)) {
      authWindow.destroy();

      // if we have the access_token, remove the auth buttons
      var authorize_btn_parent = document.getElementById('auth_section');
      var authorize_btn = document.getElementById('auth_btn');
      authorize_btn_parent.removeChild(authorize_btn)
  }
}
