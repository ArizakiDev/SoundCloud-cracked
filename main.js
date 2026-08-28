/**
 * SoundCloud v1.3 - Client optimisé
 * Développé par Arizaki
 * Optimisé par Arizaki
 * Copyright © 2025 Arizaki
 * 
 * Application permettant d'écouter de la musique depuis SoundCloud
 * avec des fonctionnalités avancées comme Discord RPC et blocage de publicités.
 */

const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron');
const DiscordRPC = require('discord-rpc');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const clientId = '1090770350251458592';
let rpc = null;
let rpcConnected = false;
let rpcReconnectAttempt = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

let mainWindow;
let currentTrack = null;
let checkForRPC = null;
let sleepTimerTimeout = null;
let lastRpcUpdate = 0;
let cachedRpcData = null;
let rpcUpdateInterval = 10000;
let artworkCache = new Map();
let logEnabled = false;
const iconPath = path.join(__dirname, 'soundcloud.ico');

// Gestion de la langue
let currentLanguage = 'fr';

// Définitions des textes multilingues
const locales = {
  fr: {
    app_title: 'SoundCloud - by Arizaki v1.3',
    menu: {
      home: 'Accueil',
      sleep_timer: 'Minuteur de sommeil',
      official_site: 'Site officiel',
      github: 'Github',
      about: 'À propos',
      refresh: 'Rafraîchir',
      quit: 'Quitter',
      devtools: 'Activer/Désactiver DevTools',
      language: 'Langue',
      language_fr: 'Français',
      language_en: 'Anglais',
      language_auto: 'Automatique'
    },
    about_dialog: {
      title: 'À propos de SoundCloud v1.3',
      message: 'SoundCloud v1.3 - Client optimisé',
      detail: 'Développé par Arizaki\nOptimisé par Arizaki\nCopyright © 2025 Arizaki\n\nApplication permettant d\'écouter de la musique depuis SoundCloud avec des fonctionnalités avancées.'
    },
    sleep_timer: {
      title: 'Minuteur de sommeil',
      message: 'Arrêter la lecture après:',
      custom_title: 'Durée personnalisée',
      custom_message: 'Entrez la durée en minutes:',
      activated_title: 'Minuteur activé',
      activated_message: 'La lecture s\'arrêtera dans {minutes} minutes',
      stopped_title: 'Minuteur de sommeil',
      stopped_message: 'La lecture a été mise en pause par le minuteur'
    },
    options: {
      min15: '15 minutes',
      min30: '30 minutes',
      min45: '45 minutes',
      hour1: '1 heure',
      hour1_30: '1h30',
      hour2: '2 heures',
      custom: 'Personnalisé...',
      disable: 'Désactiver',
      cancel: 'Annuler'
    }
  },
  en: {
    app_title: 'SoundCloud - Player v1.3',
    menu: {
      home: 'Home',
      sleep_timer: 'Sleep Timer',
      official_site: 'Official Website',
      github: 'Github',
      about: 'About',
      refresh: 'Refresh',
      quit: 'Quit',
      devtools: 'Toggle DevTools',
      language: 'Language',
      language_fr: 'French',
      language_en: 'English',
      language_auto: 'Automatic'
    },
    about_dialog: {
      title: 'About SoundCloud v1.3',
      message: 'SoundCloud v1.3 - Optimized Client',
      detail: 'Developed by Arizaki\nOptimized by Arizaki\nCopyright © 2025 Arizaki\n\nApplication allowing you to listen to music from SoundCloud with advanced features.'
    },
    sleep_timer: {
      title: 'Sleep Timer',
      message: 'Stop playback after:',
      custom_title: 'Custom Duration',
      custom_message: 'Enter duration in minutes:',
      activated_title: 'Timer Activated',
      activated_message: 'Playback will stop in {minutes} minutes',
      stopped_title: 'Sleep Timer',
      stopped_message: 'Playback has been paused by the timer'
    },
    options: {
      min15: '15 minutes',
      min30: '30 minutes',
      min45: '45 minutes',
      hour1: '1 hour',
      hour1_30: '1h30',
      hour2: '2 hours',
      custom: 'Custom...',
      disable: 'Disable',
      cancel: 'Cancel'
    }
  }
};

