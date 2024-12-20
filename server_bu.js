// server.js
const http = require('http');
const https = require('https');
const { DOMParser, XMLSerializer } = require('xmldom');

const port = 3030;

const manifestUrlStatic = 'https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd';
// const manifestUrl = 'https://livesim2.dashif.org/livesim2/testpic_2s/Manifest.mpd'
const manifestUrlLive = 'https://demo.unified-streaming.com/k8s/live/scte35.isml/.mpd'

const alternativeMpdUrls = [
  {
    uri: 'https://comcast-dash-6-assets.s3.us-east-2.amazonaws.com/TestAssets/MediaOfflineErrorAsset/stream.mpd',
    presentationTime: 10000,
    duration: 10000,
    earliestResolutionTimeOffset: 2000,
  },
  {
    uri: 'https://comcast-dash-6-assets.s3.us-east-2.amazonaws.com/TestAssets/MediaOfflineErrorAsset/stream.mpd',
    presentationTime: 30000,
    duration: 13000,
    earliestResolutionTimeOffset: 5000,
  },
];

const server = http.createServer((req, res) => {
  if (req.url === '/live_manifest.mpd') {
    https.get(manifestUrlLive, (manifestRes) => {
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

          const eventStream = xmlDoc.createElement('EventStream');
          eventStream.setAttribute('schemeIdUri', 'urn:mpeg:dash:event:alternativeMPD:2022');
          eventStream.setAttribute('timescale', '1000');

          alternativeMpdUrls.forEach((alternative) => {
            const event = xmlDoc.createElement('Event');
            event.setAttribute('presentationTime', alternative.presentationTime.toString());
            event.setAttribute('duration', alternative.duration.toString());

            const alternativeMPD = xmlDoc.createElement('AlternativeMPD');
            alternativeMPD.setAttribute('uri', alternative.uri);
            alternativeMPD.setAttribute('earliestResolutionTimeOffset', alternative.earliestResolutionTimeOffset.toString());
            alternativeMPD.setAttribute('mode', 'start');

            event.appendChild(alternativeMPD);
            eventStream.appendChild(event);
          });

          periodElement.insertBefore(eventStream, periodElement.firstChild);

          let baseUrlElement = xmlDoc.getElementsByTagName('BaseURL')[0];
          if (!baseUrlElement) {
            baseUrlElement = xmlDoc.createElement('BaseURL');
            baseUrlElement.textContent = manifestUrlLive.substring(0, manifestUrlLive.lastIndexOf('/') + 1);
            const mpdElement = xmlDoc.getElementsByTagName('MPD')[0];
            mpdElement.insertBefore(baseUrlElement, mpdElement.firstChild);
          } else {
            baseUrlElement.textContent = manifestUrlLive.substring(0, manifestUrlLive.lastIndexOf('/') + 1);
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
  } else if (req.url === '/static_manifest.mpd') {
    https.get(manifestUrlStatic, (manifestRes) => {
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

          const eventStream = xmlDoc.createElement('EventStream');
          eventStream.setAttribute('schemeIdUri', 'urn:mpeg:dash:event:alternativeMPD:2022');
          eventStream.setAttribute('timescale', '1000');

          alternativeMpdUrls.forEach((alternative) => {
            const event = xmlDoc.createElement('Event');
            event.setAttribute('presentationTime', alternative.presentationTime.toString());
            event.setAttribute('duration', alternative.duration.toString());

            const alternativeMPD = xmlDoc.createElement('AlternativeMPD');
            alternativeMPD.setAttribute('uri', alternative.uri);
            alternativeMPD.setAttribute('earliestResolutionTimeOffset', alternative.earliestResolutionTimeOffset.toString());
            alternativeMPD.setAttribute('mode', 'start');

            event.appendChild(alternativeMPD);
            eventStream.appendChild(event);
          });

          periodElement.insertBefore(eventStream, periodElement.firstChild);

          let baseUrlElement = xmlDoc.getElementsByTagName('BaseURL')[0];
          if (!baseUrlElement) {
            baseUrlElement = xmlDoc.createElement('BaseURL');
            baseUrlElement.textContent = manifestUrlStatic.substring(0, manifestUrlStatic.lastIndexOf('/') + 1);
            const mpdElement = xmlDoc.getElementsByTagName('MPD')[0];
            mpdElement.insertBefore(baseUrlElement, mpdElement.firstChild);
          } else {
            baseUrlElement.textContent = manifestUrlStatic.substring(0, manifestUrlStatic.lastIndexOf('/') + 1);
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
