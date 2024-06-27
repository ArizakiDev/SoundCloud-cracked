const { app, BrowserWindow, Menu, shell } = require('electron');
const DiscordRPC = require('discord-rpc');
const rpc = new DiscordRPC.Client({ transport: 'ipc' });
const clientId = '1090770350251458592';

rpc.login({ clientId });

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
  mainWindow.webContents.openDevTools();
  mainWindow.webContents.session.webRequest.onBeforeRequest({ urls: ["*://*/*"] }, (details, callback) => {
    const adPatterns = [
      /.*ads.*/,
      /.*advert.*/,
      /.*doubleclick.net.*/,
      /.*googlesyndication.com.*/,
      /.*adservice.google.*/,
      /.*pagead.*/,
      /.*ad-delivery.*/,
      /.*exponential.com.*/,
      /.*amazon-adsystem.com.*/,
      /.*adnxs.com.*/,
      /.*taboola.com.*/,
      /.*outbrain.com.*/,
      /.*sponsor.*/,
      /.*adserver.*/,
      /.*banner.*/,
      /.*banners.*/,
      /.*promotions.*/
    ];
    
    if (adPatterns.some(pattern => pattern.test(details.url))) {
      callback({ cancel: true });
    } else {
      callback({ cancel: false });
    }
  });

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
    } else {
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

  mainWindow.on('closed', function () {
    mainWindow = null;
  });

  createMenu();
}

function createMenu() {
  const SoundCloud = [
    {
      label: 'SoundCloud Crack v1.2',
      submenu: [
        {
          label: 'Home',
          click: () => {
            mainWindow.loadURL('https://soundcloud.com/');
          }
        },
        {
          label: 'Github',
          click: () => {
            shell.openExternal('https://github.com/ArizakiDev/SoundCloud-cracked');
          }
        },
        {
          label: 'Reload',
          role: 'reload'
        },
        {
          label: 'Quit',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'DevTool',
      submenu: [
        { label: 'Toggle Developer Tools', role: 'toggleDevTools' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(SoundCloud);
  Menu.setApplicationMenu(menu);
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