// Fonction pour déterminer la langue du système
function detectSystemLanguage() {
  const osLocale = app.getLocale() || '';
  // Si la langue du système commence par 'fr', on utilise le français
  if (osLocale.startsWith('fr')) {
    return 'fr';
  }
  // Sinon on utilise l'anglais par défaut
  return 'en';
}

// Fonction pour changer la langue
function changeLanguage(lang) {
  if (lang === 'auto') {
    currentLanguage = detectSystemLanguage();
  } else {
    currentLanguage = lang;
  }
  
  // Mettre à jour le menu
  createMenu();
  
  // Mettre à jour le titre de l'application
  if (mainWindow) {
    mainWindow.setTitle(locales[currentLanguage].app_title);
  }
}

function connectDiscordRPC() {
  try {
    if (rpc) {
      try {
        rpc.destroy();
        rpc = null;
      } catch (e) {
        if (logEnabled) console.log('Erreur lors de la destruction de la connexion RPC précédente:', e);
      }
    }
    
    if (logEnabled) console.log('Tentative de connexion à Discord RPC...');
    
    DiscordRPC.register(clientId);
    
    rpc = new DiscordRPC.Client({ transport: 'ipc' });
    
    rpc.on('ready', () => {
      if (logEnabled) console.log('Discord RPC connecté avec succès');
      rpcConnected = true;
      rpcReconnectAttempt = 0;
      
      try {
        setDefaultActivity();
      } catch (err) {
        if (logEnabled) console.error('Erreur lors de la définition de l\'activité initiale:', err);
      }
    });
    
    rpc.login({ clientId }).catch(error => {
      if (logEnabled) console.error('Échec de la connexion à Discord RPC:', error);
      rpcConnected = false;
      
      if (rpcReconnectAttempt < MAX_RECONNECT_ATTEMPTS) {
        rpcReconnectAttempt++;
        if (logEnabled) console.log(`Tentative de reconnexion (${rpcReconnectAttempt}/${MAX_RECONNECT_ATTEMPTS})...`);
        setTimeout(connectDiscordRPC, 20000);
      }
    });
  } catch (error) {
    if (logEnabled) console.error('Erreur lors de l\'initialisation de Discord RPC:', error);
    
    if (rpcReconnectAttempt < MAX_RECONNECT_ATTEMPTS) {
      rpcReconnectAttempt++;
      if (logEnabled) console.log(`Tentative de reconnexion (${rpcReconnectAttempt}/${MAX_RECONNECT_ATTEMPTS})...`);
      setTimeout(connectDiscordRPC, 20000);
    }
  }
}

function setDefaultActivity() {
  if (!rpcConnected || !rpc) return;
  
  try {
    const texts = locales[currentLanguage];
    const isEnglish = currentLanguage === 'en';
    
    const activity = {
      details: isEnglish ? 'listening on Soundcloud' : 'écoute sur Soundcloud',
      state: isEnglish ? 'Waiting...' : 'En attente...',
      largeImageKey: 'soundcloud-logo',
      largeImageText: 'by Arizaki',
      buttons: [
        {
          label: isEnglish ? "Listen on SoundCloud" : "Écouter sur SoundCloud",
          url: "https://soundcloud.com/"
        }
      ],
      instance: false
    };
    
    rpc.setActivity(activity).catch(err => {
      if (logEnabled) console.warn('Échec de la définition de l\'activité par défaut:', err);
    });
    
    if (logEnabled) console.log('Activité par défaut définie');
  } catch (error) {
    if (logEnabled) console.warn('Erreur lors de la définition de l\'activité par défaut:', error);
  }
}

