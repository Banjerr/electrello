'use strict'

// need this to build the post string for the access_token
var request = require('request');

// stuff to build window
const electron = require('electron')
// Module to control application life.
const app = electron.app
// Module to create native browser window.
const {BrowserWindow} = require('electron').remote
var remote = electron.remote;

// db stuff
const low = require('lowdb');
const db = low('auth.json');

// Trello stuff
var Trello = require("node-trello");

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let authWindow;

// Trello oAuth stuff
var options =
{
    public_key: 'f4c23306bf38a3ec4ca351f999ee05d3',
    name: 'Electrello',
    response_type: 'token',
    expiration: 'never',
    scope: 'read,write'
};
var trelloUrl = 'https://trello.com/1/connect?';
var authUrl = trelloUrl + 'key=' + options.public_key + '&name=' + options.name + '&response_type=' + options.response_type + '&expiration=' + options.expiration + '&scope=' + options.scope;

var oAuthTokenRequest = function()
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

    // call the handleCallback function
    authWindow.webContents.on('will-navigate', function (event, url)
    {
      handleCallback(url);
    });

    // call the handleCallback function
    authWindow.webContents.on('did-get-redirect-request', function (event, url)
    {
      handleCallback(url);
    });

    // open the IS auth page
    authWindow.loadURL(authUrl);
}

function handleCallback (url)
{
  var raw_code = /code=([^&]*)/.exec(url) || null;
  var code = (raw_code && raw_code.length > 1) ? raw_code[1] : null;
  var error = /\?error=(.+)$/.exec(url);

  if (code || error) {
      authWindow.destroy();
  }

  // If there is a code, proceed to get token from IS
  if (code) {
      console.log(code);
      console.log('get an access token, ya big dummy!');

       db('access_token').push({
           access_token: parsed.access_token,
           token_type: parsed.token_type,
           refresh_token: parsed.refresh_token,
           expires_in: parsed.expires_in,
           scope: parsed.scope,
           created: epochTime,
       });
    }
    if (error)
    {
        console.log('somethin goofed');
        console.log(error);
    }
    else if (error)
    {
      alert('Oops! Something went wrong and we couldn\'t' +
      'log you into Trello. Please try again.');
    }
}
