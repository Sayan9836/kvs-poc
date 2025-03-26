import { app, BrowserWindow, ipcMain } from 'electron';
import { GetIceServerConfigCommand, KinesisVideoSignalingClient } from "@aws-sdk/client-kinesis-video-signaling";
import { KinesisVideoWebRTCStorageClient, JoinStorageSessionCommand } from "@aws-sdk/client-kinesis-video-webrtc-storage";
import { DescribeSignalingChannelCommand, GetDataEndpointCommand, GetSignalingChannelEndpointCommand, KinesisVideoClient, UpdateMediaStorageConfigurationCommand } from "@aws-sdk/client-kinesis-video";
import { GetHLSStreamingSessionURLCommand, KinesisVideoArchivedMediaClient } from "@aws-sdk/client-kinesis-video-archived-media";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const config = {

};


// Initialize AWS clients


const kvClient = new KinesisVideoClient({
  region: config.region,
  credentials: {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey
  },
});

let mainWindow;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  await mainWindow.loadFile('index.html');
}

async function updateMediaStorageConfiguration() {
  const input = {
    ChannelARN: config.channelARN,
    MediaStorageConfiguration: {
      Status: "ENABLED",          
      StreamARN: config.streamArn 
    }
  };

  const command = new UpdateMediaStorageConfigurationCommand(input);
  try {
    const response = await kvClient.send(command);
    console.log("Media storage configuration updated successfully:", response);
  } catch (error) {
    console.error("Error updating media storage configuration:", error);
  }
}

const sharableObj = {
  endpointsByProtocol: null
}


ipcMain.handle('get-signaling-channel-endpoint', async () => {
  const input = {
    ChannelARN: config.channelARN,
    SingleMasterChannelEndpointConfiguration: {
      Protocols: ['WSS', 'HTTPS', 'WEBRTC'],
      Role: "MASTER",
    },

  };

  await updateMediaStorageConfiguration()
  
  const command = new GetSignalingChannelEndpointCommand(input);
  
  const getSignalingChannelEndpointResponse = await kvClient.send(command);
  console.log('getSignalingChannelEndpointResponse => ', getSignalingChannelEndpointResponse)
  
  const endpointsByProtocol = getSignalingChannelEndpointResponse?.ResourceEndpointList?.reduce((endpoints, endpoint) => {
    endpoints[endpoint.Protocol] = endpoint.ResourceEndpoint;
    return endpoints;
  }, {});

  sharableObj.endpointsByProtocol = endpointsByProtocol;

  return endpointsByProtocol;
})

ipcMain.handle('connect-to-media-server', async (channelEndpoints) =>  {
  const storageClient = new KinesisVideoWebRTCStorageClient({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    endpoint: sharableObj.endpointsByProtocol.WEBRTC,
    maxAttempts: 1
  });

  let retries = 0;
  const maxRetries = 5;
  let sdpOfferReceived = false;

  while (!sdpOfferReceived && retries < maxRetries) {
    try {
      console.log(`[MASTER] Attempting to join storage session (attempt ${retries + 1}).`);
      
      const command = new JoinStorageSessionCommand({
        channelArn: config.channelARN,
      });
      
      const response = await storageClient.send(command);
      console.log('[MASTER] joinStorageSession response:', response);
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      sdpOfferReceived = true;
      console.log('[MASTER] Joined storage session successfully.');
    } catch (error) {
      console.error('[MASTER] joinStorageSession error:', error);
      retries++;
      await new Promise(resolve => setTimeout(resolve, 6000));
    }
  }

  if (!sdpOfferReceived) {
    console.error('[MASTER] Failed to join storage session after maximum retries.');
  }
})

ipcMain.handle('get-ice-servers', async (endpointsByProtocol) => {

  const signalingClient = new KinesisVideoSignalingClient({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    },
    endpoint:  endpointsByProtocol.HTTPS,
  });
  try {
    // Use the v3 command to describe the signaling channel.
    const describeCommand = new DescribeSignalingChannelCommand({
      ChannelARN: config.channelARN
    });
    const describeResponse = await signalingClient.send(describeCommand);

    const iceServers = [{
      urls: `stun:stun.l.google.com:19302`
    }];

    // If the channel type is SINGLE_MASTER, retrieve the ICE server configuration.
    if (describeResponse.ChannelInfo && describeResponse.ChannelInfo.ChannelType === 'SINGLE_MASTER') {
      const iceCommand = new GetIceServerConfigCommand({
        ChannelARN: config.channelARN
      });
      const iceConfig = await signalingClient.send(iceCommand);
      console.log('IceConfig received:', iceConfig); // Debug log

      if (iceConfig && iceConfig.IceServerList) {
        iceConfig.IceServerList.forEach(server => {
          iceServers.push({
            urls: server.Uris,
            username: server.Username,
            credential: server.Password
          });
        });
      } else {
        console.warn('No IceServerList found in iceConfig.');
      }
    }

    return iceServers;
  } catch (error) {
    console.error('Error getting ICE servers:', error);
    throw error;
  }
});

ipcMain.handle('get-hls-url', async () => {
  try {
    // 1. First, get the data endpoint for the HLS streaming session
    
    const dataEndpointCommand = new GetDataEndpointCommand({
      StreamName: config.streamName,
      APIName: "GET_HLS_STREAMING_SESSION_URL"
    });
    
    const dataEndpointResponse = await kvClient.send(dataEndpointCommand);
    const dataEndpoint = dataEndpointResponse.DataEndpoint;
    
    // 2. Create the Kinesis Video Archived Media Client using the correct data endpoint
    const archivedMediaClient = new KinesisVideoArchivedMediaClient({
      endpoint: dataEndpoint, // important!
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });
    
    // 3. Call GetHLSStreamingSessionURLCommand with desired parameters
    const command = new GetHLSStreamingSessionURLCommand({
      StreamName: config.streamName,
      PlaybackMode: "ON_DEMAND",
      Expires: 3600, // URL valid for 1 hour
      HLSFragmentSelector: {
        FragmentSelectorType: "SERVER_TIMESTAMP", // or "SERVER_TIMESTAMP" if you prefer
        TimestampRange: {
          StartTimestamp: new Date(Date.now() - 40 * 60 * 1000), // 5 minutes ago
          EndTimestamp: new Date() // current time
        }
      }    
    });
    
    const response = await archivedMediaClient.send(command);
    console.log('Response:', response);
    console.log('HLS URL:', response.HLSStreamingSessionURL);
    return response.HLSStreamingSessionURL;
  } catch (error) {
    console.error('Error getting HLS URL:', error);
    throw error;
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});