function shortenString(str, customLength) {
  if (!str) return '';
  
  const maxLength = customLength || 100;
  
  if (str.length > maxLength) {
    return str.substring(0, maxLength) + '...';
  }
  
  return str;
}

async function getOptimizedArtworkUrl(url) {
  if (!url) return 'soundcloud-logo';
  
  if (artworkCache.has(url)) {
    return artworkCache.get(url);
  }
  
  const optimizedUrl = url.replace(/\d+x\d+/, "200x200");
  
  if (artworkCache.size > 50) {
    const firstKey = artworkCache.keys().next().value;
    artworkCache.delete(firstKey);
  }
  
  artworkCache.set(url, optimizedUrl);
  return optimizedUrl;
}

async function injectCustomFeatures() {
  try {
    if (!mainWindow) return;
    
    const customCSS = `
      .sc-sleep-timer-btn {
        background: none;
        border: none;
        font-size: 16px;
        cursor: pointer;
        margin-left: 10px;
        vertical-align: middle;
      }
    `;
    
    await mainWindow.webContents.insertCSS(customCSS);
    
    const injectionResult = await mainWindow.webContents.executeJavaScript(`
      if (window.scFeaturesInjected) {
        return "Déjà injecté";
      }
      
      window.scFeaturesInjected = true;
      
      function addSleepTimerButton() {
        const playerExtra = document.querySelector('.playControls__elements');
        if (playerExtra && !playerExtra.querySelector('.sc-sleep-timer-btn')) {
          const timerBtn = document.createElement('button');
          timerBtn.className = 'sc-sleep-timer-btn';
          timerBtn.innerHTML = '⏱️';
          timerBtn.title = 'Minuteur de sommeil';
          
          timerBtn.onclick = function() {
            window.postMessage({
              type: 'show-sleep-timer'
            }, '*');
          };
          
          playerExtra.appendChild(timerBtn);
        }
      }
      
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.addedNodes.length) {
            if (document.querySelector('.playControls__elements') && 
                !document.querySelector('.sc-sleep-timer-btn')) {
              addSleepTimerButton();
              break;
            }
          }
        }
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
      });
      
      addSleepTimerButton();
      
      let lastTrackInfo = null;
      let lastUpdateTime = 0;
      
      function checkCurrentTrack() {
        try {
          const now = Date.now();
          if (now - lastUpdateTime < 1000) return;
          lastUpdateTime = now;
          
          const playControls = document.querySelector('.playControls');
          if (!playControls) return;
          
          const isPlaying = playControls.classList.contains('m-playing');
          
          const titleElement = document.querySelector('.playbackSoundBadge__titleLink');
          const artistElement = document.querySelector('.playbackSoundBadge__lightLink');
          
          if (!titleElement || !artistElement) return;
          
          const title = titleElement.title || titleElement.textContent.trim();
          const artist = artistElement.title || artistElement.textContent.trim();
          
          if (lastTrackInfo && 
              lastTrackInfo.title === title && 
              lastTrackInfo.artist === artist && 
              lastTrackInfo.isPlaying === isPlaying) {
            return;
          }
          
          const artworkElement = document.querySelector('.playbackSoundBadge__avatar');
          const artworkUrl = artworkElement ? 
            (artworkElement.querySelector('span')?.style.backgroundImage.replace(/^url\\(['"](.+?)['"]\\)$/, '$1') || 
            artworkElement.querySelector('img')?.src || '') : '';
          
          const trackUrl = titleElement ? titleElement.href : '';
          const artistUrl = artistElement ? artistElement.href : '';
          
          const timeElement = document.querySelector('.playbackTimeline__timePassed span:last-child');
          const durationElement = document.querySelector('.playbackTimeline__duration span:last-child');
          
          const currentTime = timeElement ? timeElement.textContent : '0:00';
          const duration = durationElement ? durationElement.textContent : '0:00';
          
          if (title) {
            const trackInfo = {
              title,
              artist,
              artworkUrl,
              trackUrl,
              artistUrl,
              currentTime,
              duration,
              isPlaying
            };
            
            lastTrackInfo = { 
              title, 
              artist, 
              isPlaying
            };
            
            window.postMessage({
              type: 'track-update',
              trackInfo: trackInfo
            }, '*');
          }
        } catch (error) {
          console.error('Erreur lors de la vérification de la piste actuelle:', error);
        }
      }
      
      setInterval(checkCurrentTrack, 2000);
      
      checkCurrentTrack();
      
      window.addEventListener('message', event => {
        const { type } = event.data;
        
        if (type === 'show-sleep-timer') {
          window.postMessage({
            type: 'show-sleep-timer'
          }, '*');
        }
      });
      
      return "Fonctionnalités injectées avec succès";
    `);
    
    if (logEnabled) console.log('Résultat de l\'injection:', injectionResult);
    
    if (logEnabled) {
    mainWindow.webContents.on('console-message', (event, level, message) => {
        if (message.includes('error') || message.includes('Error')) {
      console.log('Console du renderer:', message);
        }
      });
    }
    
    mainWindow.webContents.executeJavaScript(`
      window.addEventListener('message', event => {
        const { type, trackInfo } = event.data;
        
        if (type === 'track-update' && trackInfo) {
          const { ipcRenderer } = require('electron');
          ipcRenderer.send('track-update', trackInfo);
        } else if (type === 'show-sleep-timer') {
          const { ipcRenderer } = require('electron');
          ipcRenderer.send('show-sleep-timer');
        }
      });
    `);
    
    return true;
  } catch (error) {
    if (logEnabled) console.error('Erreur lors de l\'injection des fonctionnalités personnalisées:', error);
    return false;
  }
}

