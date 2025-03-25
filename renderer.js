// let peerConnection;
// let localStream;

// // UI Elements
// const startButton = document.getElementById('startButton');
// const stopButton = document.getElementById('stopButton');
// const playButton = document.getElementById('playButton');
// const localVideo = document.getElementById('localVideo');
// const remoteVideo = document.getElementById('remoteVideo');

// async function startStreaming() {
//   try {
    
//     localStream = await navigator.mediaDevices.getUserMedia({ 
//       video: true, 
//       audio: true 
//     });
    
//     localVideo.srcObject = localStream;

    // const iceServers = await window.electronAPI.getIceServers();
    
//     // WebRTC Setup
//     peerConnection = new RTCPeerConnection({ iceServers });
    
//     // Add local tracks to connection
//     localStream.getTracks().forEach(track => 
//       peerConnection.addTrack(track, localStream)
//     );

//     // ICE Candidate Handler
//     peerConnection.onicecandidate = ({ candidate }) => {
//       if (candidate) {
//         console.log('New ICE candidate:', candidate);
//       }
//     };

//     // Track Handler
//     peerConnection.ontrack = ({ streams: [stream] }) => {
//       remoteVideo.srcObject = stream;
//     };

//     // Create Offer
//     const offer = await peerConnection.createOffer();
//     await peerConnection.setLocalDescription(offer);

//     startButton.disabled = true;
//     stopButton.disabled = false;

//   } catch (error) {
//     console.error('Streaming error:', error);
//     stopStreaming();
//   }
// }

// async function stopStreaming() {
//   if (peerConnection) {
//     peerConnection.close();
//     peerConnection = null;
//   }
  
//   if (localStream) {
//     localStream.getTracks().forEach(track => track.stop());
//     localStream = null;
//   }
  
//   localVideo.srcObject = null;
//   startButton.disabled = false;
//   stopButton.disabled = true;
// }

// async function playRecording() {
//   try {
//     const hlsUrl = await window.electronAPI.getHlsUrl();
    
//     if (Hls.isSupported()) {
//       const hls = new Hls();
//       hls.loadSource(hlsUrl);
//       hls.attachMedia(remoteVideo);
//       hls.on(Hls.Events.MANIFEST_PARSED, () => {
//         remoteVideo.play();
//       });
//     } else if (remoteVideo.canPlayType('application/vnd.apple.mpegurl')) {
//       remoteVideo.src = hlsUrl;
//       remoteVideo.addEventListener('loadedmetadata', () => {
//         remoteVideo.play();
//       });
//     }
    
//     playButton.disabled = true;
//   } catch (error) {
//     console.error('Playback error:', error);
//   }
// }

// // Event Listeners
// startButton.addEventListener('click', startStreaming);
// stopButton.addEventListener('click', stopStreaming);
// playButton.addEventListener('click', playRecording);


// renderer.js
// import { SignalingClient, LogLevel } from 'amazon-kinesis-video-streams-webrtc-sdk-js';

// Global Variables
let peerConnection = null;
let localStream = null;
let signalingClient = null;

// UI Elements
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const playButton = document.getElementById('playButton');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

const config = {

};

// Function to start streaming video via WebRTC to KVS
// async function startStreaming() {
//   try {
//     // 1. Capture local media (video + audio)
//     localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
//     localVideo.srcObject = localStream;
    
//     // 2. Retrieve ICE servers from main process (via IPC)
//     const iceServers = await window.electronAPI.getIceServers();
//     console.log('ICE Servers:', iceServers);
    
//     // 3. Create signaling client configuration for Kinesis Video Streams WebRTC
//     const signalingConfig = {
//       channelARN: 'arn:aws:kinesisvideo:ap-south-1:905418472842:channel/test-channel-1/1742819930422', // Replace with your signaling channel ARN
//       clientId: null,  // Unique per client session
//       role: 'MASTER',                           // Use MASTER if you're sending media
//       region: 'ap-south-1',                      // Replace with your region
//       systemClockOffset: 0,
//     };

