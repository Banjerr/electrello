'use strict'

// need this to build the post string for the access_token
var request = require('request')

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
const db = low('auth.json');
db.defaults({ access_token: [] }).value()

// Trello stuff
var Trello = require("node-trello");

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let authWindow;

var authUrl = '127.0.0.1:6080/login';

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

    // call the handleCallback function
    authWindow.webContents.on('will-navigate', function (event, url)
    {
      handleCallback(url);
    });

    // call the handleCallback function
    authWindow.webContents.on('did-get-response-details', function (event, url, headers, httpResponseCode)
    {
      handleCallback(event, url, headers, httpResponseCode);
    });

    // call the handleCallback function
    authWindow.webContents.on('did-get-redirect-request', function (event, url)
    {
      handleCallback(url);
    });

    // open the Trello auth page
    authWindow.loadURL('http://127.0.0.1:6080/login');
}

function handleCallback (event, url, headers, httpResponseCode)
{
  var raw_code = /oauth_token=([^&]*)/.exec(headers) || null;
  var code = (raw_code && raw_code.length > 1) ? raw_code[1] : null;
  var error = /\?error=(.+)$/.exec(url);

  if (code || error) {
      authWindow.destroy();
  }

  // If there is a code, proceed to get token from IS
  if (code) {
      console.log(code);

       db.get('access_token').push({
           access_token: code
       }).value();
    }
    if (error)
    {
        console.log('somethin goofed');
        console.log(error);
        alert('Oops! Something went wrong and we couldn\'t' +
        'log you into Trello. Please try again.');
    }
}