function showSleepTimer() {
  if (!mainWindow) return;
  
  const texts = locales[currentLanguage];
  
  if (sleepTimerTimeout) {
    clearTimeout(sleepTimerTimeout);
    sleepTimerTimeout = null;
  }
  
  const options = [
    { minutes: 15, label: texts.options.min15 },
    { minutes: 30, label: texts.options.min30 },
    { minutes: 45, label: texts.options.min45 },
    { minutes: 60, label: texts.options.hour1 },
    { minutes: 90, label: texts.options.hour1_30 },
    { minutes: 120, label: texts.options.hour2 },
    { minutes: -1, label: texts.options.custom },
    { minutes: 0, label: texts.options.disable }
  ];
  
  dialog.showMessageBox(mainWindow, {
    type: 'question',
    title: texts.sleep_timer.title,
    message: texts.sleep_timer.message,
    buttons: options.map(opt => opt.label),
    cancelId: options.length - 1
  }).then(async result => {
    const selectedOption = options[result.response];
    
    if (selectedOption.minutes === -1) {
      const customResult = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        title: texts.sleep_timer.custom_title,
        message: texts.sleep_timer.custom_message,
        buttons: [texts.options.cancel, '5', '10', '20', '40', '50', '75', '100', '150', '180'],
        cancelId: 0
      });
      
      if (customResult.response === 0) {
        return;
      }
      
      const customMinutes = parseInt(customResult.buttons[customResult.response]);
      setTimerForMinutes(customMinutes);
    } else if (selectedOption.minutes > 0) {
      setTimerForMinutes(selectedOption.minutes);
    }
  }).catch(err => {
    console.error('Erreur lors de l\'affichage du minuteur:', err);
  });
  
  function setTimerForMinutes(minutes) {
    const timeInMs = minutes * 60 * 1000;
      
    dialog.showMessageBox({
      type: 'info',
      title: texts.sleep_timer.activated_title,
      message: texts.sleep_timer.activated_message.replace('{minutes}', minutes)
    });
      
    sleepTimerTimeout = setTimeout(() => {
      mainWindow.webContents.executeJavaScript(`
        const playButton = document.querySelector('.playControls__play');
        if (playButton && playButton.classList.contains('playing')) {
          playButton.click();
        }
      `).catch(() => {});
        
      dialog.showMessageBox({
        type: 'info',
        title: texts.sleep_timer.stopped_title,
        message: texts.sleep_timer.stopped_message
      });
        
      sleepTimerTimeout = null;
    }, timeInMs);
  }
}

