const { app, BrowserWindow } = require('electron');
const DiscordRPC = require('discord-rpc');
const rpc = new DiscordRPC.Client({ transport: 'ipc' });
const clientId = '1090770350251458592';

rpc.login({ clientId })

let mainWindow;

function shortenString(str) {

  if (str.length > 128) {

    return str.substring(0, 128) + '...';
  }

  return str;
}

async function createWindow() {
  let displayWhenIdling = false;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    icon: __dirname + 'soundcloud.ico',
    webPreferences: {
      nodeIntegration: false
    }
  });

   mainWindow.maximize();

  mainWindow.loadURL('https://soundcloud.com/');

  // Open the DevTools.
mainWindow.webContents.openDevTools();


  
  mainWindow.webContents.session.webRequest.onBeforeRequest({ urls: [
    "https://cont-1.p-cdn.us/public/full-128kbps-mp3/*",
    "https://cont-1.p-cdn.us/images/public/devicead/*"
] }, (details, callback) => {
    if (details.url.startsWith("https://cont-1.p-cdn.us/public/full-128kbps-mp3/") ||
        details.url.startsWith("https://cont-1.p-cdn.us/images/public/devicead/")) {
        callback({ cancel: true });
    } else {
        callback({ cancel: false });
    }
  
    setInterval(async () => {

      const isPlaying = await mainWindow.webContents.executeJavaScript(
        `document.querySelector('.playControls__play').classList.contains('playing')`
      );

      if (isPlaying) {

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
    }, 1000);

  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});

