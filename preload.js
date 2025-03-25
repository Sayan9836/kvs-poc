const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getIceServers: () => ipcRenderer.invoke('get-ice-servers'),
  getHlsUrl: () => ipcRenderer.invoke('get-hls-url'),
  getSignalingChannelEndpoint: () => ipcRenderer.invoke('get-signaling-channel-endpoint'),
});