async function updateDiscordRPC() {
  if (!rpcConnected || !rpc || !mainWindow) return;
  
  try {
    const now = Date.now();
    if (now - lastRpcUpdate < rpcUpdateInterval) {
      return;
    }
    lastRpcUpdate = now;
    
    const playerInfo = await mainWindow.webContents.executeJavaScript(`
      (function() {
        try {
          const playButton = document.querySelector('.playControls__play');
          const isPlaying = playButton && playButton.classList.contains('playing');
          
          const titleEl = document.querySelector('.playbackSoundBadge__titleLink span:nth-child(2)');
          const artistEl = document.querySelector('.playbackSoundBadge__lightLink');
          const artworkEl = document.querySelector('.playbackSoundBadge__avatar .image__lightOutline span');
          
          let trackInfo = null;
          
          if (titleEl && artistEl) {
            trackInfo = {
              title: titleEl.innerText || 'Piste inconnue',
              artist: artistEl.innerText || 'Artiste inconnu',
              url: titleEl.href || 'https://soundcloud.com/',
              artwork: ''
            };
            
            if (artworkEl && artworkEl.style && artworkEl.style.backgroundImage) {
              trackInfo.artwork = artworkEl.style.backgroundImage.replace('url("', '').replace('")', '');
            }
          }
          
          return { isPlaying, trackInfo };
        } catch (e) {
          return { isPlaying: false, trackInfo: null };
        }
      })();
    `).catch(err => {
      return { isPlaying: false, trackInfo: null };
    });
    
    const hasTrackChanged = playerInfo.trackInfo && 
                           (!cachedRpcData || 
                            cachedRpcData.title !== playerInfo.trackInfo.title || 
                            cachedRpcData.artist !== playerInfo.trackInfo.artist ||
                            cachedRpcData.isPlaying !== playerInfo.isPlaying);
    
    if (!hasTrackChanged && cachedRpcData) {
      return;
    }
    
    if (playerInfo.trackInfo) {
      currentTrack = playerInfo.trackInfo;
    }
    
    if (playerInfo.trackInfo) {
      cachedRpcData = {
        title: playerInfo.trackInfo.title,
        artist: playerInfo.trackInfo.artist,
        isPlaying: playerInfo.isPlaying
      };
    }
    
    const isEnglish = currentLanguage === 'en';
    
    if (playerInfo.isPlaying && currentTrack) {
      try {
        const artworkUrl = await getOptimizedArtworkUrl(currentTrack.artwork);
        
        const safeTitle = shortenString(currentTrack.title || '', 80);
        const safeArtist = shortenString(currentTrack.artist || '', 30);
        
        const totalDetails = safeTitle.length + safeArtist.length;
        let finalTitle = safeTitle;
        let finalArtist = safeArtist;
        
        if (totalDetails > 200) {
          finalTitle = shortenString(currentTrack.title || '', 80);
          finalArtist = shortenString(currentTrack.artist || '', 30);
        }
        
        await rpc.setActivity({
          details: finalTitle,
          state: isEnglish ? `By ${finalArtist}` : `Par ${finalArtist}`,
          largeImageKey: artworkUrl,
          largeImageText: 'By Arizaki',
          buttons: [
            {
              label: isEnglish ? "Listen on SoundCloud" : "Écouter sur SoundCloud",
              url: currentTrack.url || "https://soundcloud.com/"
            }
          ],
          instance: false
        }).catch(error => {
          if (logEnabled) console.warn('Erreur RPC, tentative avec des paramètres encore plus simples');
          
          rpc.setActivity({
            details: isEnglish ? "Listening to SoundCloud" : "Écoute SoundCloud",
            state: isEnglish ? "Music playing..." : "Musique en cours...",
            largeImageKey: 'soundcloud-logo',
            instance: false
          }).catch(e => {
            if (logEnabled) console.error('Échec complet de la mise à jour RPC');
          });
        });
      } catch (error) {
        if (logEnabled) console.warn('Erreur lors de la mise à jour de Discord RPC (lecture)');
        if (error && error.message && error.message.includes('connection closed')) {
          rpcConnected = false;
          if (rpcReconnectAttempt < MAX_RECONNECT_ATTEMPTS) {
            rpcReconnectAttempt++;
            if (logEnabled) console.log(`Erreur RPC détectée. Tentative de reconnexion (${rpcReconnectAttempt}/${MAX_RECONNECT_ATTEMPTS})...`);
            setTimeout(connectDiscordRPC, 15000);
          }
        }
      }
    } else if (rpcConnected && rpc) {
      try {
        await rpc.setActivity({
          details: isEnglish ? 'listening on Soundcloud' : 'écoute sur Soundcloud',
          state: isEnglish ? 'Paused' : 'En pause',
          largeImageKey: 'idling',
          largeImageText: 'by Arizaki',
          instance: false
        });
      } catch (error) {
        if (logEnabled) console.warn('Erreur lors de la mise à jour de Discord RPC (pause)');
        if (error && error.message && error.message.includes('connection closed')) {
          rpcConnected = false;
          if (rpcReconnectAttempt < MAX_RECONNECT_ATTEMPTS) {
            rpcReconnectAttempt++;
            if (logEnabled) console.log(`Erreur RPC détectée. Tentative de reconnexion (${rpcReconnectAttempt}/${MAX_RECONNECT_ATTEMPTS})...`);
            setTimeout(connectDiscordRPC, 15000);
          }
        }
      }
    }
  } catch (error) {
    if (logEnabled) console.error('Erreur dans updateDiscordRPC');
  }
}

