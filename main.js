import { app, BrowserWindow, ipcMain } from 'electron';
import { GetIceServerConfigCommand, KinesisVideoSignalingClient } from "@aws-sdk/client-kinesis-video-signaling";

import { DescribeSignalingChannelCommand, GetDataEndpointCommand, GetSignalingChannelEndpointCommand, KinesisVideoClient } from "@aws-sdk/client-kinesis-video";
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


ipcMain.handle('get-signaling-channel-endpoint', async () => {
  const input = {
    ChannelARN: config.channelARN,
    SingleMasterChannelEndpointConfiguration: {
        Protocols: ['WSS', 'HTTPS'],
        Role: "MASTER",
    },
  };
  
  const command = new GetSignalingChannelEndpointCommand(input);
  
  const getSignalingChannelEndpointResponse = await kvClient.send(command);
  console.log('getSignalingChannelEndpointResponse => ', getSignalingChannelEndpointResponse)
  
  const endpointsByProtocol = getSignalingChannelEndpointResponse?.ResourceEndpointList?.reduce((endpoints, endpoint) => {
    endpoints[endpoint.Protocol] = endpoint.ResourceEndpoint;
    return endpoints;
  }, {});

  return endpointsByProtocol;
})
// IPC Handlers
ipcMain.handle('get-ice-servers', async (endpointsByProtocol) => {

  const signalingClient = new KinesisVideoSignalingClient({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    },
    endpoint:  endpointsByProtocol.HTTPS
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

// ipcMain.handle('get-hls-url', async () => {
//   try {
//     // const dataEndpoint = await kvClient.getDataEndpoint({
//     //   StreamName: config.streamName,
//     //   APIName: "GET_HLS_STREAMING_SESSION_URL"
//     // });

//     const archivedMediaClient = new KinesisVideoArchivedMediaClient({
//       // endpoint: dataEndpoint.DataEndpoint,
//       region: config.region,
//       credentials: {
//         accessKeyId: config.accessKeyId,
//         secretAccessKey: config.secretAccessKey
//       }
//     });

//     const command = new GetHLSStreamingSessionURLCommand({
//       StreamName: config.streamName,
//       PlaybackMode: "ON_DEMAND",
//       Expires: 3600,
//       // HLSFragmentSelector: {
//       //   FragmentSelectorType: "SERVER_TIMESTAMP",
//       //   TimestampRange: {
//       //     StartTimestamp: new Date(Date.now() - 60 * 1000),
//       //     EndTimestamp: new Date()
//       //   }
//       // }
//     });

//     const response = await archivedMediaClient.send(command);
//     console.log('response => ', response)
//     console.log('HLS URL:', response.HLSStreaming)
//     return response.HLSStreamingSessionURL;
//   } catch (error) {
//     console.error('Error getting HLS URL:', error);
//     throw error;
//   }
// });

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