//     // 4. Create the signaling client
//     signalingClient = new window.KVSWebRTC.SignalingClient(signalingConfig);

//     // 5. Setup signaling event handlers
//     signalingClient.onopen = async () => {
//       console.log('Signaling channel connected.');

//       // 5a. Create an RTCPeerConnection with the retrieved ICE servers.
//       const rtcConfig = { iceServers };
//       peerConnection = new RTCPeerConnection(rtcConfig);

//       // 5b. Add local media tracks to the peer connection.
//       localStream.getTracks().forEach(track => {
//         peerConnection.addTrack(track, localStream);
//       });

//       // 5c. When ICE candidates are generated, send them via the signaling channel.
//       peerConnection.onicecandidate = (event) => {
//         if (event.candidate) {
//           console.log('Sending ICE candidate via signaling:', event.candidate);
//           signalingClient.sendMessage({
//             messageType: 'ICE_CANDIDATE',
//             payload: event.candidate,
//           });
//         }
//       };

//       // 5d. When negotiation is needed, create and send an SDP offer.
//       peerConnection.onnegotiationneeded = async () => {
//         try {
//           const offer = await peerConnection.createOffer();
//           await peerConnection.setLocalDescription(offer);
//           console.log('Sending SDP offer via signaling:', offer);
//           signalingClient.sendMessage({
//             messageType: 'SDP_OFFER',
//             payload: offer,
//           });
//         } catch (err) {
//           console.error('Error creating or sending SDP offer:', err);
//         }
//       };

//       // 5e. Handle remote track event to show the remote stream.
//       peerConnection.ontrack = ({ streams: [stream] }) => {
//         console.log('Remote track received.');
//         remoteVideo.srcObject = stream;
//       };
//     };

//     signalingClient.onmessage = async (message) => {
//       console.log('Received signaling message:', message);
//       if (message.messageType === 'SDP_ANSWER') {
//         console.log('Received SDP answer, setting remote description.');
//         await peerConnection.setRemoteDescription(new RTCSessionDescription(message.payload));
//       } else if (message.messageType === 'ICE_CANDIDATE') {
//         console.log('Received ICE candidate, adding to peer connection.');
//         try {
//           await peerConnection.addIceCandidate(new RTCIceCandidate(message.payload));
//         } catch (err) {
//           console.error('Error adding ICE candidate:', err);
//         }
//       }
//     };

//     signalingClient.onerror = (error) => {
//       console.error('Signaling error:', error);
//     };

//     signalingClient.onclose = () => {
//       console.log('Signaling channel closed.');
//     };

//     // 6. Open the signaling channel
//     signalingClient.open();

//     // Update UI button states
//     startButton.disabled = true;
//     stopButton.disabled = false;
//   } catch (error) {
//     console.error('Streaming error:', error);
//     stopStreaming();
//   }
// }