async function createWindow() {
  // Détection automatique de la langue au démarrage
  currentLanguage = detectSystemLanguage();
  const texts = locales[currentLanguage];
  
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    icon: path.join(__dirname, 'soundcloud.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      backgroundThrottling: true,
      offscreen: false
    }
  });
  
  mainWindow.maximize();
  mainWindow.loadURL('https://soundcloud.com/');
    

  // remove visual ads
  const cssPath = path.join(__dirname, 'custom.css');
  const customCSS = fs.readFileSync(cssPath, 'utf8');
  mainWindow.webContents.on('did-frame-finish-load', () => {
    mainWindow.webContents.insertCSS(customCSS).then(() => {
      console.log('CSS injected ');
    }).catch(err => {
      console.error('CSS injection error:', err);
    });
  });

  
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
    
    const url = details.url.toLowerCase();
    const shouldBlock = adPatterns.some(pattern => pattern.test(url));
    
    callback({ cancel: shouldBlock });
  });

  mainWindow.webContents.on('did-finish-load', async () => {
    mainWindow.setTitle(texts.app_title);
    
    await injectCustomFeatures();
    
    setInterval(updateDiscordRPC, rpcUpdateInterval);
  });

  mainWindow.webContents.on('did-navigate', () => {
    if (global.gc) global.gc();
  });

  mainWindow.on('closed', function () {
    if (checkForRPC) clearInterval(checkForRPC);
    mainWindow = null;
  });

  createMenu();
}

