const { app, BrowserWindow } = require('electron'); // Electron to create the window
const DiscordRPC = require('discord-rpc'); // Discord Rich Presence API
const rpc = new DiscordRPC.Client({ transport: 'ipc' }); // Initialize new client
const clientId = '1090770350251458592'; // Discord application client ID

rpc.login({ clientId }).catch(console.error);

let mainWindow;

function shortenString(str) {
  // Check if the string is longer than 128 characters
  if (str.length > 128) {
    // If so, truncate it to 128 characters and append '...' to the end
    return str.substring(0, 128) + '...';
  }
  // Otherwise, return the original string
  return str;
}

async function createWindow() {
  let displayWhenIdling = false; // Whether to display a status message when music is paused

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    icon: __dirname + '/assets/ico/soundcloud.ico',
    webPreferences: {
      nodeIntegration: false
    }
  });

   mainWindow.maximize();

  // Load the SoundCloud website
  mainWindow.loadURL('https://soundcloud.com/');

  // Open the DevTools.
  //mainWindow.webContents.openDevTools();


  
  // Wait for the page to fully load
  mainWindow.webContents.on('did-finish-load', async () => {

    await mainWindow.webContents.executeJavaScript(`
    setInterval(function () {
      var source = document.getElementsByTagName('html')[0].innerHTML;
      var found = source.search("Advertisement");

      if (found != -1) {
        window.location.reload(true);
      }
    }, 1000);
  `);

    // Check if music is playing every 10 seconds
    setInterval(async () => {

      // Check if music is playing
      const isPlaying = await mainWindow.webContents.executeJavaScript(
        `document.querySelector('.playControls__play').classList.contains('playing')`
      );

      if (isPlaying) {

        // Retrieve the track title using a script injected into the page
        const trackInfo = await mainWindow.webContents.executeJavaScript(`
        new Promise(resolve => {
          const titleEl = document.querySelector('.playbackSoundBadge__titleLink');
          const authorEl = document.querySelector('.playbackSoundBadge__lightLink');
          if (titleEl && authorEl) {
            resolve({title: titleEl.innerText, author: authorEl.innerText});
          } else {
            resolve({title: '', author: ''});
          }
        });
      `);

        // Retrieve the URL of the song's artwork image
        const artworkUrl = await mainWindow.webContents.executeJavaScript(`
        new Promise(resolve => {
          const artworkEl = document.querySelector('.playbackSoundBadge__avatar .image__lightOutline span');
          if (artworkEl) {
            const url = artworkEl.style.backgroundImage.replace('url("', '').replace('")', '');
            resolve(url);
          } else {
            resolve('');
          }
        });
      `);

        // Update rich presence with the currently playing song
        rpc.setActivity({
          details: shortenString(trackInfo.title.replace(/\n.*/s, '').replace("Current track:", "")),
          state: `Par ${shortenString(trackInfo.author)}`,
          largeImageKey: artworkUrl.replace("50x50.", "500x500."),
          largeImageText: 'by Arizaki',
          smallImageKey: 'soundcloud-logo',
          smallImageText: 'Soundcloud',
          instance: false,
        });
      }
      else {
        if (displayWhenIdling) {

          // Update rich presence when music is paused
          rpc.setActivity({
            details: 'écoute sur Soundcloud',
            state: 'En pause',
            largeImageKey: 'idling',
            largeImageText: 'by Arizaki',
            smallImageKey: 'soundcloud-logo',
            smallImageText: '',
            instance: false,
          });
        }
      }
    }, 100);

  });

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// When Electron has finished initializing, create the main window
app.on('ready', createWindow);

// Quit the app when all windows are closed, unless running on macOS (where it's typical to leave apps running)
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// When the app is activated, create the main window if it doesn't already exist
app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});

