// server.js
const http = require('http');
const https = require('https');
const { DOMParser, XMLSerializer } = require('xmldom');

const port = 3030;

// Default static and live manifest URLs
const manifestUrlStatic = 'https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd';
const manifestUrlLive = 'https://demo.unified-streaming.com/k8s/live/scte35.isml/.mpd';

const server = http.createServer((req, res) => {
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-requested-with');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  const isLive = url.searchParams.get('live') === '1';
  const manifestUrl = isLive ? manifestUrlLive : manifestUrlStatic;

  // Extract alternatives from query params
  // Expecting multiple "alt" params in the format:
  // ?alt=uri|presentationTime|duration|earliestResolutionTimeOffset|mode|returnOffset
  // e.g. ?alt=https://example.com/alt1.mpd|10000|10000|2000|insert|0&alt=https://example.com/alt2.mpd|30000|13000|5000|replace|500
  const alternativeMpdUrls = [];
  url.searchParams.forEach((value, key) => {
    if (key === 'alt') {
      const parts = value.split('|');
      const uri = parts[0];
      const presentationTime = parseInt(parts[1], 10) || 0;
      const duration = parseInt(parts[2], 10) || 10000;
      const earliestResolutionTimeOffset = parseInt(parts[3], 10) || 0;
      const mode = parts[4] || 'insert';
      const returnOffset = parseInt(parts[5], 10) || 0;
      alternativeMpdUrls.push({
        uri,
        presentationTime,
        duration,
        earliestResolutionTimeOffset,
        mode,
        returnOffset
      });
    }
  });

  // If no "alt" params provided, use default alternatives
  if (alternativeMpdUrls.length === 0) {
    alternativeMpdUrls.push({
      uri: 'https://comcast-dash-6-assets.s3.us-east-2.amazonaws.com/TestAssets/MediaOfflineErrorAsset/stream.mpd',
      presentationTime: 10000,
      duration: 10000,
      earliestResolutionTimeOffset: 2000,
      mode: 'insert',
      returnOffset: 0,
    },
    {
      uri: 'https://comcast-dash-6-assets.s3.us-east-2.amazonaws.com/TestAssets/MediaOfflineErrorAsset/stream.mpd',
      presentationTime: 30000,
      duration: 13000,
      earliestResolutionTimeOffset: 5000,
      mode: 'replace',
      returnOffset: 0,
    });
  }

  if (url.pathname === '/manifest.mpd') {
    https.get(manifestUrl, (manifestRes) => {
      let data = '';

      manifestRes.on('data', (chunk) => {
        data += chunk;
      });

      manifestRes.on('end', () => {
        try {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(data, 'application/xml');

          const periodElement = xmlDoc.getElementsByTagName('Period')[0];
          if (!periodElement) {
            throw new Error('Period element not found in the manifest');
          }

          // Create or find EventStream element
          // If there's already one with schemeIdUri='urn:mpeg:dash:event:alternativeMPD:2022', use it; otherwise create a new one
          let eventStream = null;
          const eventStreams = xmlDoc.getElementsByTagName('EventStream');
          for (let i = 0; i < eventStreams.length; i++) {
            if (eventStreams[i].getAttribute('schemeIdUri') === 'urn:mpeg:dash:event:alternativeMPD:2022') {
              eventStream = eventStreams[i];
              break;
            }
          }
          if (!eventStream) {
            eventStream = xmlDoc.createElement('EventStream');
            eventStream.setAttribute('schemeIdUri', 'urn:mpeg:dash:event:alternativeMPD:2022');
            eventStream.setAttribute('timescale', '1000');
            periodElement.insertBefore(eventStream, periodElement.firstChild);
          }

          // Insert new events
          alternativeMpdUrls.forEach((alternative) => {
            const event = xmlDoc.createElement('Event');
            event.setAttribute('presentationTime', alternative.presentationTime.toString());
            event.setAttribute('duration', alternative.duration.toString());

            const alternativeMPD = xmlDoc.createElement('AlternativeMPD');
            alternativeMPD.setAttribute('uri', alternative.uri);
            alternativeMPD.setAttribute('earliestResolutionTimeOffset', alternative.earliestResolutionTimeOffset.toString());
            alternativeMPD.setAttribute('mode', alternative.mode);
            alternativeMPD.setAttribute('returnOffset', alternative.returnOffset.toString());

            event.appendChild(alternativeMPD);
            eventStream.appendChild(event);
          });

          let baseUrlElement = xmlDoc.getElementsByTagName('BaseURL')[0];
          if (!baseUrlElement) {
            baseUrlElement = xmlDoc.createElement('BaseURL');
            baseUrlElement.textContent = manifestUrl.substring(0, manifestUrl.lastIndexOf('/') + 1);
            const mpdElement = xmlDoc.getElementsByTagName('MPD')[0];
            mpdElement.insertBefore(baseUrlElement, mpdElement.firstChild);
          } else {
            baseUrlElement.textContent = manifestUrl.substring(0, manifestUrl.lastIndexOf('/') + 1);
          }

          const serializer = new XMLSerializer();
          const modifiedMPD = serializer.serializeToString(xmlDoc);

          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Content-Type', 'application/dash+xml');

          res.writeHead(200);
          res.end(modifiedMPD);
        } catch (error) {
          console.error('Error modifying the manifest:', error);
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal Server Error');
        }
      });
    }).on('error', (err) => {
      console.error('Error fetching the base manifest:', err);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