function createMenu() {
  const texts = locales[currentLanguage];
  
  const SoundCloud = [
    {
      label: 'SoundCloud v1.3',
      submenu: [
        {
          label: texts.menu.home,
          click: () => {
            mainWindow.loadURL('https://soundcloud.com/');
          }
        },
        {
          label: texts.menu.sleep_timer,
          click: () => {
            showSleepTimer();
          }
        },
        {
          label: texts.menu.official_site,
          click: () => {
            shell.openExternal('https://soundcloud-crack.web.app/');
          }
        },
        {
          label: texts.menu.github,
          click: () => {
            shell.openExternal('https://github.com/ArizakiDev/SoundCloud-cracked');
          }
        },
        {
          label: texts.menu.about,
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: texts.about_dialog.title,
              message: texts.about_dialog.message,
              detail: texts.about_dialog.detail,
              buttons: ['OK']
            });
          }
        },
        {
          label: texts.menu.language,
          submenu: [
            {
              label: texts.menu.language_auto,
              type: 'radio',
              checked: currentLanguage === detectSystemLanguage(),
              click: () => {
                changeLanguage('auto');
              }
            },
            {
              label: texts.menu.language_fr,
              type: 'radio',
              checked: currentLanguage === 'fr',
              click: () => {
                changeLanguage('fr');
              }
            },
            {
              label: texts.menu.language_en,
              type: 'radio',
              checked: currentLanguage === 'en',
              click: () => {
                changeLanguage('en');
              }
            }
          ]
        },
        {
          label: texts.menu.refresh,
          role: 'reload'
        },
        {
          label: texts.menu.quit,
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: texts.menu.devtools,
      submenu: [
        { label: texts.menu.devtools, role: 'toggleDevTools' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(SoundCloud);
  Menu.setApplicationMenu(menu);
}

ipcMain.on('track-update', (event, trackInfo) => {
  if (trackInfo && trackInfo.title) {
    if (!currentTrack || currentTrack.title !== trackInfo.title || currentTrack.artist !== trackInfo.artist) {
      currentTrack = trackInfo;
      
      lastRpcUpdate = 0;
      updateDiscordRPC();
    }
  }
});

ipcMain.on('show-sleep-timer', () => {
  showSleepTimer();
});

if (require('electron-squirrel-startup')) app.quit();

app.on('ready', () => {
  createWindow();
  setTimeout(connectDiscordRPC, 3000);
});

app.on('window-all-closed', function () {
  if (rpc) {
    try {
      artworkCache.clear();
      rpc.destroy();
      rpc = null;
    } catch (e) {
      console.log('Error destroying RPC on app close:', e);
    }
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
  
  if (!rpcConnected) {
    connectDiscordRPC();
  }
});

if (process.env.NODE_ENV === 'development') {
  console.log('Running in development mode');
} else {
  console.log('Running in production mode');
}

module.exports = {
  appIcon: iconPath,
  buildOptions: {
    appId: 'com.arizaki.soundcloud',
    productName: 'SoundCloud v1.3',
    copyright: 'Copyright © 2025 Arizaki',
    win: {
      icon: iconPath,
      target: ['nsis'],
      artifactName: 'SoundCloud-v1.3-setup-${version}.${ext}'
    },
    nsis: {
      oneClick: false,
      allowToChangeInstallationDirectory: true,
      installerIcon: iconPath,
      uninstallerIcon: iconPath,
      installerHeaderIcon: iconPath,
      createDesktopShortcut: true,
      createStartMenuShortcut: true
    },
    extraMetadata: {
      author: {
        name: "Arizaki",
        email: "support@nexara-hosting.xyz"
      },
      contributors: [
        {
          name: "Arizaki",
          role: "dev & optimisations"
        }
      ],
      description: "Application SoundCloud optimisée avec fonctionnalités Discord RPC et blocage de publicités.",
      supportedLanguages: ["fr", "en"]
    },
    extraResources: [
      {
        from: "locales",
        to: "locales"
      }
    ]
  }
};