async function startStreaming() {
  try {
    // --- 1. Get Local Media Stream ---
    localStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: true,
    });
    localVideo.srcObject = localStream;

    const channelEndpoints = await window.electronAPI.getSignalingChannelEndpoint();

    const iceServers = await window.electronAPI.getIceServers(channelEndpoints);

    // --- 4. Create RTCPeerConnection ---
    peerConnection = new RTCPeerConnection({ iceServers, iceTransportPolicy: 'all' });

    localStream.getTracks().forEach(track => {
      if (peerConnection && localStream) {
        peerConnection.addTrack(track, localStream);
      }
    });

    console.log('peerConnection => ', peerConnection)

    // --- 5. Create Signaling Client ---
    // const clientId = generateClientId(); // Generate a unique client ID for this viewer
    signalingClient = new window.KVSWebRTC.SignalingClient({  // Use window.KVSWebRTC
      channelARN: config.channelARN,
      channelEndpoint: channelEndpoints.WSS,
      clientId: null,    
      role: window.KVSWebRTC.Role.MASTER, 
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      systemClockOffset: 0
      // systemClockOffset: kinesisVideoClient.config.systemClockOffset, //  Important for synchronization
    });

    console.log('signalingClient => ', signalingClient)

    // --- 6. Signaling Client Event Handlers ---

    peerConnection.onicecandidate = ({ candidate }) => {
      if (candidate && signalingClient) {
        console.log('sending ice candidate')
        signalingClient.sendIceCandidate(candidate);
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', peerConnection?.iceConnectionState);
    };

    signalingClient.on('open', async () => {
      console.log('signaling service opened');

      // try {
      //     const offer = await peerConnection.createOffer({
      //         offerToReceiveAudio: true,
      //         offerToReceiveVideo: true,
      //     });

      //     await peerConnection.setLocalDescription(offer);

      //     signalingClient.sendSdpOffer(offer); 

      // } catch (e) {
      //     console.error('open-Error', e);
      //     return; // Exit if we can't get the webcam
      // }

    });

    signalingClient.on('sdpOffer', async (offer) => {
      console.log('[MASTER] Received SDP offer from viewer:', offer);
      await peerConnection.setRemoteDescription(offer);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      console.log('[MASTER] Sending SDP answer:', answer);
      signalingClient.sendSdpAnswer(answer);
    });

    // signalingClient.on('sdpAnswer', async (answer) => {
    //   await peerConnection.setRemoteDescription(answer);
    // });

    signalingClient.on('iceCandidate', (candidate) => {
      console.log('receiving ice candidate')
      peerConnection.addIceCandidate(candidate);
    });

    signalingClient.on('close', () => {
      console.log('[VIEWER] Disconnected from signaling channel');
    });

    signalingClient.on('error', (error) => {
      console.error('[VIEWER] Signaling client error:', error);
    });

    // --- 7. Peer Connection Event Handlers ---

    // Send ICE candidates to the MASTER
    // peerConnection.addEventListener('icecandidate', ({ candidate }) => {
    //   if (candidate) {
    //     console.log('[VIEWER] Sending ICE candidate', candidate);
    //     signalingClient.sendIceCandidate(candidate);
    //   } else {
    //     console.log('[VIEWER] All ICE candidates have been sent');
    //   }
    // });

    // When a remote track arrives, add it to the remote video element
      peerConnection.addEventListener('track', (event) => {
        console.log('[VIEWER] Received remote track');
        if (remoteVideo.srcObject) {
          return; // Already have a remote stream
        }
        remoteVideo.srcObject = event.streams[0];
      });

      // --- 8. Open Signaling Connection ---
      console.log('Opening signaling connection');
      signalingClient.open()

      // Update UI
      startButton.disabled = true;
      stopButton.disabled = false;

  } catch (error) {
    console.error('[VIEWER] Error in startStreaming:', error);
    alert('Error starting streaming: ' + error.message);
  }
}
// Function to stop streaming and clean up resources.
async function stopStreaming() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  localVideo.srcObject = null;
  startButton.disabled = false;
  stopButton.disabled = true;

  if (signalingClient) {
    signalingClient.close();
    signalingClient = null;
  }
}

// Function to play the recorded (archived) video via HLS.
// This part uses the HLS URL retrieved via IPC.
async function playRecording() {
  try {
    const hlsUrl = await window.electronAPI.getHlsUrl();
    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(hlsUrl);
      hls.attachMedia(remoteVideo);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        remoteVideo.play();
      });
    } else if (remoteVideo.canPlayType('application/vnd.apple.mpegurl')) {
      remoteVideo.src = hlsUrl;
      remoteVideo.addEventListener('loadedmetadata', () => {
        remoteVideo.play();
      });
    }
    playButton.disabled = true;
  } catch (error) {
    console.error('Playback error:', error);
  }
}

// UI Event Listeners
startButton.addEventListener('click', startStreaming);
stopButton.addEventListener('click', stopStreaming);
playButton.addEventListener('click', playRecording);
